use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;

use serde::{Deserialize, Serialize};

pub struct AutoUpdater;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubReleaseAsset {
    pub name: String,
    pub size: u64,
    pub browser_download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubReleaseResponse {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub assets: Vec<GitHubReleaseAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResponse {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
    pub asset_size_bytes: Option<u64>,
    pub published_at: Option<String>,
    pub error_msg: Option<String>,
}

impl AutoUpdater {
    pub const REPO_OWNER: &'static str = "army-u8";
    pub const REPO_NAME: &'static str = "workstation-monitor";

    /// Compare semver strings (e.g. "0.1.1" vs "0.1.2")
    pub fn is_newer_version(current: &str, latest: &str) -> bool {
        let parse_ver = |v: &str| -> Vec<u64> {
            v.trim()
                .trim_start_matches('v')
                .split('.')
                .filter_map(|s| s.split('-').next().unwrap_or("0").parse::<u64>().ok())
                .collect()
        };

        let curr_parts = parse_ver(current);
        let late_parts = parse_ver(latest);

        for (c, l) in curr_parts.iter().zip(late_parts.iter()) {
            if l > c {
                return true;
            } else if l < c {
                return false;
            }
        }
        late_parts.len() > curr_parts.len()
    }

    /// Select the best matching asset for the current OS and architecture:
    /// Prioritize exact architecture .app.zip (smallest & fastest), then Universal, then tar.gz.
    pub fn pick_best_asset<'a>(
        assets: &'a [GitHubReleaseAsset],
        target_arch: &str,
    ) -> Option<&'a GitHubReleaseAsset> {
        let arch_keyword = if target_arch.contains("aarch64") || target_arch.contains("arm64") {
            "aarch64"
        } else {
            "x64"
        };

        // 1. Exact architecture .app.zip (e.g. aarch64 is 3.2MB vs Universal 6.5MB)
        if let Some(a) = assets
            .iter()
            .find(|a| a.name.contains(arch_keyword) && a.name.ends_with(".app.zip"))
        {
            return Some(a);
        }

        // 2. Universal .app.zip
        if let Some(a) = assets
            .iter()
            .find(|a| a.name.contains("universal") && a.name.ends_with(".app.zip"))
        {
            return Some(a);
        }

        // 3. Any .app.zip
        if let Some(a) = assets.iter().find(|a| a.name.ends_with(".app.zip")) {
            return Some(a);
        }

        // 4. Exact architecture .tar.gz
        if let Some(a) = assets
            .iter()
            .find(|a| a.name.contains(arch_keyword) && a.name.ends_with(".tar.gz"))
        {
            return Some(a);
        }

        // 5. Universal .tar.gz
        if let Some(a) = assets
            .iter()
            .find(|a| a.name.contains("universal") && a.name.ends_with(".tar.gz"))
        {
            return Some(a);
        }

        // 6. Universal DMG
        if let Some(a) = assets
            .iter()
            .find(|a| a.name.contains("universal") && a.name.ends_with(".dmg"))
        {
            return Some(a);
        }

        // 7. Arch DMG
        if let Some(a) = assets
            .iter()
            .find(|a| a.name.contains(arch_keyword) && a.name.ends_with(".dmg"))
        {
            return Some(a);
        }

        // 8. Any DMG
        if let Some(a) = assets.iter().find(|a| a.name.ends_with(".dmg")) {
            return Some(a);
        }

        assets.first()
    }

    /// Check GitHub Releases API for updates
    pub async fn check_update() -> UpdateCheckResponse {
        let current_version = env!("CARGO_PKG_VERSION").to_string();
        let api_url = format!(
            "https://api.github.com/repos/{}/{}/releases/latest",
            Self::REPO_OWNER,
            Self::REPO_NAME
        );

        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                return UpdateCheckResponse {
                    has_update: false,
                    current_version: current_version.clone(),
                    latest_version: current_version,
                    release_notes: String::new(),
                    download_url: None,
                    asset_name: None,
                    asset_size_bytes: None,
                    published_at: None,
                    error_msg: Some(format!("Failed to build HTTP client: {}", e)),
                };
            }
        };

        let resp = match client
            .get(&api_url)
            .header(
                reqwest::header::USER_AGENT,
                format!("workstation-monitor/{}", current_version),
            )
            .header(
                reqwest::header::ACCEPT,
                "application/vnd.github.v3+json",
            )
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                return UpdateCheckResponse {
                    has_update: false,
                    current_version: current_version.clone(),
                    latest_version: current_version,
                    release_notes: String::new(),
                    download_url: None,
                    asset_name: None,
                    asset_size_bytes: None,
                    published_at: None,
                    error_msg: Some(format!("Network error checking updates: {}", e)),
                };
            }
        };

        if !resp.status().is_success() {
            return UpdateCheckResponse {
                has_update: false,
                current_version: current_version.clone(),
                latest_version: current_version,
                release_notes: String::new(),
                download_url: None,
                asset_name: None,
                asset_size_bytes: None,
                published_at: None,
                error_msg: Some(format!("GitHub API returned HTTP status: {}", resp.status())),
            };
        }

        let text = match resp.text().await {
            Ok(t) => t,
            Err(e) => {
                return UpdateCheckResponse {
                    has_update: false,
                    current_version: current_version.clone(),
                    latest_version: current_version,
                    release_notes: String::new(),
                    download_url: None,
                    asset_name: None,
                    asset_size_bytes: None,
                    published_at: None,
                    error_msg: Some(format!("Failed to read response body: {}", e)),
                };
            }
        };

        let release: GitHubReleaseResponse = match serde_json::from_str(&text) {
            Ok(rel) => rel,
            Err(e) => {
                return UpdateCheckResponse {
                    has_update: false,
                    current_version: current_version.clone(),
                    latest_version: current_version,
                    release_notes: String::new(),
                    download_url: None,
                    asset_name: None,
                    asset_size_bytes: None,
                    published_at: None,
                    error_msg: Some(format!("Failed to parse GitHub release JSON: {}", e)),
                };
            }
        };

        let raw_latest_tag = release.tag_name;
        let clean_latest = raw_latest_tag.trim_start_matches('v').to_string();
        let has_update = Self::is_newer_version(&current_version, &clean_latest);

        let target_arch = std::env::consts::ARCH;
        let chosen_asset = Self::pick_best_asset(&release.assets, target_arch);

        UpdateCheckResponse {
            has_update,
            current_version,
            latest_version: format!("v{}", clean_latest),
            release_notes: release
                .body
                .unwrap_or_else(|| "No release notes provided.".to_string()),
            download_url: chosen_asset.map(|a| a.browser_download_url.clone()),
            asset_name: chosen_asset.map(|a| a.name.clone()),
            asset_size_bytes: chosen_asset.map(|a| a.size),
            published_at: release.published_at,
            error_msg: None,
        }
    }

    /// Perform in-place atomic self-upgrade and spawn new process
    pub async fn apply_update(download_url: Option<String>) -> Result<String, String> {
        let current_exe =
            std::env::current_exe().map_err(|e| format!("Cannot find current exe: {}", e))?;

        let target_url = match download_url {
            Some(u) if !u.is_empty() => u,
            _ => {
                let check = Self::check_update().await;
                check
                    .download_url
                    .ok_or_else(|| "No downloadable asset found in latest release".to_string())?
            }
        };

        tracing::info!("Downloading update package from: {}", target_url);

        // 1. Download asset to temporary directory
        let tmp_dir = PathBuf::from("/tmp/workstation_update");
        let _ = std::fs::remove_dir_all(&tmp_dir);
        std::fs::create_dir_all(&tmp_dir)
            .map_err(|e| format!("Failed to create tmp dir: {}", e))?;

        let downloaded_file = tmp_dir.join("update_package.bin");

        // Dual-Engine Download Strategy:
        // Try Reqwest with redirect & gzip support first, with automatic fallback to native curl.
        let mut download_success = false;
        let client_res = reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build();

        if let Ok(client) = client_res {
            if let Ok(resp) = client
                .get(&target_url)
                .header(reqwest::header::USER_AGENT, "workstation-monitor-updater")
                .header(reqwest::header::ACCEPT, "*/*")
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        if !bytes.is_empty() && std::fs::write(&downloaded_file, &bytes).is_ok() {
                            download_success = true;
                        }
                    }
                }
            }
        }

        // Robust Fallback: macOS built-in curl
        if !download_success {
            tracing::warn!("Reqwest download failed or decoding error, falling back to /usr/bin/curl");
            let curl_status = Command::new("/usr/bin/curl")
                .args([
                    "-fSL",
                    "--retry", "3",
                    "--connect-timeout", "15",
                    "-o", downloaded_file.to_str().unwrap(),
                    &target_url,
                ])
                .status()
                .map_err(|e| format!("Failed to invoke /usr/bin/curl: {}", e))?;

            if !curl_status.success() {
                return Err(format!("Download failed for URL: {}", target_url));
            }
        }

        // 2. Extract package
        let extract_dir = tmp_dir.join("extracted");
        let _ = std::fs::create_dir_all(&extract_dir);

        if target_url.ends_with(".zip") || target_url.ends_with(".app.zip") {
            // Unzip with macOS ditto
            let status = Command::new("ditto")
                .args(["-x", "-k", downloaded_file.to_str().unwrap(), extract_dir.to_str().unwrap()])
                .status()
                .map_err(|e| format!("Failed to execute ditto for unzip: {}", e))?;

            if !status.success() {
                return Err("ditto decompression failed".to_string());
            }
        } else if target_url.ends_with(".tar.gz") {
            let status = Command::new("tar")
                .args(["-xzf", downloaded_file.to_str().unwrap(), "-C", extract_dir.to_str().unwrap()])
                .status()
                .map_err(|e| format!("Failed to execute tar: {}", e))?;

            if !status.success() {
                return Err("tar decompression failed".to_string());
            }
        } else {
            // Direct binary download fallback
            let _ = std::fs::copy(&downloaded_file, extract_dir.join("workstation-monitor"));
        }

        // 3. Locate new binary inside extracted files
        let new_binary = Self::find_binary_recursive(&extract_dir)
            .ok_or_else(|| "Could not locate 'workstation-monitor' executable in update archive".to_string())?;

        // 4. Hot-swap replacement
        let old_exe_bak = PathBuf::from(format!("{}.old", current_exe.display()));
        let _ = std::fs::remove_file(&old_exe_bak);

        // Rename current running executable to .old
        std::fs::rename(&current_exe, &old_exe_bak)
            .map_err(|e| format!("Failed to move current exe to .old: {}", e))?;

        // Copy new executable into current_exe destination
        if let Err(e) = std::fs::copy(&new_binary, &current_exe) {
            // Rollback on failure
            let _ = std::fs::rename(&old_exe_bak, &current_exe);
            return Err(format!("Failed to copy new binary to destination: {}", e));
        }

        // Ensure executable permissions and strip macOS quarantine
        #[cfg(target_family = "unix")]
        {
            if let Ok(metadata) = std::fs::metadata(&current_exe) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&current_exe, perms);
            }
            let _ = Command::new("/usr/bin/xattr")
                .args(["-cr", current_exe.to_str().unwrap()])
                .status();
            let _ = Command::new("/usr/bin/codesign")
                .args(["-f", "-s", "-", current_exe.to_str().unwrap()])
                .status();
        }

        // 5. Clean up temporary files
        let _ = std::fs::remove_dir_all(&tmp_dir);

        // 6. Schedule detached supervisor restart to prevent port conflict
        let current_exe_str = current_exe.to_string_lossy().to_string();
        let is_app_bundle = current_exe_str.contains(".app/Contents/MacOS");

        let restart_cmd = if is_app_bundle {
            let mut app_path = current_exe.clone();
            app_path.pop(); // MacOS
            app_path.pop(); // Contents
            let _ = Command::new("/usr/bin/xattr")
                .args(["-cr", app_path.to_str().unwrap()])
                .status();
            format!("sleep 1.2 && (open -n '{}' || '{}')", app_path.display(), current_exe.display())
        } else {
            format!("sleep 1.2 && '{}'", current_exe.display())
        };

        tracing::info!("Spawning detached restart supervisor: {}", restart_cmd);
        let _ = Command::new("/bin/sh")
            .args(["-c", &format!("({} >/dev/null 2>&1 &)", restart_cmd)])
            .spawn();

        // 7. Exit old process after brief flush window so port is freed before new process binds
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            tracing::info!("Old process exiting cleanly to release port...");
            std::process::exit(0);
        });

        Ok("Update successfully installed. Server is restarting into the new version...".to_string())
    }

    fn find_binary_recursive(dir: &Path) -> Option<PathBuf> {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.file_name().map_or(false, |n| n == "workstation-monitor") {
                    return Some(path);
                }
                if path.is_dir() {
                    if let Some(found) = Self::find_binary_recursive(&path) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparison() {
        assert!(AutoUpdater::is_newer_version("0.1.0", "0.1.1"));
        assert!(AutoUpdater::is_newer_version("0.1.1", "0.1.2"));
        assert!(AutoUpdater::is_newer_version("0.1.1", "0.2.0"));
        assert!(AutoUpdater::is_newer_version("0.1.1", "1.0.0"));
        assert!(!AutoUpdater::is_newer_version("0.1.1", "0.1.1"));
        assert!(!AutoUpdater::is_newer_version("0.1.2", "0.1.1"));
        assert!(!AutoUpdater::is_newer_version("1.0.0", "0.9.9"));
    }

    #[test]
    fn test_pick_best_asset() {
        let assets = vec![
            GitHubReleaseAsset {
                name: "Workstation_Monitor_0.1.3_x64.app.zip".to_string(),
                size: 3300000,
                browser_download_url: "https://.../x64.app.zip".to_string(),
            },
            GitHubReleaseAsset {
                name: "Workstation_Monitor_0.1.3_universal.app.zip".to_string(),
                size: 6500000,
                browser_download_url: "https://.../universal.app.zip".to_string(),
            },
            GitHubReleaseAsset {
                name: "Workstation_Monitor_0.1.3_aarch64.app.zip".to_string(),
                size: 3200000,
                browser_download_url: "https://.../aarch64.app.zip".to_string(),
            },
        ];

        let best_arm = AutoUpdater::pick_best_asset(&assets, "aarch64").expect("asset found");
        assert_eq!(best_arm.name, "Workstation_Monitor_0.1.3_aarch64.app.zip");

        let best_intel = AutoUpdater::pick_best_asset(&assets, "x86_64").expect("asset found");
        assert_eq!(best_intel.name, "Workstation_Monitor_0.1.3_x64.app.zip");
    }
}
