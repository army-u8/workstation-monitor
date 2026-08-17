use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;
use chrono::Local;
use serde_json::Value;

use crate::types::{
    ObsidianNoteDetail, ObsidianNoteItem, ObsidianSearchMatch, ObsidianSearchResponse,
    ObsidianTagItem, ObsidianVaultSummary, QuickCaptureRequest,
};

pub struct ObsidianManager;

impl ObsidianManager {
    /// Discovers the active Obsidian Vault path
    pub fn find_vault_path() -> Option<PathBuf> {
        if let Ok(env_path) = std::env::var("OBSIDIAN_VAULT_PATH") {
            let p = PathBuf::from(env_path);
            if p.exists() && p.is_dir() {
                return Some(p);
            }
        }

        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/wishlife".to_string());
        let candidate_paths = vec![
            PathBuf::from(&home).join("Documents").join("Obsidian Vault"),
            PathBuf::from(&home).join("Obsidian Vault"),
            PathBuf::from(&home).join("workspace").join("Obsidian Vault"),
            PathBuf::from(&home).join("Library/Mobile Documents/iCloud~md~obsidian/Documents"),
            PathBuf::from(&home).join("Documents").join("Notes"),
            PathBuf::from(&home).join("Notes"),
        ];

        for path in candidate_paths {
            if path.exists() && path.join(".obsidian").exists() {
                return Some(path);
            }
        }

        // Fallback: search 2 levels down in Documents
        let docs = PathBuf::from(&home).join("Documents");
        if docs.exists() {
            if let Ok(entries) = fs::read_dir(&docs) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() && p.join(".obsidian").exists() {
                        return Some(p);
                    }
                }
            }
        }

        None
    }

    /// Generates full summary of the vault
    pub fn get_vault_summary() -> Option<ObsidianVaultSummary> {
        let vault_path = Self::find_vault_path()?;
        let vault_name = vault_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Obsidian Vault")
            .to_string();

        let mut total_notes = 0;
        let mut total_words = 0;
        let mut total_attachments = 0;
        let mut total_folders = 0;
        let mut disk_size_bytes: u64 = 0;

        let mut notes_list: Vec<ObsidianNoteItem> = Vec::new();
        let mut tag_freq: HashMap<String, usize> = HashMap::new();

        let mut all_files = Vec::new();
        Self::collect_files_recursive(&vault_path, &vault_path, 0, &mut all_files, &mut total_folders);

        for (path, metadata) in all_files {
            let file_len = metadata.len();
            disk_size_bytes += file_len;

            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();

            let is_attachment = matches!(
                ext.as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "pdf" | "canvas" | "mp4" | "mp3" | "m4a" | "zip"
            );

            if is_attachment {
                total_attachments += 1;
            } else if ext == "md" {
                total_notes += 1;

                let rel_path = path
                    .strip_prefix(&vault_path)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| path.to_string_lossy().to_string());

                let modified_system = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                let modified_timestamp = modified_system
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let modified_human = Self::format_relative_time(modified_timestamp);

                let content = fs::read_to_string(&path).unwrap_or_default();
                let word_count = Self::count_words(&content);
                total_words += word_count;

                let title = Self::extract_title(&content, &path);
                let tags = Self::extract_tags(&content);
                for t in &tags {
                    *tag_freq.entry(t.clone()).or_insert(0) += 1;
                }

                let preview_snippet = Self::extract_preview(&content);

                notes_list.push(ObsidianNoteItem {
                    rel_path,
                    title,
                    size_bytes: file_len,
                    modified_timestamp,
                    modified_human,
                    tags,
                    word_count,
                    preview_snippet,
                });
            }
        }

        // Sort notes by modified time descending (newest first)
        notes_list.sort_by(|a, b| b.modified_timestamp.cmp(&a.modified_timestamp));
        let recent_notes = notes_list.into_iter().take(30).collect();

        // Sort tags by frequency descending
        let mut top_tags: Vec<ObsidianTagItem> = tag_freq
            .into_iter()
            .map(|(name, count)| ObsidianTagItem { name, count })
            .collect();
        top_tags.sort_by(|a, b| b.count.cmp(&a.count));
        top_tags.truncate(20);

        // Git Status Check
        let (git_branch, git_dirty, git_uncommitted_count) = Self::inspect_vault_git(&vault_path);
        let disk_size_human = Self::format_bytes(disk_size_bytes);

        Some(ObsidianVaultSummary {
            vault_name,
            vault_path: vault_path.to_string_lossy().to_string(),
            total_notes,
            total_words,
            total_attachments,
            total_folders,
            disk_size_bytes,
            disk_size_human,
            git_branch,
            git_dirty,
            git_uncommitted_count,
            recent_notes,
            top_tags,
        })
    }

    /// Reads specific note markdown detail
    pub fn get_note_detail(rel_path: &str) -> Option<ObsidianNoteDetail> {
        let vault_path = Self::find_vault_path()?;
        let clean_path = rel_path.trim_start_matches('/');
        if clean_path.contains("..") {
            return None;
        }

        let full_path = vault_path.join(clean_path);
        if !full_path.exists() || !full_path.is_file() {
            return None;
        }

        let content = fs::read_to_string(&full_path).ok()?;
        let metadata = fs::metadata(&full_path).ok()?;
        let size_bytes = metadata.len();
        let modified_system = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        let modified_timestamp = modified_system
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let modified_human = Self::format_relative_time(modified_timestamp);
        let title = Self::extract_title(&content, &full_path);
        let tags = Self::extract_tags(&content);
        let word_count = Self::count_words(&content);

        Some(ObsidianNoteDetail {
            rel_path: clean_path.to_string(),
            title,
            content,
            tags,
            modified_human,
            word_count,
            size_bytes,
        })
    }

    /// Full-text search in markdown files
    pub fn search_vault(query: &str) -> ObsidianSearchResponse {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return ObsidianSearchResponse {
                query: query.to_string(),
                total_matches: 0,
                matches: Vec::new(),
            };
        }

        let Some(vault_path) = Self::find_vault_path() else {
            return ObsidianSearchResponse {
                query: query.to_string(),
                total_matches: 0,
                matches: Vec::new(),
            };
        };

        let mut all_files = Vec::new();
        let mut folder_count = 0;
        Self::collect_files_recursive(&vault_path, &vault_path, 0, &mut all_files, &mut folder_count);

        let mut matches = Vec::new();

        for (path, _) in all_files {
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let rel_path = path
                        .strip_prefix(&vault_path)
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|_| path.to_string_lossy().to_string());

                    let title = Self::extract_title(&content, &path);

                    for (idx, line) in content.lines().enumerate() {
                        if line.to_lowercase().contains(&q) {
                            let trimmed = line.trim();
                            if !trimmed.is_empty() {
                                matches.push(ObsidianSearchMatch {
                                    rel_path: rel_path.clone(),
                                    title: title.clone(),
                                    line_number: idx + 1,
                                    line_content: trimmed.chars().take(200).collect(),
                                });

                                if matches.len() >= 60 {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if matches.len() >= 60 {
                break;
            }
        }

        let total_matches = matches.len();
        ObsidianSearchResponse {
            query: query.to_string(),
            total_matches,
            matches,
        }
    }

    /// Fast append quick capture note to daily note or inbox file
    pub fn quick_capture(req: QuickCaptureRequest) -> Result<String, String> {
        let vault_path = Self::find_vault_path()
            .ok_or_else(|| "Obsidian Vault not found on system".to_string())?;

        let content = req.content.trim();
        if content.is_empty() {
            return Err("Quick capture content cannot be empty".to_string());
        }

        let now = Local::now();
        let timestamp_str = now.format("%H:%M:%S").to_string();
        let date_str = now.format("%Y-%m-%d").to_string();

        let target_file_path: PathBuf = match req.target.as_deref() {
            Some("inbox") => vault_path.join("QuickCapture.md"),
            Some(custom_path) if !custom_path.is_empty() && custom_path != "daily" => {
                if custom_path.contains("..") {
                    return Err("Invalid path containing parent traversal".to_string());
                }
                vault_path.join(custom_path.trim_start_matches('/'))
            }
            _ => {
                let daily_dir = Self::get_daily_notes_folder(&vault_path);
                daily_dir.join(format!("{}.md", date_str))
            }
        };

        if let Some(parent) = target_file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let tag_suffix = req
            .tag
            .map(|t| {
                let clean_t = t.trim().trim_start_matches('#');
                if !clean_t.is_empty() {
                    format!(" #{}", clean_t)
                } else {
                    "".to_string()
                }
            })
            .unwrap_or_default();

        let entry_line = format!("\n- **{}** {}{}\n", timestamp_str, content, tag_suffix);

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&target_file_path)
            .map_err(|e| format!("Failed to open target file: {}", e))?;

        if file.metadata().map(|m| m.len() == 0).unwrap_or(false) {
            let header = format!("# {}\n", date_str);
            let _ = file.write_all(header.as_bytes());
        }

        file.write_all(entry_line.as_bytes())
            .map_err(|e| format!("Failed to write entry: {}", e))?;

        let rel_target = target_file_path
            .strip_prefix(&vault_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| target_file_path.to_string_lossy().to_string());

        Ok(format!("Saved to {}", rel_target))
    }

    /// Native open via obsidian:// URL or finder/code/terminal
    pub fn open_obsidian(file_path: Option<&str>, target_app: Option<&str>) -> Result<String, String> {
        let vault_path = Self::find_vault_path()
            .ok_or_else(|| "Obsidian Vault not found".to_string())?;

        let vault_name = vault_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Obsidian Vault");

        let app = target_app.unwrap_or("obsidian");

        match app {
            "obsidian" => {
                let deep_link = match file_path {
                    Some(fp) if !fp.trim().is_empty() => {
                        let clean = fp.trim().trim_start_matches('/');
                        let encoded_vault = Self::url_encode(vault_name);
                        let encoded_file = Self::url_encode(clean);
                        format!("obsidian://open?vault={}&file={}", encoded_vault, encoded_file)
                    }
                    _ => {
                        let encoded_vault = Self::url_encode(vault_name);
                        format!("obsidian://open?vault={}", encoded_vault)
                    }
                };

                Command::new("open")
                    .arg(&deep_link)
                    .spawn()
                    .map_err(|e| format!("Failed to launch Obsidian: {}", e))?;

                Ok(format!("Opened {}", deep_link))
            }
            "finder" => {
                let target = match file_path {
                    Some(fp) if !fp.trim().is_empty() => vault_path.join(fp.trim().trim_start_matches('/')),
                    _ => vault_path,
                };
                Command::new("open")
                    .arg("-R")
                    .arg(&target)
                    .spawn()
                    .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
                Ok("Revealed in Finder".to_string())
            }
            "code" => {
                let target = match file_path {
                    Some(fp) if !fp.trim().is_empty() => vault_path.join(fp.trim().trim_start_matches('/')),
                    _ => vault_path,
                };
                Command::new("code")
                    .arg(&target)
                    .spawn()
                    .map_err(|e| format!("Failed to open VS Code: {}", e))?;
                Ok("Opened in VS Code".to_string())
            }
            "terminal" => {
                Command::new("open")
                    .arg("-a")
                    .arg("Terminal")
                    .arg(&vault_path)
                    .spawn()
                    .map_err(|e| format!("Failed to open Terminal: {}", e))?;
                Ok("Opened in Terminal".to_string())
            }
            _ => Err(format!("Unknown target app: {}", app)),
        }
    }

    // --- Helpers ---

    fn collect_files_recursive(
        dir: &Path,
        vault_root: &Path,
        depth: usize,
        out: &mut Vec<(PathBuf, fs::Metadata)>,
        folder_count: &mut usize,
    ) {
        if depth > 10 {
            return;
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if file_name.starts_with(".git")
                    || file_name.starts_with(".obsidian")
                    || file_name.starts_with(".trash")
                    || file_name == "node_modules"
                    || file_name.starts_with('.')
                {
                    continue;
                }

                if let Ok(meta) = entry.metadata() {
                    if meta.is_dir() {
                        if path != vault_root {
                            *folder_count += 1;
                        }
                        Self::collect_files_recursive(&path, vault_root, depth + 1, out, folder_count);
                    } else if meta.is_file() {
                        out.push((path, meta));
                    }
                }
            }
        }
    }

    fn url_encode(input: &str) -> String {
        let mut encoded = String::with_capacity(input.len() * 3);
        for b in input.as_bytes() {
            match *b {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(*b as char);
                }
                _ => {
                    encoded.push_str(&format!("%{:02X}", b));
                }
            }
        }
        encoded
    }

    fn get_daily_notes_folder(vault_path: &Path) -> PathBuf {
        let config_file = vault_path.join(".obsidian").join("daily-notes.json");
        if config_file.exists() {
            if let Ok(content) = fs::read_to_string(config_file) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    if let Some(folder) = json.get("folder").and_then(|f| f.as_str()) {
                        let clean = folder.trim().trim_matches('/');
                        if !clean.is_empty() {
                            return vault_path.join(clean);
                        }
                    }
                }
            }
        }

        if vault_path.join("笔记").exists() {
            vault_path.join("笔记")
        } else if vault_path.join("Daily").exists() {
            vault_path.join("Daily")
        } else {
            vault_path.to_path_buf()
        }
    }

    fn inspect_vault_git(vault_path: &Path) -> (Option<String>, bool, usize) {
        if !vault_path.join(".git").exists() {
            return (None, false, 0);
        }

        let branch = Command::new("git")
            .current_dir(vault_path)
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .output()
            .ok()
            .and_then(|out| {
                if out.status.success() {
                    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !s.is_empty() {
                        Some(s)
                    } else {
                        None
                    }
                } else {
                    None
                }
            });

        let status_out = Command::new("git")
            .current_dir(vault_path)
            .args(["status", "--porcelain"])
            .output()
            .ok();

        if let Some(out) = status_out {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                let count = text.lines().filter(|l| !l.trim().is_empty()).count();
                return (branch, count > 0, count);
            }
        }

        (branch, false, 0)
    }

    fn extract_title(content: &str, path: &Path) -> String {
        // 1. Frontmatter title
        if content.starts_with("---") {
            if let Some(end_idx) = content[3..].find("---") {
                let frontmatter = &content[3..end_idx + 3];
                for line in frontmatter.lines() {
                    let line_t = line.trim();
                    if line_t.starts_with("title:") {
                        let title = line_t["title:".len()..].trim().trim_matches('"').trim_matches('\'');
                        if !title.is_empty() {
                            return title.to_string();
                        }
                    }
                }
            }
        }

        // 2. First Markdown # header
        for line in content.lines() {
            let line_t = line.trim();
            if line_t.starts_with("# ") {
                let heading = line_t[2..].trim();
                if !heading.is_empty() {
                    return heading.to_string();
                }
            }
        }

        // 3. File stem
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Note")
            .to_string()
    }

    fn extract_tags(content: &str) -> Vec<String> {
        let mut tags = Vec::new();

        // 1. Frontmatter tags
        if content.starts_with("---") {
            if let Some(end_idx) = content[3..].find("---") {
                let frontmatter = &content[3..end_idx + 3];
                for line in frontmatter.lines() {
                    let line_t = line.trim();
                    if line_t.starts_with("tags:") {
                        let tag_part = line_t["tags:".len()..].trim();
                        if tag_part.starts_with('[') && tag_part.ends_with(']') {
                            for item in tag_part[1..tag_part.len() - 1].split(',') {
                                let t = item.trim().trim_matches('"').trim_matches('\'');
                                if !t.is_empty() {
                                    tags.push(t.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Inline #tags
        for word in content.split_whitespace() {
            if word.starts_with('#') && word.len() > 1 {
                let tag_candidate = word.trim_start_matches('#').trim_matches(|c: char| {
                    !c.is_alphanumeric() && c != '_' && c != '-' && c != '/'
                });
                if !tag_candidate.is_empty()
                    && !tag_candidate.chars().all(|c| c.is_ascii_digit())
                    && !tags.contains(&tag_candidate.to_string())
                {
                    tags.push(tag_candidate.to_string());
                }
            }
        }

        tags.sort();
        tags.dedup();
        tags
    }

    fn count_words(content: &str) -> usize {
        let mut count = 0;
        let mut in_ascii_word = false;

        for c in content.chars() {
            if c.is_alphabetic() && c.is_ascii() {
                if !in_ascii_word {
                    in_ascii_word = true;
                    count += 1;
                }
            } else {
                in_ascii_word = false;
                if (c >= '\u{4e00}' && c <= '\u{9fa5}')
                    || (c >= '\u{3040}' && c <= '\u{30ff}')
                    || (c >= '\u{ac00}' && c <= '\u{d7af}')
                {
                    count += 1;
                }
            }
        }

        count
    }

    fn extract_preview(content: &str) -> String {
        let mut body = content;
        if body.starts_with("---") {
            if let Some(end) = body[3..].find("---") {
                body = &body[end + 6..];
            }
        }

        let mut lines = Vec::new();
        for line in body.lines() {
            let t = line.trim();
            if !t.is_empty() && !t.starts_with('#') && !t.starts_with("```") {
                lines.push(t);
                if lines.len() >= 3 {
                    break;
                }
            }
        }

        lines.join(" ").chars().take(140).collect()
    }

    fn format_relative_time(timestamp: u64) -> String {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        if timestamp > now {
            return "just now".to_string();
        }

        let diff = now - timestamp;
        if diff < 60 {
            "just now".to_string()
        } else if diff < 3600 {
            format!("{}m ago", diff / 60)
        } else if diff < 86400 {
            format!("{}h ago", diff / 3600)
        } else if diff < 86400 * 30 {
            format!("{}d ago", diff / 86400)
        } else {
            format!("{}mo ago", diff / (86400 * 30))
        }
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

    #[test]
    fn test_vault_discovery() {
        let p = ObsidianManager::find_vault_path();
        println!("Discovered vault path: {:?}", p);
        assert!(p.is_some(), "Vault path should be discovered");
    }

    #[test]
    fn test_vault_summary() {
        if let Some(summary) = ObsidianManager::get_vault_summary() {
            println!("Vault Name: {}", summary.vault_name);
            println!("Total Notes: {}", summary.total_notes);
            println!("Total Words: {}", summary.total_words);
            println!("Recent Notes: {}", summary.recent_notes.len());
            assert!(summary.total_notes > 0);
        }
    }

    #[test]
    fn test_search() {
        let res = ObsidianManager::search_vault("AI");
        println!("Found matches for AI: {}", res.total_matches);
    }
}

