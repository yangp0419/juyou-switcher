use crate::app_config::AppType;
use crate::codex_config::{
    get_codex_auth_path, get_codex_config_path, read_codex_live_settings,
    write_juyou_api_config_to_codex, JUYOU_SWITCH_CODEX_MODEL_PROVIDER_ID,
};
use crate::codex_history_migration::migrate_codex_juyouapi_history_to_unified_bucket;
use crate::config::{get_claude_settings_path, read_json_file, write_json_file};
use crate::error::AppError;
use crate::provider::Provider;
use crate::store::AppState;
use serde_json::{json, Value};
use tauri::State;

const JUYOU_API_BASE_URL: &str = "https://api.juyouhuyu.top";
const JUYOU_CODEX_BASE_URL: &str = "https://api.juyouhuyu.top/v1";
const LEGACY_JUYOU_CODEX_PROVIDER_ID: &str = "juyouapi";
const USER_PROVIDER_ID: &str = "user";
const USER_PROVIDER_NAME: &str = "User Provider";

fn normalize_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

fn is_claude_juyou_live_config(settings: &Value) -> bool {
    settings
        .get("env")
        .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
        .and_then(Value::as_str)
        .is_some_and(|url| normalize_url(url) == JUYOU_API_BASE_URL)
}

fn is_codex_juyou_live_config(settings: &Value) -> bool {
    let Some(config_text) = settings.get("config").and_then(Value::as_str) else {
        return false;
    };
    let Ok(doc) = toml::from_str::<toml::Value>(config_text) else {
        return false;
    };

    let active_provider = doc
        .get("model_provider")
        .and_then(toml::Value::as_str)
        .map(str::trim);
    let Some(active_provider) = active_provider else {
        return false;
    };
    if active_provider != JUYOU_SWITCH_CODEX_MODEL_PROVIDER_ID
        && active_provider != LEGACY_JUYOU_CODEX_PROVIDER_ID
    {
        return false;
    }

    doc.get("model_providers")
        .and_then(|providers| providers.get(active_provider))
        .and_then(|provider| provider.get("base_url"))
        .and_then(toml::Value::as_str)
        .is_some_and(|url| normalize_url(url) == JUYOU_CODEX_BASE_URL)
}

/// Quick setup: preserve current Codex live config, then write and store Juyou API config.
#[tauri::command]
pub async fn quick_setup_codex(
    state: State<'_, AppState>,
    api_key: String,
    model: String,
) -> Result<(), AppError> {
    let app_type = AppType::Codex;

    if state
        .proxy_service
        .detect_takeover_in_live_config_for_app(&app_type)
    {
        return Err(AppError::localized(
            "provider.import.live_taken_over",
            "Live 配置当前处于代理接管状态（包含占位符），不能导入为供应商。请先关闭代理接管或恢复 Live 配置后重试。",
            "The live config is currently taken over by the proxy (contains placeholders) and cannot be imported as a provider. Disable proxy takeover or restore the live config first.",
        ));
    }

    // Preserve the user's current non-Juyou Codex live config as the restore target.
    // Repeated quick setup runs should refresh this "user" provider whenever the
    // live config is not already managed by Juyou.
    if get_codex_auth_path().exists() || get_codex_config_path().exists() {
        let current_live_settings = read_codex_live_settings()?;
        if !is_codex_juyou_live_config(&current_live_settings) {
            let mut user_provider = Provider::with_id(
                USER_PROVIDER_ID.to_string(),
                USER_PROVIDER_NAME.to_string(),
                current_live_settings,
                None,
            );
            user_provider.category = Some("custom".to_string());
            state.db.save_provider(app_type.as_str(), &user_provider)?;
        }
    }

    write_juyou_api_config_to_codex(&api_key, &model)?;
    if let Err(err) = migrate_codex_juyouapi_history_to_unified_bucket() {
        log::warn!("迁移 Codex juyouapi 历史到 custom 桶失败: {err}");
    }
    let mut app_settings = crate::settings::get_settings();
    if !app_settings.unify_codex_session_history
        || app_settings.unify_codex_migrate_existing != Some(true)
    {
        app_settings.unify_codex_session_history = true;
        app_settings.unify_codex_migrate_existing = Some(true);
        if let Err(err) = crate::settings::update_settings(app_settings) {
            log::warn!("启用 Codex 统一会话历史设置失败: {err}");
        }
    }
    if let Err(err) =
        crate::codex_history_migration::maybe_migrate_codex_official_history_to_unified_bucket()
    {
        log::warn!("迁移 Codex 官方历史到 custom 桶失败: {err}");
    }

    let mut juyou_provider = Provider::with_id(
        "juyouapi".to_string(),
        "Juyou API".to_string(),
        read_codex_live_settings()?,
        Some("https://api.juyouhuyu.top".to_string()),
    );
    juyou_provider.category = Some("custom".to_string());
    juyou_provider.icon = Some("sparkles".to_string());
    juyou_provider.icon_color = Some("#0b65d8".to_string());

    state.db.save_provider(app_type.as_str(), &juyou_provider)?;
    state
        .db
        .set_current_provider(app_type.as_str(), &juyou_provider.id)?;
    crate::settings::set_current_provider(&app_type, Some(juyou_provider.id.as_str()))?;

    Ok(())
}

/// Quick setup: preserve current Claude settings.json, then write and store Juyou API config.
#[tauri::command]
pub async fn quick_setup_claude(
    state: State<'_, AppState>,
    api_key: String,
    model: String,
) -> Result<(), AppError> {
    let app_type = AppType::Claude;

    if state
        .proxy_service
        .detect_takeover_in_live_config_for_app(&app_type)
    {
        return Err(AppError::localized(
            "provider.import.live_taken_over",
            "Live 配置当前处于代理接管状态（包含占位符），不能导入为供应商。请先关闭代理接管或恢复 Live 配置后重试。",
            "The live config is currently taken over by the proxy (contains placeholders) and cannot be imported as a provider. Disable proxy takeover or restore the live config first.",
        ));
    }

    let settings_path = get_claude_settings_path();

    if settings_path.exists() {
        let default_settings = read_json_file::<Value>(&settings_path)?;
        if !is_claude_juyou_live_config(&default_settings) {
            let mut user_provider = Provider::with_id(
                USER_PROVIDER_ID.to_string(),
                USER_PROVIDER_NAME.to_string(),
                default_settings,
                None,
            );
            user_provider.category = Some("custom".to_string());
            state.db.save_provider(app_type.as_str(), &user_provider)?;
        }
    }

    let bearer_token = if api_key.starts_with("sk-") {
        api_key
    } else {
        format!("sk-{api_key}")
    };

    let mut settings = if settings_path.exists() {
        read_json_file::<Value>(&settings_path)?
    } else {
        json!({})
    };

    if !settings.is_object() {
        settings = json!({});
    }

    let settings_object = settings
        .as_object_mut()
        .ok_or_else(|| AppError::Config("Claude settings must be a JSON object".to_string()))?;
    let env = settings_object.entry("env").or_insert_with(|| json!({}));
    if !env.is_object() {
        *env = json!({});
    }
    let env_object = env
        .as_object_mut()
        .ok_or_else(|| AppError::Config("Claude settings env must be a JSON object".to_string()))?;
    env_object.insert("ANTHROPIC_AUTH_TOKEN".to_string(), json!(bearer_token));
    env_object.insert("ANTHROPIC_MODEL".to_string(), json!(model));
    env_object.insert(
        "ANTHROPIC_BASE_URL".to_string(),
        json!("https://api.juyouhuyu.top"),
    );
    write_json_file(&settings_path, &settings)?;

    let mut juyou_provider = Provider::with_id(
        "juyouapi".to_string(),
        "Juyou API".to_string(),
        settings,
        Some("https://api.juyouhuyu.top".to_string()),
    );
    juyou_provider.category = Some("custom".to_string());
    juyou_provider.icon = Some("sparkles".to_string());
    juyou_provider.icon_color = Some("#0b65d8".to_string());

    state.db.save_provider(app_type.as_str(), &juyou_provider)?;
    state
        .db
        .set_current_provider(app_type.as_str(), &juyou_provider.id)?;
    crate::settings::set_current_provider(&app_type, Some(juyou_provider.id.as_str()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_claude_juyou_live_config() {
        let settings = json!({
            "env": {
                "ANTHROPIC_BASE_URL": "https://api.juyouhuyu.top/"
            }
        });

        assert!(is_claude_juyou_live_config(&settings));
    }

    #[test]
    fn rejects_non_juyou_claude_live_config() {
        let settings = json!({
            "env": {
                "ANTHROPIC_BASE_URL": "https://api.example.com"
            }
        });

        assert!(!is_claude_juyou_live_config(&settings));
    }

    #[test]
    fn detects_codex_juyou_live_config() {
        let settings = json!({
            "auth": {},
            "config": r#"
model = "gpt-5.5"
model_provider = "custom"

[model_providers.custom]
name = "Juyou API"
base_url = "https://api.juyouhuyu.top/v1/"
experimental_bearer_token = "sk-test"
wire_api = "responses"
"#
        });

        assert!(is_codex_juyou_live_config(&settings));
    }

    #[test]
    fn detects_legacy_codex_juyouapi_live_config() {
        let settings = json!({
            "auth": {},
            "config": r#"
model = "gpt-5.5"
model_provider = "juyouapi"

[model_providers.juyouapi]
name = "Juyou API"
base_url = "https://api.juyouhuyu.top/v1/"
experimental_bearer_token = "sk-test"
wire_api = "responses"
"#
        });

        assert!(is_codex_juyou_live_config(&settings));
    }

    #[test]
    fn rejects_non_juyou_codex_live_config() {
        let settings = json!({
            "auth": {},
            "config": r#"
model = "gpt-5.5"
model_provider = "custom"

[model_providers.custom]
name = "Other"
base_url = "https://api.example.com/v1"
wire_api = "responses"
"#
        });

        assert!(!is_codex_juyou_live_config(&settings));
    }
}
