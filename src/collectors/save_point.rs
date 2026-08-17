use std::path::Path;
use std::process::Command;
use crate::types::{SavePointSnapshot, SnapshotsListResponse, SnapshotActionResponse};

pub struct SavePointManager;

impl SavePointManager {
    /// List historical snapshots / save points for a given project repository
    pub fn list_snapshots(project_path: &str) -> Result<SnapshotsListResponse, String> {
        let repo_path = Path::new(project_path);
        if !repo_path.exists() || !repo_path.join(".git").exists() {
            return Err("Target directory is not a valid Git repository".to_string());
        }

        let project_name = repo_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown Project".to_string());

        // 1. Current branch
        let branch_out = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to get branch: {}", e))?;
        let current_branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();

        // 2. Current HEAD hash
        let head_out = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-parse", "HEAD"])
            .output()
            .ok();
        let head_hash = head_out
            .and_then(|o| if o.status.success() { Some(String::from_utf8_lossy(&o.stdout).trim().to_string()) } else { None })
            .unwrap_or_default();

        // 3. Status / Uncommitted check
        let status_out = Command::new("git")
            .current_dir(repo_path)
            .args(["status", "--porcelain"])
            .output()
            .ok();
        let (is_dirty, uncommitted_count) = match status_out {
            Some(out) => {
                let text = String::from_utf8_lossy(&out.stdout);
                let count = text.lines().filter(|l| !l.trim().is_empty()).count();
                (count > 0, count)
            }
            None => (false, 0),
        };

        // 4. Git log parsing (up to 30 recent commits)
        let log_out = Command::new("git")
            .current_dir(repo_path)
            .args(["log", "-n", "30", "--pretty=format:%H|%h|%an|%ai|%cr|%s"])
            .output()
            .map_err(|e| format!("Failed to read git log: {}", e))?;

        let mut snapshots = Vec::new();
        let log_text = String::from_utf8_lossy(&log_out.stdout);

        for line in log_text.lines() {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 6 {
                let commit_hash = parts[0].to_string();
                let short_hash = parts[1].to_string();
                let author = parts[2].to_string();
                let created_at = parts[3].to_string();
                let relative_time = parts[4].to_string();
                let raw_subject = parts[5..].join("|");

                let is_save_point = raw_subject.starts_with("📸 [Save Point]") || raw_subject.starts_with("[SavePoint]");
                let clean_title = if is_save_point {
                    raw_subject
                        .trim_start_matches("📸 [Save Point]")
                        .trim_start_matches("[SavePoint]")
                        .trim_start_matches(':')
                        .trim()
                        .to_string()
                } else {
                    raw_subject
                };

                let is_head = !head_hash.is_empty() && commit_hash == head_hash;

                snapshots.push(SavePointSnapshot {
                    commit_hash,
                    short_hash,
                    title: if clean_title.is_empty() { "未命名的好用状态".to_string() } else { clean_title },
                    author,
                    created_at,
                    relative_time,
                    is_save_point,
                    is_head,
                    changed_files_summary: None,
                });
            }
        }

        Ok(SnapshotsListResponse {
            project_name,
            project_path: project_path.to_string(),
            current_branch,
            is_dirty,
            uncommitted_count,
            snapshots,
        })
    }

    /// Create a new save point snapshot (commits current changes with friendly title)
    pub fn create_snapshot(project_path: &str, title: &str) -> Result<SnapshotActionResponse, String> {
        let repo_path = Path::new(project_path);
        if !repo_path.exists() || !repo_path.join(".git").exists() {
            return Err("Target directory is not a valid Git repository".to_string());
        }

        let clean_title = title.trim();
        let final_title = if clean_title.is_empty() {
            "记录此刻好用状态"
        } else {
            clean_title
        };

        // 1. Stage all changes
        let add_status = Command::new("git")
            .current_dir(repo_path)
            .args(["add", "-A"])
            .status()
            .map_err(|e| format!("git add failed: {}", e))?;

        if !add_status.success() {
            return Err("Failed to stage changes before saving snapshot".to_string());
        }

        // 2. Commit with Save Point tag prefix
        let commit_msg = format!("📸 [Save Point] {}", final_title);
        let commit_out = Command::new("git")
            .current_dir(repo_path)
            .args(["commit", "-m", &commit_msg, "--allow-empty"])
            .output()
            .map_err(|e| format!("git commit failed: {}", e))?;

        if !commit_out.status.success() {
            let err_msg = String::from_utf8_lossy(&commit_out.stderr);
            return Err(format!("Failed to create save point commit: {}", err_msg));
        }

        // 3. Read newly created commit hash
        let hash_out = Command::new("git")
            .current_dir(repo_path)
            .args(["rev-parse", "HEAD"])
            .output()
            .map_err(|e| format!("Failed to read new commit hash: {}", e))?;
        let commit_hash = String::from_utf8_lossy(&hash_out.stdout).trim().to_string();
        let short_hash = commit_hash.chars().take(7).collect::<String>();

        let snapshot = SavePointSnapshot {
            commit_hash,
            short_hash,
            title: final_title.to_string(),
            author: "You".to_string(),
            created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            relative_time: "刚刚".to_string(),
            is_save_point: true,
            is_head: true,
            changed_files_summary: None,
        };

        Ok(SnapshotActionResponse {
            success: true,
            message: format!("已成功记录存档点：「{}」", final_title),
            snapshot: Some(snapshot),
        })
    }

    /// Rollback project state to a target commit with optional automatic safety backup
    pub fn rollback_snapshot(
        project_path: &str,
        target_commit: &str,
        create_safety_backup: bool,
    ) -> Result<SnapshotActionResponse, String> {
        let repo_path = Path::new(project_path);
        if !repo_path.exists() || !repo_path.join(".git").exists() {
            return Err("Target directory is not a valid Git repository".to_string());
        }

        let target_commit = target_commit.trim();
        if target_commit.is_empty() {
            return Err("Target commit hash cannot be empty".to_string());
        }

        // 1. Safety Backup: If working tree is dirty and safety backup requested, create an automatic checkpoint first
        if create_safety_backup {
            let status_out = Command::new("git")
                .current_dir(repo_path)
                .args(["status", "--porcelain"])
                .output()
                .ok();

            let is_dirty = status_out.map_or(false, |o| {
                let text = String::from_utf8_lossy(&o.stdout);
                !text.trim().is_empty()
            });

            if is_dirty {
                let _ = Command::new("git")
                    .current_dir(repo_path)
                    .args(["add", "-A"])
                    .status();

                let backup_msg = format!(
                    "🛡️ [Auto Safety Backup] 在回滚到 {} 前自动保存",
                    &target_commit.chars().take(7).collect::<String>()
                );
                let _ = Command::new("git")
                    .current_dir(repo_path)
                    .args(["commit", "-m", &backup_msg, "--allow-empty"])
                    .status();
            }
        }

        // 2. Perform hard reset to target commit
        let reset_out = Command::new("git")
            .current_dir(repo_path)
            .args(["reset", "--hard", target_commit])
            .output()
            .map_err(|e| format!("Failed to execute git reset: {}", e))?;

        if !reset_out.status.success() {
            let err_msg = String::from_utf8_lossy(&reset_out.stderr);
            return Err(format!("Rollback failed: {}", err_msg));
        }

        // 3. Clean untracked files if needed
        let _ = Command::new("git")
            .current_dir(repo_path)
            .args(["clean", "-fd"])
            .status();

        let short_hash = target_commit.chars().take(7).collect::<String>();
        Ok(SnapshotActionResponse {
            success: true,
            message: format!("已成功时光倒流回存档点 ({})，代码已安全恢复！", short_hash),
            snapshot: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_save_point_lifecycle() {
        let temp_dir = std::env::temp_dir().join(format!("vibe_test_repo_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        // 1. git init
        let init = Command::new("git")
            .current_dir(&temp_dir)
            .args(["init"])
            .status()
            .unwrap();
        assert!(init.success());

        // Configure dummy user for commit
        let _ = Command::new("git").current_dir(&temp_dir).args(["config", "user.name", "Test"]).status();
        let _ = Command::new("git").current_dir(&temp_dir).args(["config", "user.email", "test@example.com"]).status();

        // 2. Create a test file and initial commit
        fs::write(temp_dir.join("main.js"), "console.log('v1');").unwrap();

        let save_res = SavePointManager::create_snapshot(temp_dir.to_str().unwrap(), "初始功能正常").unwrap();
        assert!(save_res.success);
        let v1_hash = save_res.snapshot.unwrap().commit_hash;

        // 3. Modify file (simulating AI broke the code)
        fs::write(temp_dir.join("main.js"), "broken syntax error =====").unwrap();

        // 4. List snapshots
        let list = SavePointManager::list_snapshots(temp_dir.to_str().unwrap()).unwrap();
        assert_eq!(list.snapshots.len(), 1);
        assert!(list.is_dirty);

        // 5. Rollback to v1
        let rollback_res = SavePointManager::rollback_snapshot(temp_dir.to_str().unwrap(), &v1_hash, true).unwrap();
        assert!(rollback_res.success);

        // Verify file is restored
        let content = fs::read_to_string(temp_dir.join("main.js")).unwrap();
        assert_eq!(content, "console.log('v1');");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
