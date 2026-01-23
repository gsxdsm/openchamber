use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;
use tokio::fs;

use crate::DesktopRuntime;

const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const API_USER_URL: &str = "https://api.github.com/user";
const API_EMAILS_URL: &str = "https://api.github.com/user/emails";
const DEVICE_GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:device_code";

const DEFAULT_GITHUB_CLIENT_ID: &str = "Ov23liNd8TxDcMXtAHHM";
const DEFAULT_GITHUB_SCOPES: &str = "repo read:org workflow read:user user:email";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUserSummary {
    login: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    avatar_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAuthStatus {
    connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    user: Option<GitHubUserSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubDeviceFlowStart {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubDeviceFlowCompleteSuccess {
    connected: bool,
    user: GitHubUserSummary,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubDeviceFlowCompletePending {
    connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum GitHubDeviceFlowComplete {
    Success(GitHubDeviceFlowCompleteSuccess),
    Pending(GitHubDeviceFlowCompletePending),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubDisconnectResult {
    removed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StoredAuth {
    access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    token_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user: Option<GitHubUserSummary>,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default)]
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    #[serde(default)]
    access_token: Option<String>,
    #[serde(default)]
    scope: Option<String>,
    #[serde(default)]
    token_type: Option<String>,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiUserResponse {
    login: String,
    id: u64,
    #[serde(default)]
    avatar_url: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiEmailEntry {
    email: String,
    #[serde(default)]
    primary: bool,
    #[serde(default)]
    verified: bool,
}

fn github_auth_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "No home directory".to_string())?;
    let mut dir = home;
    dir.push(".config");
    dir.push("openchamber");
    dir.push("github-auth.json");
    Ok(dir)
}

async fn read_auth_file() -> Option<StoredAuth> {
    let path = github_auth_path().ok()?;
    let bytes = fs::read(&path).await.ok()?;
    serde_json::from_slice::<StoredAuth>(&bytes).ok()
}

async fn write_auth_file(auth: &StoredAuth) -> Result<(), String> {
    let path = github_auth_path()?;
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent).await;
    }
    let bytes = serde_json::to_vec_pretty(auth).map_err(|e| e.to_string())?;
    fs::write(&path, bytes).await.map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o600);
            let _ = std::fs::set_permissions(&path, perms);
        }
    }

    Ok(())
}

async fn clear_auth_file() -> bool {
    let path = match github_auth_path() {
        Ok(p) => p,
        Err(_) => return false,
    };
    match fs::remove_file(&path).await {
        Ok(_) => true,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => true,
        Err(_) => false,
    }
}

fn read_string_setting(settings: &Value, key: &str) -> Option<String> {
    settings
        .get(key)?
        .as_str()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

async fn resolve_client_config(state: &DesktopRuntime) -> (String, String) {
    let settings = state
        .settings()
        .load()
        .await
        .unwrap_or(Value::Object(Default::default()));
    let client_id = read_string_setting(&settings, "githubClientId")
        .unwrap_or_else(|| DEFAULT_GITHUB_CLIENT_ID.to_string());
    let scopes = read_string_setting(&settings, "githubScopes")
        .unwrap_or_else(|| DEFAULT_GITHUB_SCOPES.to_string());
    (client_id, scopes)
}

async fn fetch_primary_email(access_token: &str) -> Result<Option<String>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(API_EMAILS_URL)
        .header("Accept", "application/vnd.github+json")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "OpenChamber")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("unauthorized".to_string());
    }

    if !resp.status().is_success() {
        return Ok(None);
    }

    let list = resp
        .json::<Vec<ApiEmailEntry>>()
        .await
        .map_err(|e| e.to_string())?;

    let primary_verified = list
        .iter()
        .find(|e| e.primary && e.verified)
        .map(|e| e.email.clone());
    if primary_verified.is_some() {
        return Ok(primary_verified);
    }

    let any_verified = list.iter().find(|e| e.verified).map(|e| e.email.clone());
    Ok(any_verified)
}

async fn fetch_me(access_token: &str) -> Result<GitHubUserSummary, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(API_USER_URL)
        .header("Accept", "application/vnd.github+json")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "OpenChamber")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("unauthorized".to_string());
    }

    if !resp.status().is_success() {
        return Err(format!("GitHub /user failed: {}", resp.status()));
    }

    let payload = resp
        .json::<ApiUserResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let email = match payload.email.clone() {
        Some(v) if !v.trim().is_empty() => Some(v),
        _ => fetch_primary_email(access_token).await.ok().flatten(),
    };

    Ok(GitHubUserSummary {
        login: payload.login,
        id: Some(payload.id),
        avatar_url: payload.avatar_url,
        name: payload.name,
        email,
    })
}

#[tauri::command]
pub async fn github_auth_status(
    _state: State<'_, DesktopRuntime>,
) -> Result<GitHubAuthStatus, String> {
    let stored = read_auth_file().await;
    let Some(stored) = stored else {
        return Ok(GitHubAuthStatus {
            connected: false,
            user: None,
            scope: None,
        });
    };

    if stored.access_token.trim().is_empty() {
        let _ = clear_auth_file().await;
        return Ok(GitHubAuthStatus {
            connected: false,
            user: None,
            scope: None,
        });
    }

    match fetch_me(&stored.access_token).await {
        Ok(user) => Ok(GitHubAuthStatus {
            connected: true,
            user: Some(user),
            scope: stored.scope,
        }),
        Err(err) if err == "unauthorized" => {
            let _ = clear_auth_file().await;
            Ok(GitHubAuthStatus {
                connected: false,
                user: None,
                scope: None,
            })
        }
        Err(err) => Err(err),
    }
}

#[tauri::command]
pub async fn github_auth_start(
    state: State<'_, DesktopRuntime>,
) -> Result<GitHubDeviceFlowStart, String> {
    let (client_id, scopes) = resolve_client_config(state.inner()).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .header("User-Agent", "OpenChamber")
        .form(&[
            ("client_id", client_id.as_str()),
            ("scope", scopes.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub device code failed: {}", resp.status()));
    }

    let payload = resp
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(GitHubDeviceFlowStart {
        device_code: payload.device_code,
        user_code: payload.user_code,
        verification_uri: payload.verification_uri,
        verification_uri_complete: payload.verification_uri_complete,
        expires_in: payload.expires_in,
        interval: payload.interval,
        scope: Some(scopes),
    })
}

#[tauri::command]
pub async fn github_auth_complete(
    #[allow(non_snake_case)]
    deviceCode: String,
    state: State<'_, DesktopRuntime>,
) -> Result<GitHubDeviceFlowComplete, String> {
    let device_code = deviceCode;
    if device_code.trim().is_empty() {
        return Err("deviceCode is required".to_string());
    }

    let (client_id, _) = resolve_client_config(state.inner()).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(ACCESS_TOKEN_URL)
        .header("Accept", "application/json")
        .header("User-Agent", "OpenChamber")
        .form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            ("grant_type", DEVICE_GRANT_TYPE),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub token exchange failed: {}", resp.status()));
    }

    let payload = resp
        .json::<TokenResponse>()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(error) = payload.error.clone() {
        return Ok(GitHubDeviceFlowComplete::Pending(
            GitHubDeviceFlowCompletePending {
                connected: false,
                status: Some(error.clone()),
                error: Some(payload.error_description.unwrap_or(error)),
            },
        ));
    }

    let access_token = payload.access_token.unwrap_or_default();
    if access_token.trim().is_empty() {
        return Err("Missing access_token from GitHub".to_string());
    }

    let user = fetch_me(&access_token).await.map_err(|e| {
        if e == "unauthorized" {
            "GitHub token invalid".to_string()
        } else {
            e
        }
    })?;

    let stored = StoredAuth {
        access_token: access_token.clone(),
        scope: payload.scope.clone(),
        token_type: payload.token_type.clone(),
        created_at: Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        ),
        user: Some(user.clone()),
    };
    write_auth_file(&stored).await?;

    Ok(GitHubDeviceFlowComplete::Success(
        GitHubDeviceFlowCompleteSuccess {
            connected: true,
            user,
            scope: payload.scope,
        },
    ))
}

#[tauri::command]
pub async fn github_auth_disconnect(
    _state: State<'_, DesktopRuntime>,
) -> Result<GitHubDisconnectResult, String> {
    let removed = clear_auth_file().await;
    Ok(GitHubDisconnectResult { removed })
}

#[tauri::command]
pub async fn github_me(_state: State<'_, DesktopRuntime>) -> Result<GitHubUserSummary, String> {
    let stored = read_auth_file().await;
    let Some(stored) = stored else {
        return Err("GitHub not connected".to_string());
    };
    match fetch_me(&stored.access_token).await {
        Ok(user) => Ok(user),
        Err(err) if err == "unauthorized" => {
            let _ = clear_auth_file().await;
            Err("GitHub token expired or revoked".to_string())
        }
        Err(err) => Err(err),
    }
}
