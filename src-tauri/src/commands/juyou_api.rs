use once_cell::sync::Lazy;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, SET_COOKIE};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

static JUYOU_HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("juyou-switcher/desktop")
        .build()
        .expect("failed to build Juyou HTTP client")
});

static JUYOU_COOKIE: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Deserialize)]
pub struct JuyouApiRequest {
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JuyouApiResponse {
    status: u16,
    status_text: String,
    headers: Vec<(String, String)>,
    text: String,
}

fn stored_cookie() -> Option<String> {
    JUYOU_COOKIE.lock().ok().and_then(|cookie| cookie.clone())
}

fn should_attach_session_cookie(url: &str) -> bool {
    url::Url::parse(url)
        .map(|url| url.path().starts_with("/api/"))
        .unwrap_or(false)
}

fn store_session_cookie(headers: &HeaderMap) {
    for value in headers.get_all(SET_COOKIE).iter() {
        let Ok(raw) = value.to_str() else {
            continue;
        };
        let Some(cookie_pair) = raw.split(';').next().map(str::trim) else {
            continue;
        };
        if cookie_pair.starts_with("session=") {
            if let Ok(mut cookie) = JUYOU_COOKIE.lock() {
                if cookie_pair == "session=" {
                    *cookie = None;
                } else {
                    *cookie = Some(cookie_pair.to_string());
                }
            }
        }
    }
}

fn response_headers(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.as_str().to_string(), value.to_string()))
        })
        .collect()
}

/// Desktop-only Juyou API request helper.
///
/// The webview cannot reliably use the backend's SameSite=Lax session cookie for
/// cross-site fetches from localhost. This command keeps the session cookie in
/// Rust and sends it on subsequent API requests.
#[tauri::command]
pub async fn juyou_api_request(request: JuyouApiRequest) -> Result<JuyouApiResponse, String> {
    let method = request
        .method
        .parse::<reqwest::Method>()
        .map_err(|err| format!("Invalid method: {err}"))?;

    let mut builder = JUYOU_HTTP_CLIENT.request(method, &request.url);
    let mut has_cookie_header = false;

    for (name, value) in request.headers {
        let lower_name = name.to_ascii_lowercase();
        if lower_name == "host" || lower_name == "content-length" {
            continue;
        }
        if lower_name == "cookie" {
            has_cookie_header = true;
        }
        let header_name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|err| format!("Invalid header name {name}: {err}"))?;
        let header_value = HeaderValue::from_str(&value)
            .map_err(|err| format!("Invalid header value for {name}: {err}"))?;
        builder = builder.header(header_name, header_value);
    }

    if !has_cookie_header && should_attach_session_cookie(&request.url) {
        if let Some(cookie) = stored_cookie() {
            builder = builder.header(reqwest::header::COOKIE, cookie);
        }
    }

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder
        .send()
        .await
        .map_err(|err| format!("Juyou API request failed: {err}"))?;

    store_session_cookie(response.headers());

    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or_default().to_string();
    let headers = response_headers(response.headers());
    let text = response
        .text()
        .await
        .map_err(|err| format!("Failed to read Juyou API response: {err}"))?;

    Ok(JuyouApiResponse {
        status: status.as_u16(),
        status_text,
        headers,
        text,
    })
}
