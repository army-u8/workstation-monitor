#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};

pub struct AutoUpdater;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "status", content = "payload")]
pub enum UpdateProgress {
    Idle,
    Checking,
    Downloading {
        percent: u8,
        downloaded_bytes: u64,
        total_bytes: u64,
    },
    Extracting {
        step: String,
    },
    Replacing,
    Restarting {
        countdown_sec: u8,
    },
    Failed {
        error: String,
    },
    Success {
        message: String,
    },
}

static UPDATE_PROGRESS: RwLock<UpdateProgress> = RwLock::new(UpdateProgress::Idle);
static UPDATE_LOCK: AtomicBool = AtomicBool::new(false);
static UPDATE_FILE_SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionBackupInfo {
    pub version: String,
    pub filename: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

struct TemporaryFileGuard {
    path: PathBuf,
    cleanup: bool,
}

impl TemporaryFileGuard {
    fn new(path: PathBuf) -> Self {
        Self {
            path,
            cleanup: true,
        }
    }

    fn handoff(&mut self) {
        self.cleanup = false;
    }
}

impl Drop for TemporaryFileGuard {
    fn drop(&mut self) {
        if self.cleanup {
            match std::fs::remove_file(&self.path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => tracing::warn!(
                    "Failed to clean updater temporary file {}: {error}",
                    self.path.display()
                ),
            }
        }
    }
}

struct UpdateLockGuard<'a> {
    lock: &'a AtomicBool,
}

impl<'a> UpdateLockGuard<'a> {
    fn try_acquire(lock: &'a AtomicBool) -> Result<Self, String> {
        lock.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self { lock })
            .map_err(|_| {
                "An update is already in progress. Please wait for completion.".to_string()
            })
    }

    fn handoff(self) -> UpdateLockHandoff<'a> {
        UpdateLockHandoff { _guard: self }
    }
}

impl Drop for UpdateLockGuard<'_> {
    fn drop(&mut self) {
        self.lock.store(false, Ordering::SeqCst);
    }
}

struct UpdateLockHandoff<'a> {
    _guard: UpdateLockGuard<'a>,
}

impl AutoUpdater {
    pub const REPO_OWNER: &'static str = "army-u8";
    pub const REPO_NAME: &'static str = "workstation-monitor";

    fn record_operation_result<T>(result: Result<T, String>) -> Result<T, String> {
        if let Err(error) = &result {
            Self::set_progress(UpdateProgress::Failed {
                error: error.clone(),
            });
        }
        result
    }

    fn validate_release_download_url_for_arch(
        input: &str,
        target_arch: &str,
    ) -> Result<reqwest::Url, String> {
        let url = reqwest::Url::parse(input).map_err(|_| {
            "Invalid update URL: expected an official GitHub release asset".to_string()
        })?;

        if url.scheme() != "https"
            || url.host_str() != Some("github.com")
            || url.port().is_some()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(
                "Invalid update URL: expected an official HTTPS GitHub release asset".to_string(),
            );
        }

        let segments = url
            .path_segments()
            .map(|parts| parts.collect::<Vec<_>>())
            .unwrap_or_default();
        if segments.len() != 6
            || segments[0] != Self::REPO_OWNER
            || segments[1] != Self::REPO_NAME
            || segments[2] != "releases"
            || segments[3] != "download"
        {
            return Err(
                "Invalid update URL: release asset does not belong to the official repository"
                    .to_string(),
            );
        }

        let version = segments[4]
            .strip_prefix('v')
            .filter(|value| {
                !value.is_empty()
                    && value.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'+')
                    })
            })
            .ok_or_else(|| "Invalid update URL: malformed release version".to_string())?;

        let arch = if target_arch.contains("aarch64") || target_arch.contains("arm64") {
            "aarch64"
        } else if target_arch.contains("x86_64") || target_arch.contains("x64") {
            "x64"
        } else {
            "universal"
        };
        let allowed_names = [
            format!("Workstation_Monitor_{version}_{arch}.app.zip"),
            format!("Workstation_Monitor_{version}_{arch}.app.tar.gz"),
            format!("Workstation_Monitor_{version}_universal.app.zip"),
            format!("Workstation_Monitor_{version}_universal.app.tar.gz"),
        ];
        if !allowed_names.iter().any(|name| name == segments[5]) {
            return Err(
                "Invalid update URL: asset name or architecture is not supported".to_string(),
            );
        }

        Ok(url)
    }

    fn is_allowed_download_redirect(url: &reqwest::Url) -> bool {
        url.scheme() == "https"
            && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none()
            && matches!(
                url.host_str(),
                Some("release-assets.githubusercontent.com" | "objects.githubusercontent.com")
            )
    }

    fn restart_script_content() -> &'static str {
        r#"#!/bin/sh
# Detached supervisor: start the replacement only after the old process exits,
# verify its health, and automatically restore the previous executable on failure.
sleep 1.5
TARGET="$1"
PREVIOUS="$2"
CWD="$3"
PORT_VALUE="$4"
cd "$CWD" 2>/dev/null || cd / || exit 1
export PORT="$PORT_VALUE"
export WORKSTATION_NO_OPEN="1"
BIND_VALUE="${WORKSTATION_BIND_ADDR:-127.0.0.1}"
case "$BIND_VALUE" in
    0.0.0.0) HEALTH_HOST="127.0.0.1" ;;
    ::) HEALTH_HOST="[::1]" ;;
    *:*) HEALTH_HOST="[${BIND_VALUE}]" ;;
    *) HEALTH_HOST="$BIND_VALUE" ;;
esac
/usr/bin/xattr -cr "$TARGET" 2>/dev/null || true
"$TARGET" --no-open >/dev/null 2>&1 &
NEW_PID=$!

ATTEMPT=0
while [ "$ATTEMPT" -lt 30 ]; do
    if ! /bin/kill -0 "$NEW_PID" 2>/dev/null; then
        break
    fi
    if /usr/bin/curl --noproxy '*' --fail --silent --max-time 1 "http://${HEALTH_HOST}:${PORT_VALUE}/api/status" >/dev/null 2>&1; then
        /bin/rm -f "$PREVIOUS" 2>/dev/null || true
        /bin/rm -f "$0" 2>/dev/null || true
        exit 0
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
done

/bin/kill "$NEW_PID" 2>/dev/null || true
wait "$NEW_PID" 2>/dev/null || true
FAILED_TARGET="${TARGET}.failed"
/bin/rm -f "$FAILED_TARGET" 2>/dev/null || true
if /bin/mv "$TARGET" "$FAILED_TARGET"; then
    if /bin/mv "$PREVIOUS" "$TARGET"; then
        "$TARGET" --no-open >/dev/null 2>&1 &
        /bin/rm -f "$FAILED_TARGET" 2>/dev/null || true
    else
        /bin/mv "$FAILED_TARGET" "$TARGET" 2>/dev/null || true
    fi
fi
/bin/rm -f "$0" 2>/dev/null || true
exit 1
"#
    }

    fn build_restart_command(
        script_path: &Path,
        executable: &Path,
        previous_executable: &Path,
        current_dir: &Path,
        port: &str,
    ) -> Command {
        let mut command = Command::new("/bin/sh");
        command
            .arg(script_path)
            .arg(executable)
            .arg(previous_executable)
            .arg(current_dir)
            .arg(port);
        command
    }

    fn remove_file_if_present(path: &Path) -> Result<(), String> {
        match std::fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("Failed to remove {}: {error}", path.display())),
        }
    }

    fn unique_sibling_path(target: &Path, marker: &str) -> Result<PathBuf, String> {
        let parent = target
            .parent()
            .ok_or_else(|| format!("Path has no parent directory: {}", target.display()))?;
        let filename = target
            .file_name()
            .ok_or_else(|| format!("Path has no filename: {}", target.display()))?;
        let sequence = UPDATE_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let mut temporary_name = std::ffi::OsString::from(".");
        temporary_name.push(filename);
        temporary_name.push(format!(".{marker}-{}-{sequence}", std::process::id()));
        Ok(parent.join(temporary_name))
    }

    fn archive_executable_atomically(source: &Path, target: &Path) -> Result<(), String> {
        let source_metadata = std::fs::metadata(source).map_err(|error| {
            format!(
                "Failed to inspect archive source {}: {error}",
                source.display()
            )
        })?;
        if !source_metadata.is_file() {
            return Err(format!(
                "Archive source is not a regular file: {}",
                source.display()
            ));
        }

        let temporary = Self::unique_sibling_path(target, "partial")?;
        let _temporary_guard = TemporaryFileGuard::new(temporary.clone());
        let result = (|| -> Result<(), String> {
            let mut source_file = std::fs::File::open(source)
                .map_err(|error| format!("Failed to open archive source: {error}"))?;
            let mut temporary_file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)
                .map_err(|error| format!("Failed to create temporary version archive: {error}"))?;
            std::io::copy(&mut source_file, &mut temporary_file)
                .map_err(|error| format!("Failed to write temporary version archive: {error}"))?;

            #[cfg(target_family = "unix")]
            {
                let mut permissions = temporary_file
                    .metadata()
                    .map_err(|error| format!("Failed to inspect temporary archive: {error}"))?
                    .permissions();
                permissions.set_mode(0o755);
                std::fs::set_permissions(&temporary, permissions).map_err(|error| {
                    format!("Failed to make version archive executable: {error}")
                })?;
            }
            temporary_file
                .sync_all()
                .map_err(|error| format!("Failed to flush temporary version archive: {error}"))?;
            std::fs::rename(&temporary, target).map_err(|error| {
                format!("Failed to publish version archive atomically: {error}")
            })?;
            if let Some(parent) = target.parent() {
                std::fs::File::open(parent)
                    .and_then(|directory| directory.sync_all())
                    .map_err(|error| {
                        format!("Failed to flush version archive directory: {error}")
                    })?;
            }
            Ok(())
        })();

        result
    }

    fn valid_backup_version(filename: &str) -> Option<String> {
        let version = filename.strip_prefix("workstation-monitor-v")?;
        let (without_build, build) = version
            .split_once('+')
            .map_or((version, None), |(left, right)| (left, Some(right)));
        let (core, prerelease) = without_build
            .split_once('-')
            .map_or((without_build, None), |(left, right)| (left, Some(right)));
        let core_parts = core.split('.').collect::<Vec<_>>();
        if core_parts.len() != 3
            || core_parts
                .iter()
                .any(|part| part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_digit()))
        {
            return None;
        }
        let valid_suffix = |suffix: &str| {
            !suffix.is_empty()
                && suffix.split('.').all(|part| {
                    !part.is_empty()
                        && part
                            .bytes()
                            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                })
        };
        if prerelease.is_some_and(|value| !valid_suffix(value))
            || build.is_some_and(|value| !valid_suffix(value))
        {
            return None;
        }
        Some(version.to_string())
    }

    fn staged_executable_path(current_executable: &Path) -> Result<PathBuf, String> {
        Self::unique_sibling_path(current_executable, "update")
    }

    fn prepare_executable_replacement(
        candidate: &Path,
        current_executable: &Path,
        archive_target: Option<&Path>,
    ) -> Result<PathBuf, String> {
        let candidate_metadata = std::fs::metadata(candidate).map_err(|error| {
            format!(
                "Failed to inspect update candidate {}: {error}",
                candidate.display()
            )
        })?;
        if !candidate_metadata.is_file() {
            return Err(format!(
                "Update candidate is not a regular file: {}",
                candidate.display()
            ));
        }
        std::fs::metadata(current_executable).map_err(|error| {
            format!(
                "Failed to inspect current executable {}: {error}",
                current_executable.display()
            )
        })?;

        let staged = Self::staged_executable_path(current_executable)?;
        let mut staged_guard = TemporaryFileGuard::new(staged.clone());
        std::fs::copy(candidate, &staged).map_err(|error| {
            format!(
                "Failed to stage update candidate at {}: {error}",
                staged.display()
            )
        })?;

        let preparation_result = (|| -> Result<(), String> {
            #[cfg(target_family = "unix")]
            {
                let mut permissions = std::fs::metadata(&staged)
                    .map_err(|error| format!("Failed to inspect staged executable: {error}"))?
                    .permissions();
                permissions.set_mode(0o755);
                std::fs::set_permissions(&staged, permissions)
                    .map_err(|error| format!("Failed to make staged update executable: {error}"))?;
            }

            std::fs::File::open(&staged)
                .and_then(|file| file.sync_all())
                .map_err(|error| format!("Failed to flush staged update to disk: {error}"))?;

            if let Some(archive_target) = archive_target {
                Self::archive_executable_atomically(current_executable, archive_target)?;
            }
            Ok(())
        })();

        preparation_result?;
        staged_guard.handoff();
        Ok(staged)
    }

    fn prepare_rollback_replacement(
        candidate: &Path,
        current_executable: &Path,
        versions_dir: &Path,
        current_version: &str,
    ) -> Result<PathBuf, String> {
        std::fs::create_dir_all(versions_dir).map_err(|error| {
            format!(
                "Failed to create version archive directory {}: {error}",
                versions_dir.display()
            )
        })?;
        let archive_target =
            versions_dir.join(format!("workstation-monitor-v{current_version}"));
        Self::prepare_executable_replacement(
            candidate,
            current_executable,
            Some(&archive_target),
        )
    }

    fn commit_prepared_executable(
        staged: &Path,
        current_executable: &Path,
    ) -> Result<PathBuf, String> {
        let old_executable = PathBuf::from(format!("{}.old", current_executable.display()));
        Self::remove_file_if_present(&old_executable)?;
        std::fs::rename(current_executable, &old_executable).map_err(|error| {
            format!(
                "Failed to move current executable to {}: {error}",
                old_executable.display()
            )
        })?;

        if let Err(install_error) = std::fs::rename(staged, current_executable) {
            return match std::fs::rename(&old_executable, current_executable) {
                Ok(()) => Err(format!(
                    "Failed to install staged update; previous executable was restored: {install_error}"
                )),
                Err(restore_error) => Err(format!(
                    "Failed to install staged update ({install_error}) and failed to restore previous executable ({restore_error})"
                )),
            };
        }

        Ok(old_executable)
    }

    fn restore_previous_executable(
        current_executable: &Path,
        previous_executable: &Path,
    ) -> Result<(), String> {
        let failed_update = PathBuf::from(format!(
            "{}.failed-update-{}",
            current_executable.display(),
            std::process::id()
        ));
        Self::remove_file_if_present(&failed_update)?;
        std::fs::rename(current_executable, &failed_update).map_err(|error| {
            format!(
                "Failed to move unusable update aside at {}: {error}",
                failed_update.display()
            )
        })?;

        if let Err(restore_error) = std::fs::rename(previous_executable, current_executable) {
            return match std::fs::rename(&failed_update, current_executable) {
                Ok(()) => Err(format!(
                    "Failed to restore previous executable; the new executable remains installed: {restore_error}"
                )),
                Err(recover_new_error) => Err(format!(
                    "Failed to restore previous executable ({restore_error}) and failed to recover the new executable ({recover_new_error})"
                )),
            };
        }

        Self::remove_file_if_present(&failed_update)
    }

    fn current_restart_port() -> String {
        std::env::args()
            .nth(1)
            .and_then(|value| value.parse::<u16>().ok())
            .or_else(|| {
                std::env::var("PORT")
                    .ok()
                    .and_then(|value| value.parse::<u16>().ok())
            })
            .unwrap_or(9527)
            .to_string()
    }

    fn write_restart_script(path: &Path) -> Result<(), String> {
        std::fs::write(path, Self::restart_script_content())
            .map_err(|error| format!("Failed to write restart supervisor script: {error}"))?;
        #[cfg(target_family = "unix")]
        {
            let mut permissions = std::fs::metadata(path)
                .map_err(|error| format!("Failed to inspect restart script: {error}"))?
                .permissions();
            permissions.set_mode(0o700);
            std::fs::set_permissions(path, permissions)
                .map_err(|error| format!("Failed to secure restart script permissions: {error}"))?;
        }
        Ok(())
    }

    #[cfg(target_family = "unix")]
    fn launch_restart_supervisor(
        script_path: &Path,
        current_executable: &Path,
        previous_executable: &Path,
        current_dir: &Path,
        port: &str,
    ) -> Result<(), String> {
        use std::os::unix::process::CommandExt;

        let mut command = Self::build_restart_command(
            script_path,
            current_executable,
            previous_executable,
            current_dir,
            port,
        );
        unsafe {
            command.pre_exec(|| {
                if libc::setsid() == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
        command
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Failed to launch restart supervisor: {error}"))
    }

    /// Get current real-time update progress
    pub fn get_progress() -> UpdateProgress {
        UPDATE_PROGRESS
            .read()
            .map(|p| p.clone())
            .unwrap_or(UpdateProgress::Idle)
    }

    /// Set current real-time update progress
    pub fn set_progress(progress: UpdateProgress) {
        if let Ok(mut lock) = UPDATE_PROGRESS.write() {
            *lock = progress;
        }
    }

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

    /// Check GitHub Releases API for updates (with automatic fallback to web releases redirect)
    pub async fn check_update() -> UpdateCheckResponse {
        Self::set_progress(UpdateProgress::Checking);
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
                let res = Self::fallback_web_check(
                    &current_version,
                    Some(format!("Failed to build HTTP client: {}", e)),
                )
                .await;
                Self::set_progress(UpdateProgress::Idle);
                return res;
            }
        };

        let mut req = client
            .get(&api_url)
            .header(
                reqwest::header::USER_AGENT,
                format!("workstation-monitor/{}", current_version),
            )
            .header(reqwest::header::ACCEPT, "application/vnd.github.v3+json");

        if let Ok(token) = std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN")) {
            if !token.trim().is_empty() {
                req = req.header(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {}", token.trim()),
                );
            }
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let res = Self::fallback_web_check(
                    &current_version,
                    Some(format!("Network error: {}", e)),
                )
                .await;
                Self::set_progress(UpdateProgress::Idle);
                return res;
            }
        };

        if !resp.status().is_success() {
            // 403 Rate Limit or 404 - Seamlessly fallback to Web Redirect
            let res = Self::fallback_web_check(&current_version, None).await;
            Self::set_progress(UpdateProgress::Idle);
            return res;
        }

        let text = match resp.text().await {
            Ok(t) => t,
            Err(_) => {
                let res = Self::fallback_web_check(&current_version, None).await;
                Self::set_progress(UpdateProgress::Idle);
                return res;
            }
        };

        let release: GitHubReleaseResponse = match serde_json::from_str(&text) {
            Ok(rel) => rel,
            Err(_) => {
                let res = Self::fallback_web_check(&current_version, None).await;
                Self::set_progress(UpdateProgress::Idle);
                return res;
            }
        };

        let raw_latest_tag = release.tag_name;
        let clean_latest = raw_latest_tag.trim_start_matches('v').to_string();
        let has_update = Self::is_newer_version(&current_version, &clean_latest);

        let target_arch = std::env::consts::ARCH;
        let chosen_asset = Self::pick_best_asset(&release.assets, target_arch);

        Self::set_progress(UpdateProgress::Idle);
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

    /// Fallback release checker querying GitHub Web Redirect when API rate limit (403) is hit
    async fn fallback_web_check(
        current_version: &str,
        initial_err: Option<String>,
    ) -> UpdateCheckResponse {
        let web_url = format!(
            "https://github.com/{}/{}/releases/latest",
            Self::REPO_OWNER,
            Self::REPO_NAME
        );

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build();

        let latest_tag = if let Ok(client) = client {
            if let Ok(resp) = client.get(&web_url).send().await {
                let final_url = resp.url().as_str();
                if let Some(pos) = final_url.rfind("/tag/") {
                    Some(final_url[pos + 5..].trim().to_string())
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        // Fallback using curl if reqwest redirect inspection was inconclusive
        let latest_tag = latest_tag.or_else(|| {
            let output = Command::new("/usr/bin/curl")
                .args(["-sI", &web_url])
                .output()
                .ok()?;
            let out_str = String::from_utf8_lossy(&output.stdout);
            for line in out_str.lines() {
                if line.to_lowercase().starts_with("location:") {
                    if let Some(pos) = line.rfind("/tag/") {
                        return Some(line[pos + 5..].trim().to_string());
                    }
                }
            }
            None
        });

        if let Some(tag) = latest_tag {
            let clean_latest = tag.trim_start_matches('v').to_string();
            let has_update = Self::is_newer_version(current_version, &clean_latest);
            let target_arch = match std::env::consts::ARCH {
                "aarch64" => "aarch64",
                "x86_64" => "x64",
                _ => "universal",
            };
            let asset_name = format!(
                "Workstation_Monitor_{}_{}.app.zip",
                clean_latest, target_arch
            );
            let download_url = format!(
                "https://github.com/{}/{}/releases/download/v{}/{}",
                Self::REPO_OWNER,
                Self::REPO_NAME,
                clean_latest,
                asset_name
            );

            UpdateCheckResponse {
                has_update,
                current_version: current_version.to_string(),
                latest_version: format!("v{}", clean_latest),
                release_notes: format!("✨ 发现新版本 v{}！可通过热更新一键升级。", clean_latest),
                download_url: Some(download_url),
                asset_name: Some(asset_name),
                asset_size_bytes: Some(3400000),
                published_at: None,
                error_msg: None,
            }
        } else {
            UpdateCheckResponse {
                has_update: false,
                current_version: current_version.to_string(),
                latest_version: current_version.to_string(),
                release_notes: String::new(),
                download_url: None,
                asset_name: None,
                asset_size_bytes: None,
                published_at: None,
                error_msg: initial_err
                    .or_else(|| Some("Unable to reach GitHub release servers.".to_string())),
            }
        }
    }

    /// Directory for archiving previous versions for 1-click rollback
    pub fn versions_backup_dir() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let dir = PathBuf::from(home)
            .join(".workstation-monitor")
            .join("versions");
        let _ = std::fs::create_dir_all(&dir);
        dir
    }

    /// List archived past versions
    pub fn list_version_backups() -> Vec<VersionBackupInfo> {
        let dir = Self::versions_backup_dir();
        Self::list_version_backups_in(&dir)
    }

    fn list_version_backups_in(dir: &Path) -> Vec<VersionBackupInfo> {
        let mut list = Vec::new();

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if entry
                    .file_type()
                    .map(|kind| kind.is_file())
                    .unwrap_or(false)
                {
                    let filename = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let Some(version) = Self::valid_backup_version(&filename) else {
                        continue;
                    };
                    let Ok(metadata) = entry.metadata() else {
                        continue;
                    };
                    if metadata.len() == 0 {
                        continue;
                    }
                    #[cfg(target_family = "unix")]
                    if metadata.permissions().mode() & 0o111 == 0 {
                        continue;
                    }
                    let size_bytes = metadata.len();
                    let created_at = metadata
                        .modified()
                        .map(|t| {
                            chrono::DateTime::<chrono::Utc>::from(t)
                                .format("%Y-%m-%d %H:%M:%S UTC")
                                .to_string()
                        })
                        .unwrap_or_default();

                    list.push(VersionBackupInfo {
                        version,
                        filename,
                        file_path: path.to_string_lossy().to_string(),
                        size_bytes,
                        created_at,
                    });
                }
            }
        }

        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    /// Perform in-place atomic self-upgrade and spawn new process (with Concurrency Lock and Rollback Archiving)
    pub async fn apply_update(download_url: Option<String>) -> Result<String, String> {
        let update_guard = UpdateLockGuard::try_acquire(&UPDATE_LOCK)?;
        let result = Self::apply_update_locked(download_url, update_guard).await;
        Self::record_operation_result(result)
    }

    async fn apply_update_locked(
        download_url: Option<String>,
        update_guard: UpdateLockGuard<'static>,
    ) -> Result<String, String> {
        let current_exe = std::env::current_exe().map_err(|e| {
            Self::set_progress(UpdateProgress::Failed {
                error: format!("Cannot find current exe: {}", e),
            });
            format!("Cannot find current exe: {}", e)
        })?;

        let target_url = match download_url {
            Some(u) if !u.is_empty() => u,
            _ => {
                let check = Self::check_update().await;
                check.download_url.ok_or_else(|| {
                    Self::set_progress(UpdateProgress::Failed {
                        error: "No downloadable asset found in latest release".to_string(),
                    });
                    "No downloadable asset found in latest release".to_string()
                })?
            }
        };
        let target_url =
            Self::validate_release_download_url_for_arch(&target_url, std::env::consts::ARCH)
                .map_err(|error| {
                    Self::set_progress(UpdateProgress::Failed {
                        error: error.clone(),
                    });
                    error
                })?;

        tracing::info!("Downloading update package from: {}", target_url);
        Self::set_progress(UpdateProgress::Downloading {
            percent: 10,
            downloaded_bytes: 350000,
            total_bytes: 3500000,
        });

        // 1. Download asset to temporary directory
        let unique_suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        let tmp_dir = std::env::temp_dir().join(format!(
            "workstation_update_{}_{}",
            std::process::id(),
            unique_suffix
        ));
        std::fs::create_dir(&tmp_dir).map_err(|e| format!("Failed to create tmp dir: {}", e))?;

        struct TempDirGuard(PathBuf);
        impl Drop for TempDirGuard {
            fn drop(&mut self) {
                if let Err(error) = std::fs::remove_dir_all(&self.0) {
                    tracing::warn!("Failed to remove updater temp directory: {error}");
                }
            }
        }
        let _tmp_guard = TempDirGuard(tmp_dir.clone());

        let downloaded_file = tmp_dir.join("update_package.bin");

        // Download only from the official release URL. Every redirect is restricted to
        // GitHub's dedicated release-asset hosts so a mirror cannot replace the binary.
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 10 {
                    return attempt.error("too many update download redirects");
                }
                if AutoUpdater::is_allowed_download_redirect(attempt.url()) {
                    attempt.follow()
                } else {
                    attempt.error("update redirect target is not an official GitHub asset host")
                }
            }))
            .build()
            .map_err(|error| format!("Failed to build secure update client: {error}"))?;
        let response = client
            .get(target_url.clone())
            .header(reqwest::header::USER_AGENT, "workstation-monitor-updater")
            .header(reqwest::header::ACCEPT, "*/*")
            .send()
            .await
            .map_err(|error| format!("Official release download failed: {error}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "Official release download failed with HTTP {}",
                response.status()
            ));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|error| format!("Failed to read official release asset: {error}"))?;
        if bytes.is_empty() {
            return Err("Official release asset was empty".to_string());
        }
        std::fs::write(&downloaded_file, &bytes)
            .map_err(|error| format!("Failed to persist downloaded update: {error}"))?;
        Self::set_progress(UpdateProgress::Downloading {
            percent: 100,
            downloaded_bytes: bytes.len() as u64,
            total_bytes: bytes.len() as u64,
        });

        // 2. Extract package
        Self::set_progress(UpdateProgress::Extracting {
            step: "正在解压并校验资源包...".to_string(),
        });
        let extract_dir = tmp_dir.join("extracted");
        std::fs::create_dir(&extract_dir)
            .map_err(|error| format!("Failed to create extraction directory: {error}"))?;

        if target_url.path().ends_with(".app.zip") {
            // Unzip with macOS ditto
            let status = Command::new("ditto")
                .args([
                    "-x",
                    "-k",
                    downloaded_file.to_str().unwrap(),
                    extract_dir.to_str().unwrap(),
                ])
                .status()
                .map_err(|e| format!("Failed to execute ditto for unzip: {}", e))?;

            if !status.success() {
                Self::set_progress(UpdateProgress::Failed {
                    error: "ditto decompression failed".to_string(),
                });
                return Err("ditto decompression failed".to_string());
            }
        } else if target_url.path().ends_with(".app.tar.gz") {
            let status = Command::new("tar")
                .args([
                    "-xzf",
                    downloaded_file.to_str().unwrap(),
                    "-C",
                    extract_dir.to_str().unwrap(),
                ])
                .status()
                .map_err(|e| format!("Failed to execute tar: {}", e))?;

            if !status.success() {
                Self::set_progress(UpdateProgress::Failed {
                    error: "tar decompression failed".to_string(),
                });
                return Err("tar decompression failed".to_string());
            }
        } else {
            return Err("Unsupported update package format".to_string());
        }

        // 3. Locate new binary inside extracted files
        let new_binary = Self::find_binary_recursive(&extract_dir).ok_or_else(|| {
            Self::set_progress(UpdateProgress::Failed {
                error: "Could not locate 'workstation-monitor' executable in update archive"
                    .to_string(),
            });
            "Could not locate 'workstation-monitor' executable in update archive".to_string()
        })?;

        // 4. Archive current running executable to Version History for 1-Click Rollback
        Self::set_progress(UpdateProgress::Replacing);
        let backup_dir = Self::versions_backup_dir();
        let current_version = env!("CARGO_PKG_VERSION");
        let archive_target = backup_dir.join(format!("workstation-monitor-v{}", current_version));
        let staged_executable =
            Self::prepare_executable_replacement(&new_binary, &current_exe, Some(&archive_target))?;
        let _staged_guard = TemporaryFileGuard::new(staged_executable.clone());

        // Perform platform preparation before changing the running executable.
        #[cfg(target_family = "unix")]
        {
            let xattr_status = Command::new("/usr/bin/xattr")
                .arg("-cr")
                .arg(&staged_executable)
                .status()
                .map_err(|error| format!("Failed to invoke xattr for staged update: {error}"))?;
            if !xattr_status.success() {
                return Err("Failed to clear quarantine metadata from staged update".to_string());
            }
            let codesign_status = Command::new("/usr/bin/codesign")
                .args(["-f", "-s", "-"])
                .arg(&staged_executable)
                .status()
                .map_err(|error| format!("Failed to invoke codesign for staged update: {error}"))?;
            if !codesign_status.success() {
                return Err("Failed to sign staged update executable".to_string());
            }
        }

        let restart_script_path = std::env::temp_dir().join(format!(
            "workstation_relaunch_{}_{}.sh",
            std::process::id(),
            unique_suffix
        ));
        let mut restart_script_guard = TemporaryFileGuard::new(restart_script_path.clone());
        Self::write_restart_script(&restart_script_path)?;
        let current_dir = std::env::current_dir()
            .map_err(|error| format!("Failed to determine restart working directory: {error}"))?;
        let current_port = Self::current_restart_port();
        let old_executable =
            match Self::commit_prepared_executable(&staged_executable, &current_exe) {
                Ok(path) => path,
                Err(error) => {
                    Self::set_progress(UpdateProgress::Failed {
                        error: error.clone(),
                    });
                    return Err(error);
                }
            };

        // 5. Launch the detached supervisor. Restore .old if it cannot be started.
        Self::set_progress(UpdateProgress::Restarting { countdown_sec: 3 });
        tracing::info!("Launching detached supervisor via setsid session");
        #[cfg(target_family = "unix")]
        {
            if let Err(launch_error) = Self::launch_restart_supervisor(
                &restart_script_path,
                &current_exe,
                &old_executable,
                &current_dir,
                &current_port,
            ) {
                return match Self::restore_previous_executable(&current_exe, &old_executable) {
                    Ok(()) => Err(format!(
                        "{launch_error}; previous executable was restored"
                    )),
                    Err(restore_error) => Err(format!(
                        "{launch_error}; additionally failed to restore previous executable: {restore_error}"
                    )),
                };
            }
            restart_script_guard.handoff();
        }

        // 6. Exit old process after brief flush window so port is freed before new process binds
        let lock_handoff = update_guard.handoff();
        tokio::spawn(async move {
            let _lock_handoff = lock_handoff;
            tokio::time::sleep(Duration::from_millis(300)).await;
            tracing::info!("Old process exiting cleanly to release port...");
            std::process::exit(0);
        });

        Ok("Update staged. The restart supervisor is verifying the new version...".to_string())
    }

    /// Rollback to a previous version from backup archive
    pub async fn rollback_update(target_version: Option<String>) -> Result<String, String> {
        let update_guard = UpdateLockGuard::try_acquire(&UPDATE_LOCK)?;
        let result = Self::rollback_update_locked(target_version, update_guard).await;
        Self::record_operation_result(result)
    }

    async fn rollback_update_locked(
        target_version: Option<String>,
        update_guard: UpdateLockGuard<'static>,
    ) -> Result<String, String> {
        let current_exe =
            std::env::current_exe().map_err(|e| format!("Cannot find current exe: {}", e))?;

        let backups = Self::list_version_backups();
        if backups.is_empty() {
            return Err("No previous version backups found to rollback.".to_string());
        }

        let chosen_backup = match target_version {
            Some(ref v) => backups.into_iter().find(|b| &b.version == v),
            None => backups.into_iter().next(),
        }
        .ok_or_else(|| "Target rollback backup not found".to_string())?;

        let backup_path = PathBuf::from(&chosen_backup.file_path);
        if !backup_path.exists() {
            return Err(format!(
                "Backup binary not found at {}",
                backup_path.display()
            ));
        }

        let versions_dir = Self::versions_backup_dir();
        let staged_executable = Self::prepare_rollback_replacement(
            &backup_path,
            &current_exe,
            &versions_dir,
            env!("CARGO_PKG_VERSION"),
        )?;
        let _staged_guard = TemporaryFileGuard::new(staged_executable.clone());

        #[cfg(target_family = "unix")]
        {
            let xattr_status = Command::new("/usr/bin/xattr")
                .arg("-cr")
                .arg(&staged_executable)
                .status()
                .map_err(|error| format!("Failed to invoke xattr for staged rollback: {error}"))?;
            if !xattr_status.success() {
                return Err("Failed to clear quarantine metadata from staged rollback".to_string());
            }
            let codesign_status = Command::new("/usr/bin/codesign")
                .args(["-f", "-s", "-"])
                .arg(&staged_executable)
                .status()
                .map_err(|error| {
                    format!("Failed to invoke codesign for staged rollback: {error}")
                })?;
            if !codesign_status.success() {
                return Err("Failed to sign staged rollback executable".to_string());
            }
        }

        let unique_suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        let restart_script_path = std::env::temp_dir().join(format!(
            "workstation_relaunch_{}_{}.sh",
            std::process::id(),
            unique_suffix
        ));
        let mut restart_script_guard = TemporaryFileGuard::new(restart_script_path.clone());
        Self::write_restart_script(&restart_script_path)?;
        let current_dir = std::env::current_dir()
            .map_err(|error| format!("Failed to determine restart working directory: {error}"))?;
        let current_port = Self::current_restart_port();
        let old_executable =
            match Self::commit_prepared_executable(&staged_executable, &current_exe) {
                Ok(path) => path,
                Err(error) => {
                    return Err(error);
                }
            };

        Self::set_progress(UpdateProgress::Restarting { countdown_sec: 3 });
        #[cfg(target_family = "unix")]
        {
            if let Err(launch_error) = Self::launch_restart_supervisor(
                &restart_script_path,
                &current_exe,
                &old_executable,
                &current_dir,
                &current_port,
            ) {
                return match Self::restore_previous_executable(&current_exe, &old_executable) {
                    Ok(()) => Err(format!(
                        "{launch_error}; previous executable was restored"
                    )),
                    Err(restore_error) => Err(format!(
                        "{launch_error}; additionally failed to restore previous executable: {restore_error}"
                    )),
                };
            }
            restart_script_guard.handoff();
        }

        let lock_handoff = update_guard.handoff();
        tokio::spawn(async move {
            let _lock_handoff = lock_handoff;
            tokio::time::sleep(Duration::from_millis(300)).await;
            std::process::exit(0);
        });

        Ok(format!(
            "Rollback to version {} is staged. The restart supervisor is verifying it...",
            chosen_backup.version
        ))
    }

    fn find_binary_recursive(dir: &Path) -> Option<PathBuf> {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .file_name()
                        .map_or(false, |n| n == "workstation-monitor")
                {
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
    use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

    static TEST_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn updater_test_dir(name: &str) -> PathBuf {
        let counter = TEST_DIR_COUNTER.fetch_add(1, AtomicOrdering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "workstation-monitor-updater-test-{}-{name}-{counter}",
            std::process::id()
        ));
        std::fs::create_dir(&path).expect("create updater test directory");
        path
    }

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

    #[test]
    fn release_download_url_accepts_only_supported_official_assets() {
        let official = "https://github.com/army-u8/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.6_aarch64.app.zip";
        assert!(AutoUpdater::validate_release_download_url_for_arch(official, "aarch64").is_ok());

        let rejected = [
            "http://github.com/army-u8/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.6_aarch64.app.zip",
            "https://attacker.example/update.app.zip",
            "https://github.com.attacker.example/army-u8/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.6_aarch64.app.zip",
            "https://github.com/attacker/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.6_aarch64.app.zip",
            "https://github.com/army-u8/other/releases/download/v0.2.6/Workstation_Monitor_0.2.6_aarch64.app.zip",
            "https://github.com/army-u8/workstation-monitor/releases/download/v0.2.6/evil.app.zip",
            "https://github.com/army-u8/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.5_aarch64.app.zip",
            "https://github.com/army-u8/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.6_x64.app.zip",
            "https://github.com/army-u8/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.6_aarch64.dmg",
            "https://github.com/army-u8/workstation-monitor/releases/download/v0.2.6/Workstation_Monitor_0.2.6_aarch64.app.zip?download=1",
        ];

        for url in rejected {
            assert!(
                AutoUpdater::validate_release_download_url_for_arch(url, "aarch64").is_err(),
                "unexpectedly accepted {url}"
            );
        }
    }

    #[test]
    fn download_redirects_are_limited_to_official_github_asset_hosts() {
        let allowed = [
            "https://release-assets.githubusercontent.com/github-production-release-asset/123/file?sp=r",
            "https://objects.githubusercontent.com/github-production-release-asset-2e65be/123/file?X-Amz-Signature=abc",
        ];
        for url in allowed {
            let parsed = reqwest::Url::parse(url).unwrap();
            assert!(AutoUpdater::is_allowed_download_redirect(&parsed));
        }

        let rejected = [
            "http://release-assets.githubusercontent.com/file",
            "https://release-assets.githubusercontent.com.attacker.example/file",
            "https://user@release-assets.githubusercontent.com/file",
            "https://github-production-release-asset.s3.amazonaws.com/file",
            "https://attacker.example/file",
        ];
        for url in rejected {
            let parsed = reqwest::Url::parse(url).unwrap();
            assert!(
                !AutoUpdater::is_allowed_download_redirect(&parsed),
                "unexpectedly accepted {url}"
            );
        }
    }

    #[test]
    fn relaunch_values_are_passed_as_arguments_not_interpolated_into_shell_source() {
        let hostile_dir = Path::new("/tmp/work dir/\"; touch /tmp/injected; #");
        let hostile_port = "9527\"; touch /tmp/injected; #";
        let hostile_exe = Path::new("/tmp/app $(touch /tmp/injected)");

        let script = AutoUpdater::restart_script_content();
        assert!(!script.contains(hostile_dir.to_string_lossy().as_ref()));
        assert!(!script.contains(hostile_port));
        assert!(script.contains("CWD=\"$3\""));
        assert!(script.contains("PORT_VALUE=\"$4\""));

        let command = AutoUpdater::build_restart_command(
            Path::new("/tmp/relaunch.sh"),
            hostile_exe,
            Path::new("/tmp/previous executable"),
            hostile_dir,
            hostile_port,
        );
        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert_eq!(
            args,
            vec![
                "/tmp/relaunch.sh",
                hostile_exe.to_string_lossy().as_ref(),
                "/tmp/previous executable",
                hostile_dir.to_string_lossy().as_ref(),
                hostile_port,
            ]
        );
    }

    #[test]
    fn failed_version_archive_preserves_the_running_executable() {
        let dir = updater_test_dir("archive-failure");
        let current = dir.join("workstation-monitor");
        let candidate = dir.join("candidate");
        std::fs::write(&current, b"current-version").unwrap();
        std::fs::write(&candidate, b"new-version").unwrap();
        let archive = dir.join("missing-parent").join("archive");

        let result =
            AutoUpdater::prepare_executable_replacement(&candidate, &current, Some(&archive));

        assert!(result.is_err());
        assert_eq!(std::fs::read(&current).unwrap(), b"current-version");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rollback_archives_the_version_being_replaced_for_an_immediate_undo() {
        let dir = updater_test_dir("rollback-undo-archive");
        let versions = dir.join("versions");
        std::fs::create_dir(&versions).unwrap();
        let current = dir.join("workstation-monitor");
        let rollback_candidate = versions.join("workstation-monitor-v1.0.0");
        std::fs::write(&current, b"current-version").unwrap();
        std::fs::write(&rollback_candidate, b"rollback-version").unwrap();

        let staged = AutoUpdater::prepare_rollback_replacement(
            &rollback_candidate,
            &current,
            &versions,
            "2.0.0",
        )
        .unwrap();

        assert_eq!(std::fs::read(&staged).unwrap(), b"rollback-version");
        assert_eq!(
            std::fs::read(versions.join("workstation-monitor-v2.0.0")).unwrap(),
            b"current-version"
        );
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn failed_install_rename_restores_the_running_executable() {
        let dir = updater_test_dir("commit-rollback");
        let current = dir.join("workstation-monitor");
        let vanished_staged_file = dir.join("vanished-update");
        std::fs::write(&current, b"current-version").unwrap();

        let result = AutoUpdater::commit_prepared_executable(&vanished_staged_file, &current);

        assert!(result.is_err());
        assert_eq!(std::fs::read(&current).unwrap(), b"current-version");
        assert!(!PathBuf::from(format!("{}.old", current.display())).exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn relaunch_failure_restores_previous_executable() {
        let dir = updater_test_dir("relaunch-rollback");
        let current = dir.join("workstation-monitor");
        let previous = PathBuf::from(format!("{}.old", current.display()));
        std::fs::write(&current, b"new-version").unwrap();
        std::fs::write(&previous, b"previous-version").unwrap();

        AutoUpdater::restore_previous_executable(&current, &previous).unwrap();

        assert_eq!(std::fs::read(&current).unwrap(), b"previous-version");
        assert!(!previous.exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn failed_atomic_archive_does_not_truncate_existing_backup() {
        let dir = updater_test_dir("atomic-archive-failure");
        let invalid_source = dir.join("source-directory");
        let archive = dir.join("workstation-monitor-v0.2.5");
        std::fs::create_dir(&invalid_source).unwrap();
        std::fs::write(&archive, b"known-good-backup").unwrap();

        let result = AutoUpdater::archive_executable_atomically(&invalid_source, &archive);

        assert!(result.is_err());
        assert_eq!(std::fs::read(&archive).unwrap(), b"known-good-backup");
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 2);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn backup_listing_ignores_partial_symlinked_and_malformed_files() {
        let dir = updater_test_dir("strict-backup-list");
        let valid_backup = dir.join("workstation-monitor-v1.2.3");
        std::fs::write(&valid_backup, b"valid").unwrap();
        #[cfg(target_family = "unix")]
        std::fs::set_permissions(&valid_backup, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::fs::write(dir.join("workstation-monitor-v1.2.3.partial-7"), b"partial").unwrap();
        std::fs::write(dir.join("workstation-monitor-v1.2"), b"short").unwrap();
        std::fs::write(dir.join("workstation-monitor-vlatest"), b"latest").unwrap();
        std::fs::write(dir.join("workstation-monitor-v2.0.0"), b"").unwrap();
        std::fs::write(dir.join("unrelated"), b"other").unwrap();
        #[cfg(target_family = "unix")]
        std::os::unix::fs::symlink(
            dir.join("workstation-monitor-v1.2.3"),
            dir.join("workstation-monitor-v9.9.9"),
        )
        .unwrap();

        let backups = AutoUpdater::list_version_backups_in(&dir);

        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].version, "1.2.3");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn temporary_file_guard_cleans_up_unless_handed_off() {
        let dir = updater_test_dir("temporary-file-guard");
        let cleaned = dir.join("cleaned");
        std::fs::write(&cleaned, b"temporary").unwrap();
        {
            let _guard = TemporaryFileGuard::new(cleaned.clone());
        }
        assert!(!cleaned.exists());

        let retained = dir.join("retained");
        std::fs::write(&retained, b"supervisor-owned").unwrap();
        {
            let mut guard = TemporaryFileGuard::new(retained.clone());
            guard.handoff();
        }
        assert!(retained.exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn failed_operation_result_sets_failed_progress() {
        AutoUpdater::set_progress(UpdateProgress::Replacing);

        let result = AutoUpdater::record_operation_result::<()>(Err("disk full".to_string()));

        assert_eq!(result, Err("disk full".to_string()));
        assert_eq!(
            AutoUpdater::get_progress(),
            UpdateProgress::Failed {
                error: "disk full".to_string()
            }
        );
    }

    #[test]
    fn update_lock_handoff_keeps_lock_until_supervisor_ownership_ends() {
        let lock = AtomicBool::new(false);
        let guard = UpdateLockGuard::try_acquire(&lock).unwrap();
        assert!(lock.load(Ordering::SeqCst));

        let handoff = guard.handoff();
        assert!(lock.load(Ordering::SeqCst));
        assert!(UpdateLockGuard::try_acquire(&lock).is_err());

        drop(handoff);
        assert!(!lock.load(Ordering::SeqCst));
    }

    #[test]
    fn supervisor_script_health_checks_and_rolls_back_before_cleanup() {
        let script = AutoUpdater::restart_script_content();

        assert!(script.contains("PREVIOUS=\"$2\""));
        assert!(script.contains("BIND_VALUE=\"${WORKSTATION_BIND_ADDR:-127.0.0.1}\""));
        assert!(script.contains("http://${HEALTH_HOST}:${PORT_VALUE}/api/status"));
        assert!(script.contains("/bin/mv \"$PREVIOUS\" \"$TARGET\""));
        assert!(script
            .contains("/bin/mv \"$PREVIOUS\" \"$TARGET\"; then\n        \"$TARGET\" --no-open"));
        assert!(script.contains("/bin/mv \"$FAILED_TARGET\" \"$TARGET\""));
        let health_check = script.find("/api/status").unwrap();
        let process_check = script.find("/bin/kill -0 \"$NEW_PID\"").unwrap();
        let cleanup_old = script.find("/bin/rm -f \"$PREVIOUS\"").unwrap();
        assert!(process_check < health_check);
        assert!(health_check < cleanup_old);
    }

    #[test]
    fn supervisor_script_is_valid_shell() {
        let dir = updater_test_dir("supervisor-syntax");
        let script = dir.join("relaunch.sh");
        AutoUpdater::write_restart_script(&script).unwrap();

        let status = Command::new("/bin/sh")
            .args(["-n"])
            .arg(&script)
            .status()
            .unwrap();

        assert!(status.success());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
