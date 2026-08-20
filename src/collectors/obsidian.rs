use chrono::Local;
use serde_json::Value;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

#[cfg(unix)]
use std::ffi::{CString, OsStr};
#[cfg(unix)]
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
#[cfg(unix)]
use std::os::unix::ffi::OsStrExt;

use crate::types::{
    ObsidianNoteDetail, ObsidianNoteItem, ObsidianSearchMatch, ObsidianSearchResponse,
    ObsidianTagItem, ObsidianVaultSummary, QuickCaptureRequest,
};

pub struct ObsidianManager;

#[cfg(unix)]
struct AnchoredVault {
    root: OwnedFd,
}

#[cfg(unix)]
impl AnchoredVault {
    fn open(path: &Path) -> std::io::Result<Self> {
        let canonical = fs::canonicalize(path)?;
        let path = CString::new(canonical.as_os_str().as_bytes())
            .map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
        let fd = unsafe {
            libc::open(
                path.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        if fd == -1 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(Self {
                root: unsafe { OwnedFd::from_raw_fd(fd) },
            })
        }
    }

    fn open_child_directory(
        parent_fd: i32,
        name: &OsStr,
        create: bool,
    ) -> std::io::Result<OwnedFd> {
        let name = CString::new(name.as_bytes())
            .map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
        let open_directory = || unsafe {
            libc::openat(
                parent_fd,
                name.as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        let mut fd = open_directory();
        if fd == -1
            && create
            && std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT)
        {
            let mkdir_result = unsafe { libc::mkdirat(parent_fd, name.as_ptr(), 0o755) };
            if mkdir_result == -1
                && std::io::Error::last_os_error().raw_os_error() != Some(libc::EEXIST)
            {
                return Err(std::io::Error::last_os_error());
            }
            fd = open_directory();
        }

        if fd == -1 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(unsafe { OwnedFd::from_raw_fd(fd) })
        }
    }

    fn open_file(
        &self,
        relative: &Path,
        flags: i32,
        create_parents: bool,
    ) -> std::io::Result<File> {
        let components = relative
            .components()
            .map(|component| match component {
                Component::Normal(name) => Ok(name),
                _ => Err(std::io::Error::from(std::io::ErrorKind::InvalidInput)),
            })
            .collect::<std::io::Result<Vec<_>>>()?;
        let (file_name, directories) = components
            .split_last()
            .ok_or_else(|| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;

        let mut current_directory = None;
        for directory in directories {
            let parent_fd = current_directory
                .as_ref()
                .map(AsRawFd::as_raw_fd)
                .unwrap_or_else(|| self.root.as_raw_fd());
            current_directory = Some(Self::open_child_directory(
                parent_fd,
                directory,
                create_parents,
            )?);
        }
        let parent_fd = current_directory
            .as_ref()
            .map(AsRawFd::as_raw_fd)
            .unwrap_or_else(|| self.root.as_raw_fd());
        let file_name = CString::new(file_name.as_bytes())
            .map_err(|_| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
        let fd = unsafe {
            libc::openat(
                parent_fd,
                file_name.as_ptr(),
                flags | libc::O_CLOEXEC | libc::O_NOFOLLOW,
                0o644,
            )
        };
        if fd == -1 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(unsafe { File::from_raw_fd(fd) })
        }
    }

    fn open_read(&self, relative: &Path) -> std::io::Result<File> {
        self.open_file(relative, libc::O_RDONLY, false)
    }

    fn open_append(&self, relative: &Path) -> std::io::Result<File> {
        self.open_file(
            relative,
            libc::O_WRONLY | libc::O_APPEND | libc::O_CREAT,
            true,
        )
    }
}

impl ObsidianManager {
    /// Discovers the active Obsidian Vault path
    pub fn find_vault_path() -> Option<PathBuf> {
        let configured = std::env::var_os("OBSIDIAN_VAULT_PATH").map(PathBuf::from);
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/Users/wishlife"));
        Self::find_vault_path_from(configured.as_deref(), &home)
    }

    fn find_vault_path_from(configured: Option<&Path>, home: &Path) -> Option<PathBuf> {
        if let Some(p) = configured {
            if p.exists() && p.is_dir() {
                return Some(p.to_path_buf());
            }
        }

        let candidate_paths = vec![
            home.join("Documents").join("Obsidian Vault"),
            home.join("Obsidian Vault"),
            home.join("workspace").join("Obsidian Vault"),
            home.join("Library/Mobile Documents/iCloud~md~obsidian/Documents"),
            home.join("Documents").join("Notes"),
            home.join("Notes"),
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
        Self::collect_files_recursive(
            &vault_path,
            &vault_path,
            0,
            &mut all_files,
            &mut total_folders,
        );

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
                "png"
                    | "jpg"
                    | "jpeg"
                    | "gif"
                    | "webp"
                    | "svg"
                    | "pdf"
                    | "canvas"
                    | "mp4"
                    | "mp3"
                    | "m4a"
                    | "zip"
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
        let relative = Path::new(clean_path);
        if !Self::is_safe_relative_path(relative) {
            return None;
        }
        let anchored = AnchoredVault::open(&vault_path).ok()?;
        let mut file = anchored.open_read(relative).ok()?;
        let metadata = file.metadata().ok()?;
        if !metadata.is_file() {
            return None;
        }
        let mut content = String::new();
        file.read_to_string(&mut content).ok()?;
        let size_bytes = metadata.len();
        let modified_system = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        let modified_timestamp = modified_system
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let modified_human = Self::format_relative_time(modified_timestamp);
        let title = Self::extract_title(&content, relative);
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
        Self::collect_files_recursive(
            &vault_path,
            &vault_path,
            0,
            &mut all_files,
            &mut folder_count,
        );

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

        let requested_target: PathBuf = match req.target.as_deref() {
            Some("inbox") => vault_path.join("QuickCapture.md"),
            Some(custom_path) if !custom_path.is_empty() && custom_path != "daily" => {
                let relative = Path::new(custom_path.trim_start_matches('/'));
                if !Self::is_safe_relative_path(relative) {
                    return Err("Invalid path containing parent traversal".to_string());
                }
                vault_path.join(relative)
            }
            _ => {
                let daily_dir = Self::get_daily_notes_folder(&vault_path);
                daily_dir.join(format!("{}.md", date_str))
            }
        };
        let relative_target = requested_target
            .strip_prefix(&vault_path)
            .map_err(|_| "Capture target must be inside the Obsidian Vault".to_string())?;
        if !Self::is_safe_relative_path(relative_target) {
            return Err("Invalid capture target path".to_string());
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

        let anchored = AnchoredVault::open(&vault_path)
            .map_err(|e| format!("Failed to open Obsidian Vault: {}", e))?;
        let mut file = anchored
            .open_append(relative_target)
            .map_err(|e| format!("Failed to open target file: {}", e))?;

        if file.metadata().map(|m| m.len() == 0).unwrap_or(false) {
            let header = format!("# {}\n", date_str);
            let _ = file.write_all(header.as_bytes());
        }

        file.write_all(entry_line.as_bytes())
            .map_err(|e| format!("Failed to write entry: {}", e))?;

        let rel_target = relative_target.to_string_lossy().to_string();

        Ok(format!("Saved to {}", rel_target))
    }

    /// Native open via obsidian:// URL or finder/code/terminal
    pub fn open_obsidian(
        file_path: Option<&str>,
        target_app: Option<&str>,
    ) -> Result<String, String> {
        let vault_path =
            Self::find_vault_path().ok_or_else(|| "Obsidian Vault not found".to_string())?;

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
                        format!(
                            "obsidian://open?vault={}&file={}",
                            encoded_vault, encoded_file
                        )
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
                    Some(fp) if !fp.trim().is_empty() => {
                        vault_path.join(fp.trim().trim_start_matches('/'))
                    }
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
                    Some(fp) if !fp.trim().is_empty() => {
                        vault_path.join(fp.trim().trim_start_matches('/'))
                    }
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

    fn is_safe_relative_path(path: &Path) -> bool {
        !path.as_os_str().is_empty()
            && path
                .components()
                .all(|component| matches!(component, Component::Normal(_)))
    }

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
                        Self::collect_files_recursive(
                            &path,
                            vault_root,
                            depth + 1,
                            out,
                            folder_count,
                        );
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
                        let title = line_t["title:".len()..]
                            .trim()
                            .trim_matches('"')
                            .trim_matches('\'');
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

    #[cfg(unix)]
    fn symlink_fixture(name: &str) -> (PathBuf, PathBuf) {
        let root =
            std::env::temp_dir().join(format!("vibedesk_obsidian_{}_{}", name, std::process::id()));
        let vault = root.join("vault");
        let outside = root.join("outside");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(vault.join(".obsidian")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        (vault, outside)
    }

    #[cfg(unix)]
    #[test]
    fn note_detail_rejects_symlink_that_escapes_vault() {
        use std::os::unix::fs::symlink;

        let (vault, outside) = symlink_fixture("read_escape");
        let outside_note = outside.join("secret.md");
        fs::write(&outside_note, "# outside secret").unwrap();
        symlink(&outside_note, vault.join("escape.md")).unwrap();

        let anchored = AnchoredVault::open(&vault).unwrap();
        assert!(anchored.open_read(Path::new("escape.md")).is_err());

        fs::remove_dir_all(vault.parent().unwrap()).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn search_does_not_follow_symlinked_directories_outside_vault() {
        use std::os::unix::fs::symlink;

        let (vault, outside) = symlink_fixture("search_escape");
        fs::write(outside.join("secret.md"), "VIBEDESK_OUTSIDE_SECRET").unwrap();
        symlink(&outside, vault.join("linked-notes")).unwrap();

        let mut files = Vec::new();
        let mut folder_count = 0;
        ObsidianManager::collect_files_recursive(&vault, &vault, 0, &mut files, &mut folder_count);
        assert!(files.is_empty());

        fs::remove_dir_all(vault.parent().unwrap()).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn quick_capture_rejects_symlinked_parent_that_escapes_vault() {
        use std::os::unix::fs::symlink;

        let (vault, outside) = symlink_fixture("write_escape");
        symlink(&outside, vault.join("linked-notes")).unwrap();
        let anchored = AnchoredVault::open(&vault).unwrap();
        let result = anchored.open_append(Path::new("linked-notes/escaped.md"));

        assert!(result.is_err());
        assert!(!outside.join("escaped.md").exists());

        fs::remove_dir_all(vault.parent().unwrap()).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn anchored_read_rejects_parent_swapped_to_symlink_after_root_open() {
        use std::io::Read;
        use std::os::unix::fs::symlink;

        let (vault, outside) = symlink_fixture("read_parent_swap");
        let notes = vault.join("notes");
        fs::create_dir_all(&notes).unwrap();
        fs::write(notes.join("secret.md"), "inside").unwrap();
        fs::write(outside.join("secret.md"), "outside secret").unwrap();
        let anchored = AnchoredVault::open(&vault).unwrap();
        fs::rename(&notes, vault.join("notes-original")).unwrap();
        symlink(&outside, &notes).unwrap();

        let mut content = String::new();
        let result = anchored
            .open_read(Path::new("notes/secret.md"))
            .and_then(|mut file| file.read_to_string(&mut content));

        assert!(result.is_err());
        assert!(!content.contains("outside secret"));
        fs::remove_dir_all(vault.parent().unwrap()).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn anchored_append_rejects_parent_swapped_to_symlink_after_root_open() {
        use std::os::unix::fs::symlink;

        let (vault, outside) = symlink_fixture("write_parent_swap");
        let notes = vault.join("notes");
        fs::create_dir_all(&notes).unwrap();
        let anchored = AnchoredVault::open(&vault).unwrap();
        fs::rename(&notes, vault.join("notes-original")).unwrap();
        symlink(&outside, &notes).unwrap();

        let result = anchored.open_append(Path::new("notes/escaped.md"));

        assert!(result.is_err());
        assert!(!outside.join("escaped.md").exists());
        fs::remove_dir_all(vault.parent().unwrap()).unwrap();
    }

    #[test]
    fn test_vault_discovery() {
        let (vault, outside) = symlink_fixture("discovery");

        assert_eq!(
            ObsidianManager::find_vault_path_from(Some(&vault), &outside),
            Some(vault.clone())
        );

        fs::remove_dir_all(vault.parent().unwrap()).unwrap();
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
