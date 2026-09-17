use std::{
    collections::HashMap,
    env,
    net::{IpAddr, SocketAddr},
    str::FromStr,
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{ConnectInfo, Query, State},
    http::{
        header::{HeaderValue, CACHE_CONTROL, CONTENT_TYPE, LOCATION},
        HeaderMap, StatusCode,
    },
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn};

const DEFAULT_BIND_ADDR: &str = "127.0.0.1:8010";
const DEFAULT_LIMIT_PER_MINUTE: u32 = 8;
const DEFAULT_LIMIT_PER_HOUR: u32 = 60;
const DEFAULT_OSS_SIGN_EXPIRES_SECONDS: u64 = 300;
const OSS_PATH_SEGMENT_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');
type HmacSha1 = Hmac<Sha1>;

#[derive(rust_embed::RustEmbed)]
#[folder = "web/dist"]
struct WebAssets;

#[derive(Clone)]
struct AppState {
    downloads: DownloadConfig,
    limiter: RateLimiter,
}

#[derive(Clone)]
struct DownloadConfig {
    oss: OssConfig,
    mac_object: String,
    windows_object: String,
    linux_object: String,
}

#[derive(Clone)]
struct OssConfig {
    access_key_id: String,
    access_key_secret: String,
    bucket: String,
    endpoint: String,
    expires_seconds: u64,
}

#[derive(Clone)]
struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, ClientBucket>>>,
    per_minute: u32,
    per_hour: u32,
}

#[derive(Debug, Clone)]
struct ClientBucket {
    minute_start: Instant,
    hour_start: Instant,
    minute_count: u32,
    hour_count: u32,
}

#[derive(Debug, Deserialize)]
struct DownloadQuery {
    platform: Platform,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Platform {
    Mac,
    Windows,
    Linux,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
    service: &'static str,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: &'static str,
    message: String,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "juyou_website_backend=info,tower_http=info".into()),
        )
        .init();

    let state = AppState {
        downloads: DownloadConfig::from_env(),
        limiter: RateLimiter::from_env(),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/download", get(download))
        .fallback(get(static_handler))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = env::var("BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
    let addr =
        SocketAddr::from_str(&addr).expect("BIND_ADDR must be host:port, e.g. 127.0.0.1:8080");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind backend address");

    info!(%addr, "juyou website backend listening");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .expect("server failed");
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        service: "juyou-website-backend",
    })
}

async fn static_handler(uri: axum::http::Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let asset_path = if path.is_empty() { "index.html" } else { path };
    serve_embedded_asset(asset_path).unwrap_or_else(|| {
        // SPA fallback: unknown non-API routes return index.html.
        serve_embedded_asset("index.html").unwrap_or_else(|| {
            error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "missing_index",
                "embedded frontend asset index.html was not found".to_string(),
            )
        })
    })
}

async fn download(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Query(query): Query<DownloadQuery>,
) -> Response {
    let ip = client_ip(&headers).unwrap_or_else(|| addr.ip());
    if let Err(message) = state.limiter.check(ip, query.platform) {
        warn!(%ip, platform = ?query.platform, %message, "download rate limited");
        return error(StatusCode::TOO_MANY_REQUESTS, "rate_limited", message);
    }

    let target = match state.downloads.signed_url_for(query.platform) {
        Ok(target) => target,
        Err(message) => {
            warn!(platform = ?query.platform, %message, "failed to sign download url");
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "download_sign_failed",
                message,
            );
        }
    };

    match HeaderValue::from_str(&target) {
        Ok(location) => {
            info!(%ip, platform = ?query.platform, %target, "download redirect");
            (StatusCode::FOUND, [(LOCATION, location)]).into_response()
        }
        Err(_) => error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "invalid_download_url",
            format!("download URL is not a valid header value: {target}"),
        ),
    }
}

fn serve_embedded_asset(path: &str) -> Option<Response> {
    let asset = WebAssets::get(path)?;
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let cache_control = if path == "index.html" {
        "no-cache"
    } else {
        "public, max-age=31536000, immutable"
    };

    Some(
        (
            StatusCode::OK,
            [
                (CONTENT_TYPE, HeaderValue::from_str(mime.as_ref()).ok()?),
                (CACHE_CONTROL, HeaderValue::from_static(cache_control)),
            ],
            asset.data.into_owned(),
        )
            .into_response(),
    )
}

impl DownloadConfig {
    fn from_env() -> Self {
        Self {
            oss: OssConfig::from_env(),
            mac_object: env_required("OSS_MAC_OBJECT"),
            windows_object: env_required("OSS_WINDOWS_OBJECT"),
            linux_object: env_required("OSS_LINUX_OBJECT"),
        }
    }

    fn signed_url_for(&self, platform: Platform) -> Result<String, String> {
        self.oss.sign_get_url(self.object_for(platform))
    }

    fn object_for(&self, platform: Platform) -> &str {
        match platform {
            Platform::Mac => &self.mac_object,
            Platform::Windows => &self.windows_object,
            Platform::Linux => &self.linux_object,
        }
    }
}

impl OssConfig {
    fn from_env() -> Self {
        let endpoint = env_required("OSS_ENDPOINT")
            .trim()
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_end_matches('/')
            .to_string();

        Self {
            access_key_id: env_required("OSS_ACCESS_KEY_ID"),
            access_key_secret: env_required("OSS_ACCESS_KEY_SECRET"),
            bucket: env_required("OSS_BUCKET"),
            endpoint,
            expires_seconds: env_u64("OSS_SIGN_EXPIRES_SECONDS", DEFAULT_OSS_SIGN_EXPIRES_SECONDS),
        }
    }

    fn sign_get_url(&self, object: &str) -> Result<String, String> {
        let object = object.trim_start_matches('/');
        let expires = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|err| format!("system clock is before unix epoch: {err}"))?
            .as_secs()
            + self.expires_seconds;
        let canonical_resource = format!("/{}/{}", self.bucket, object);
        let string_to_sign = format!("GET\n\n\n{expires}\n{canonical_resource}");

        let mut mac = HmacSha1::new_from_slice(self.access_key_secret.as_bytes())
            .map_err(|err| format!("failed to initialize OSS signer: {err}"))?;
        mac.update(string_to_sign.as_bytes());
        let signature = general_purpose::STANDARD.encode(mac.finalize().into_bytes());

        Ok(format!(
            "https://{}.{}{}?OSSAccessKeyId={}&Expires={}&Signature={}",
            self.bucket,
            self.endpoint,
            encode_path(&format!("/{}", object)),
            encode_query_value(&self.access_key_id),
            expires,
            encode_query_value(&signature)
        ))
    }
}

impl RateLimiter {
    fn from_env() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            per_minute: env_u32("DOWNLOAD_LIMIT_PER_MINUTE", DEFAULT_LIMIT_PER_MINUTE),
            per_hour: env_u32("DOWNLOAD_LIMIT_PER_HOUR", DEFAULT_LIMIT_PER_HOUR),
        }
    }

    fn check(&self, ip: IpAddr, platform: Platform) -> Result<(), String> {
        let now = Instant::now();
        let key = format!("{ip}:{platform:?}");
        let mut buckets = self
            .inner
            .lock()
            .map_err(|_| "rate limiter lock poisoned".to_string())?;
        let bucket = buckets.entry(key).or_insert_with(|| ClientBucket {
            minute_start: now,
            hour_start: now,
            minute_count: 0,
            hour_count: 0,
        });

        if now.duration_since(bucket.minute_start) >= Duration::from_secs(60) {
            bucket.minute_start = now;
            bucket.minute_count = 0;
        }
        if now.duration_since(bucket.hour_start) >= Duration::from_secs(60 * 60) {
            bucket.hour_start = now;
            bucket.hour_count = 0;
        }

        if bucket.minute_count >= self.per_minute {
            return Err(format!(
                "too many download attempts, please retry later (limit: {}/minute)",
                self.per_minute
            ));
        }
        if bucket.hour_count >= self.per_hour {
            return Err(format!(
                "too many download attempts, please retry later (limit: {}/hour)",
                self.per_hour
            ));
        }

        bucket.minute_count += 1;
        bucket.hour_count += 1;
        Ok(())
    }
}

fn env_required(key: &str) -> String {
    env::var(key)
        .unwrap_or_else(|_| panic!("{key} must be set"))
        .trim()
        .to_string()
}

fn env_u32(key: &str, fallback: u32) -> u32 {
    env::var(key)
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(fallback)
}

fn env_u64(key: &str, fallback: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(fallback)
}

fn encode_path(path: &str) -> String {
    path.split('/')
        .map(|segment| utf8_percent_encode(segment, OSS_PATH_SEGMENT_ENCODE_SET).to_string())
        .collect::<Vec<_>>()
        .join("/")
}

fn encode_query_value(value: &str) -> String {
    utf8_percent_encode(value, NON_ALPHANUMERIC).to_string()
}

fn client_ip(headers: &HeaderMap) -> Option<IpAddr> {
    let forwarded_for = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .and_then(|value| value.parse::<IpAddr>().ok());

    forwarded_for.or_else(|| {
        headers
            .get("x-real-ip")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<IpAddr>().ok())
    })
}

fn error(status: StatusCode, code: &'static str, message: String) -> Response {
    (
        status,
        Json(ErrorResponse {
            error: code,
            message,
        }),
    )
        .into_response()
}

async fn shutdown_signal() {
    if let Err(err) = tokio::signal::ctrl_c().await {
        warn!(%err, "failed to listen for shutdown signal");
    }
}
