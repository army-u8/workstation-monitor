use crate::types::CleanerItem;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

pub struct SystemCleaner;

impl SystemCleaner {
    const SCAN_COMMAND_TIMEOUT: Duration = Duration::from_secs(3);
    const CLEAN_COMMAND_TIMEOUT: Duration = Duration::from_secs(120);

    pub fn scan() -> Vec<CleanerItem> {
        let Some(home) = std::env::var_os("HOME") else {
            tracing::warn!("Skipping cleaner scan because HOME is not set");
            return Vec::new();
        };
        let home_path = Path::new(&home);

        let targets = vec![
            (
                "xcode_derived_data",
                "Xcode DerivedData 编译缓存",
                "Developer",
                home_path.join("Library/Developer/Xcode/DerivedData"),
            ),
            (
                "homebrew_cache",
                "Homebrew 下载与安装包缓存",
                "Package Manager",
                home_path.join("Library/Caches/Homebrew"),
            ),
            (
                "npm_cache",
                "NPM 全局依赖缓存",
                "JavaScript",
                home_path.join(".npm/_cacache"),
            ),
            (
                "yarn_cache",
                "Yarn 全局依赖缓存",
                "JavaScript",
                home_path.join("Library/Caches/Yarn"),
            ),
            (
                "pnpm_cache",
                "PNPM Store 全局存储",
                "JavaScript",
                home_path.join("Library/pnpm/store"),
            ),
            (
                "cargo_cache",
                "Rust Cargo Registry 源码缓存",
                "Rust",
                home_path.join(".cargo/registry/cache"),
            ),
            (
                "user_logs",
                "macOS 用户诊断与崩溃日志",
                "System",
                home_path.join("Library/Logs"),
            ),
            (
                "user_caches",
                "macOS 应用临时缓存目录",
                "System",
                home_path.join("Library/Caches"),
            ),
        ];

        let nested_user_caches = Self::user_cache_exclusions(home_path);
        let mut items = thread::scope(|scope| {
            targets
                .into_iter()
                .filter(|(_, _, _, path)| path.exists())
                .map(|(id, name, category, path)| {
                    let excluded = if id == "user_caches" {
                        nested_user_caches.clone()
                    } else {
                        Vec::new()
                    };
                    scope.spawn(move || {
                        let size = Self::dir_size_excluding(&path, &excluded);
                        CleanerItem {
                            id: id.to_string(),
                            name: name.to_string(),
                            category: category.to_string(),
                            path: Some(path.to_string_lossy().to_string()),
                            size_bytes: size,
                            size_human: Self::format_bytes(size),
                            is_cleanable: size > 0,
                        }
                    })
                })
                .collect::<Vec<_>>()
                .into_iter()
                .filter_map(|worker| worker.join().ok())
                .collect::<Vec<_>>()
        });

        // Check Docker if running
        let mut docker = Command::new("docker");
        docker.args(["system", "df", "--format", "{{.Size}}"]);
        if let Ok(out) = Self::run_command_with_timeout(&mut docker, Self::SCAN_COMMAND_TIMEOUT) {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                items.push(CleanerItem {
                    id: "docker_cache".to_string(),
                    name: "Docker 未使用镜像与构建缓存".to_string(),
                    category: "Containers".to_string(),
                    path: Some("docker system prune".to_string()),
                    size_bytes: 0,
                    size_human: text.lines().next().unwrap_or("可清理").trim().to_string(),
                    is_cleanable: true,
                });
            }
        }

        items
    }

    pub fn clean(id: &str) -> Result<String, String> {
        let home = std::env::var_os("HOME")
            .ok_or_else(|| "无法清理：HOME 环境变量未设置".to_string())?;
        let mut runner = Self::run_command_with_timeout;
        Self::clean_at_home_with_runner(Path::new(&home), id, &mut runner)
    }

    fn clean_at_home_with_runner<F>(
        home_path: &Path,
        id: &str,
        runner: &mut F,
    ) -> Result<String, String>
    where
        F: FnMut(&mut Command, Duration) -> Result<Output, String>,
    {
        let clean_directory = |id: &str| {
            let path = Self::clean_target_path(home_path, id)
                .ok_or_else(|| "未知的清理目标".to_string())?;
            let excluded = if id == "user_caches" {
                Self::user_cache_exclusions(home_path)
            } else {
                Vec::new()
            };
            Self::remove_dir_contents_excluding(&path, &excluded)
        };

        match id {
            "xcode_derived_data" => {
                clean_directory(id)?;
                Ok("Xcode DerivedData 缓存已清空".to_string())
            }
            "homebrew_cache" => {
                let mut command = Command::new("brew");
                command.args(["cleanup", "--prune=all", "-s"]);
                let output = runner(&mut command, Self::CLEAN_COMMAND_TIMEOUT)?;
                Self::require_command_success("brew cleanup", output)?;
                clean_directory(id)?;
                Ok("Homebrew 缓存与旧版本包已清空".to_string())
            }
            "npm_cache" => {
                clean_directory(id)?;
                Ok("NPM 缓存已清理".to_string())
            }
            "yarn_cache" => {
                clean_directory(id)?;
                Ok("Yarn 缓存已清理".to_string())
            }
            "pnpm_cache" => {
                clean_directory(id)?;
                Ok("PNPM Store 缓存已清理".to_string())
            }
            "cargo_cache" => {
                clean_directory(id)?;
                Ok("Cargo Registry 缓存已清理".to_string())
            }
            "user_logs" => {
                clean_directory(id)?;
                Ok("用户日志已清理".to_string())
            }
            "user_caches" => {
                clean_directory(id)?;
                Ok("用户缓存已清理".to_string())
            }
            "docker_cache" => {
                let mut command = Command::new("docker");
                command.args(["system", "prune", "-f"]);
                let output = runner(&mut command, Self::CLEAN_COMMAND_TIMEOUT)?;
                Self::require_command_success("docker system prune", output)?;
                Ok("Docker 缓存与无用容器已清理".to_string())
            }
            _ => Err("未知的清理目标".to_string()),
        }
    }

    fn clean_target_path(home: &Path, id: &str) -> Option<PathBuf> {
        let relative = match id {
            "xcode_derived_data" => "Library/Developer/Xcode/DerivedData",
            "homebrew_cache" => "Library/Caches/Homebrew",
            "npm_cache" => ".npm/_cacache",
            "yarn_cache" => "Library/Caches/Yarn",
            "pnpm_cache" => "Library/pnpm/store",
            "cargo_cache" => ".cargo/registry/cache",
            "user_logs" => "Library/Logs",
            "user_caches" => "Library/Caches",
            _ => return None,
        };
        Some(home.join(relative))
    }

    fn user_cache_exclusions(home: &Path) -> Vec<PathBuf> {
        vec![
            home.join("Library/Caches/Homebrew"),
            home.join("Library/Caches/Yarn"),
        ]
    }

    fn require_command_success(name: &str, output: Output) -> Result<(), String> {
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err(format!("{name} 执行失败: {}", output.status))
        } else {
            Err(format!("{name} 执行失败: {stderr}"))
        }
    }

    fn run_command_with_timeout(
        command: &mut Command,
        timeout: Duration,
    ) -> Result<Output, String> {
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("无法启动 {:?}: {error}", command.get_program()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "无法捕获命令标准输出".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "无法捕获命令错误输出".to_string())?;
        let (stdout_tx, stdout_rx) = mpsc::channel();
        thread::spawn(move || {
            let mut bytes = Vec::new();
            let mut stream = stdout;
            let _ = stdout_tx.send(stream.read_to_end(&mut bytes).map(|_| bytes));
        });
        let (stderr_tx, stderr_rx) = mpsc::channel();
        thread::spawn(move || {
            let mut bytes = Vec::new();
            let mut stream = stderr;
            let _ = stderr_tx.send(stream.read_to_end(&mut bytes).map(|_| bytes));
        });
        let deadline = Instant::now() + timeout;

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    Self::terminate_command_group(&mut child);
                    let stdout = stdout_rx
                        .recv_timeout(Duration::from_secs(1))
                        .map_err(|_| "等待命令标准输出超时".to_string())?
                        .map_err(|error| format!("读取命令标准输出失败: {error}"))?;
                    let stderr = stderr_rx
                        .recv_timeout(Duration::from_secs(1))
                        .map_err(|_| "等待命令错误输出超时".to_string())?
                        .map_err(|error| format!("读取命令错误输出失败: {error}"))?;
                    return Ok(Output {
                        status,
                        stdout,
                        stderr,
                    });
                }
                Ok(None) if Instant::now() >= deadline => {
                    Self::terminate_command_group(&mut child);
                    let _ = child.wait();
                    return Err(format!(
                        "命令 {:?} 执行超时（{} ms）",
                        command.get_program(),
                        timeout.as_millis()
                    ));
                }
                Ok(None) => thread::sleep(Duration::from_millis(10)),
                Err(error) => {
                    Self::terminate_command_group(&mut child);
                    let _ = child.wait();
                    return Err(format!("检查命令状态失败: {error}"));
                }
            }
        }
    }

    fn terminate_command_group(child: &mut std::process::Child) {
        #[cfg(unix)]
        unsafe {
            let _ = libc::kill(-(child.id() as i32), libc::SIGKILL);
        }
        let _ = child.kill();
    }

    #[cfg(test)]
    fn dir_size(path: &Path) -> u64 {
        Self::dir_size_excluding(path, &[])
    }

    fn dir_size_excluding(path: &Path, excluded: &[PathBuf]) -> u64 {
        if excluded.iter().any(|excluded_path| excluded_path == path) {
            return 0;
        }
        let Ok(metadata) = std::fs::symlink_metadata(path) else {
            return 0;
        };
        if metadata.file_type().is_symlink() {
            return 0;
        }
        if metadata.is_file() {
            return metadata.len();
        }

        let mut total = 0;
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                let Ok(file_type) = entry.file_type() else {
                    continue;
                };
                if file_type.is_symlink() {
                    continue;
                }
                if file_type.is_dir() {
                    total += Self::dir_size_excluding(&p, excluded);
                } else if file_type.is_file() {
                    total += entry.metadata().map(|m| m.len()).unwrap_or(0);
                }
            }
        }
        total
    }

    #[cfg(test)]
    fn remove_dir_contents(path: &Path) -> Result<(), String> {
        Self::remove_dir_contents_excluding(path, &[])
    }

    fn remove_dir_contents_excluding(path: &Path, excluded: &[PathBuf]) -> Result<(), String> {
        if excluded.iter().any(|excluded_path| excluded_path == path) {
            return Ok(());
        }
        let metadata = match std::fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(format!("无法检查 {}: {error}", path.display())),
        };
        if metadata.file_type().is_symlink() {
            return Err(format!("拒绝清理符号链接目录: {}", path.display()));
        }

        let entries = std::fs::read_dir(path)
            .map_err(|error| format!("无法读取 {}: {error}", path.display()))?;
        for entry in entries {
            let entry =
                entry.map_err(|error| format!("无法读取 {} 中的项目: {error}", path.display()))?;
            let child = entry.path();
            if excluded.iter().any(|excluded_path| excluded_path == &child) {
                continue;
            }
            let file_type = entry
                .file_type()
                .map_err(|error| format!("无法检查 {}: {error}", child.display()))?;
            let contains_exclusion = excluded
                .iter()
                .any(|excluded_path| excluded_path.starts_with(&child));
            let result = if contains_exclusion && file_type.is_dir() && !file_type.is_symlink() {
                Self::remove_dir_contents_excluding(&child, excluded)
            } else if file_type.is_dir() && !file_type.is_symlink() {
                std::fs::remove_dir_all(&child).map_err(|error| error.to_string())
            } else {
                std::fs::remove_file(&child).map_err(|error| error.to_string())
            };
            if let Err(error) = result {
                return Err(format!("无法删除 {}: {error}", child.display()));
            }
        }
        Ok(())
    }

    fn format_bytes(bytes: u64) -> String {
        if bytes >= 1024 * 1024 * 1024 {
            format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
        } else if bytes >= 1024 * 1024 {
            format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
        } else if bytes >= 1024 {
            format!("{:.0} KB", bytes as f64 / 1024.0)
        } else {
            format!("{} B", bytes)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::symlink;
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    struct TestDir(PathBuf);

    impl TestDir {
        fn new(label: &str) -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "workstation-monitor-{label}-{}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn dir_size_does_not_follow_directory_symlinks() {
        let root = TestDir::new("cleaner-size-root");
        let outside = TestDir::new("cleaner-size-outside");
        fs::write(root.path().join("owned-cache"), b"abc").unwrap();
        fs::write(outside.path().join("unrelated-data"), vec![0_u8; 4096]).unwrap();
        symlink(outside.path(), root.path().join("external-link")).unwrap();

        assert_eq!(SystemCleaner::dir_size(root.path()), 3);
    }

    #[test]
    fn remove_dir_contents_reports_read_errors() {
        let root = TestDir::new("cleaner-remove-error");
        let not_a_directory = root.path().join("cache-file");
        fs::write(&not_a_directory, b"cache").unwrap();

        let result = SystemCleaner::remove_dir_contents(&not_a_directory);

        assert!(
            result.is_err(),
            "a failed directory read must not report success"
        );
    }

    #[test]
    fn remove_dir_contents_rejects_a_symlinked_root() {
        let root = TestDir::new("cleaner-remove-symlink-root");
        let outside = TestDir::new("cleaner-remove-symlink-outside");
        let outside_file = outside.path().join("must-survive");
        fs::write(&outside_file, b"data").unwrap();
        let linked_cache = root.path().join("cache-link");
        symlink(outside.path(), &linked_cache).unwrap();

        let result = SystemCleaner::remove_dir_contents(&linked_cache);

        assert!(result.is_err());
        assert!(outside_file.exists());
    }

    #[test]
    fn every_scanned_directory_target_has_a_clean_path() {
        let home = Path::new("/tmp/vibedesk-test-home");
        let expected = [
            "xcode_derived_data",
            "homebrew_cache",
            "npm_cache",
            "yarn_cache",
            "pnpm_cache",
            "cargo_cache",
            "user_logs",
            "user_caches",
        ];

        for id in expected {
            assert!(
                SystemCleaner::clean_target_path(home, id).is_some(),
                "missing clean path for {id}"
            );
        }
    }

    #[test]
    fn command_failure_is_not_reported_as_a_successful_clean() {
        let home = TestDir::new("cleaner-command-error");
        let cache = home.path().join("Library/Caches/Homebrew");
        fs::create_dir_all(&cache).unwrap();
        fs::write(cache.join("archive"), b"cache").unwrap();
        let mut runner = |_: &mut Command, _: Duration| Err("injected command failure".to_string());

        let result =
            SystemCleaner::clean_at_home_with_runner(home.path(), "homebrew_cache", &mut runner);

        assert!(result.unwrap_err().contains("injected command failure"));
        assert!(cache.join("archive").exists());
    }

    #[test]
    fn directory_only_clean_does_not_start_an_external_command() {
        let home = TestDir::new("cleaner-pnpm");
        let cache = home.path().join("Library/pnpm/store");
        fs::create_dir_all(&cache).unwrap();
        fs::write(cache.join("package"), b"cache").unwrap();
        let mut runner = |_: &mut Command, _: Duration| -> Result<_, String> {
            panic!("pnpm directory cleanup must not start an external command")
        };

        let result =
            SystemCleaner::clean_at_home_with_runner(home.path(), "pnpm_cache", &mut runner);

        assert!(result.is_ok());
        assert!(fs::read_dir(&cache).unwrap().next().is_none());
    }

    #[test]
    fn user_cache_clean_preserves_items_excluded_from_its_scan() {
        let home = TestDir::new("cleaner-user-cache-exclusions");
        let user_caches = home.path().join("Library/Caches");
        let homebrew_cache = user_caches.join("Homebrew");
        fs::create_dir_all(&homebrew_cache).unwrap();
        fs::write(homebrew_cache.join("archive"), b"must survive").unwrap();
        fs::write(user_caches.join("ordinary-cache"), b"remove me").unwrap();
        let mut runner = |_: &mut Command, _: Duration| -> Result<_, String> {
            panic!("user cache cleanup must not start an external command")
        };

        SystemCleaner::clean_at_home_with_runner(home.path(), "user_caches", &mut runner).unwrap();

        assert!(homebrew_cache.join("archive").exists());
        assert!(!user_caches.join("ordinary-cache").exists());
    }

    #[test]
    fn external_commands_are_terminated_after_the_deadline() {
        let started = Instant::now();
        let result = SystemCleaner::run_command_with_timeout(
            Command::new("/bin/sleep").arg("1"),
            Duration::from_millis(30),
        );

        assert!(result.unwrap_err().contains("超时"));
        assert!(started.elapsed() < Duration::from_millis(500));
    }

    #[cfg(unix)]
    #[test]
    fn successful_command_cannot_leave_a_child_holding_output_pipes() {
        let started = Instant::now();
        let result = SystemCleaner::run_command_with_timeout(
            Command::new("/bin/sh").args(["-c", "sleep 2 &"]),
            Duration::from_millis(40),
        );

        assert!(result.is_ok());
        assert!(started.elapsed() < Duration::from_millis(700));
    }

    #[test]
    fn destructive_cleanup_commands_use_a_longer_timeout_than_scan_probes() {
        let home = TestDir::new("cleaner-command-timeout");
        fs::create_dir_all(home.path().join("Library/Caches/Homebrew")).unwrap();
        let mut observed_timeout = Duration::ZERO;
        let mut runner = |_: &mut Command, timeout: Duration| {
            observed_timeout = timeout;
            Command::new("/usr/bin/true")
                .output()
                .map_err(|error| error.to_string())
        };

        SystemCleaner::clean_at_home_with_runner(home.path(), "homebrew_cache", &mut runner)
            .unwrap();

        assert_eq!(observed_timeout, SystemCleaner::CLEAN_COMMAND_TIMEOUT);
        assert!(SystemCleaner::CLEAN_COMMAND_TIMEOUT > SystemCleaner::SCAN_COMMAND_TIMEOUT);
    }
}
