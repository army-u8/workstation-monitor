use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVarEntry {
    pub name: String,
    pub value: String,
    pub is_secret: bool,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathEntry {
    pub index: usize,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVarsPayload {
    pub shell: String,
    pub user: String,
    pub home: String,
    pub proxy_configured: bool,
    pub proxy_summary: Option<String>,
    pub path_entries: Vec<PathEntry>,
    pub env_vars: Vec<EnvVarEntry>,
}

pub struct EnvVarsCollector;

impl EnvVarsCollector {
    pub fn collect() -> EnvVarsPayload {
        let all_vars: HashMap<String, String> = std::env::vars().collect();

        let shell = all_vars.get("SHELL").cloned().unwrap_or_else(|| "/bin/zsh".to_string());
        let user = all_vars.get("USER").cloned().unwrap_or_else(|| "user".to_string());
        let home = all_vars.get("HOME").cloned().unwrap_or_else(|| "/Users/wishlife".to_string());

        // Parse $PATH entries
        let path_str = all_vars.get("PATH").cloned().unwrap_or_default();
        let mut path_entries = Vec::new();
        for (i, p) in path_str.split(':').enumerate() {
            let p_trimmed = p.trim();
            if !p_trimmed.is_empty() {
                let exists = Path::new(p_trimmed).exists();
                path_entries.push(PathEntry {
                    index: i + 1,
                    path: p_trimmed.to_string(),
                    exists,
                });
            }
        }

        // Check proxy
        let proxy_keys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];
        let mut proxy_list = Vec::new();
        for key in &proxy_keys {
            if let Some(val) = all_vars.get(*key) {
                if !val.trim().is_empty() {
                    proxy_list.push(format!("{}={}", key, val));
                }
            }
        }
        let proxy_configured = !proxy_list.is_empty();
        let proxy_summary = if proxy_configured {
            Some(proxy_list.join(", "))
        } else {
            None
        };

        // Format env vars list
        let mut env_vars = Vec::new();
        for (name, value) in all_vars {
            let is_secret = Self::detect_secret(&name);
            let category = Self::categorize_env_var(&name);
            env_vars.push(EnvVarEntry {
                name,
                value,
                is_secret,
                category,
            });
        }

        // Sort alphabetically by variable name
        env_vars.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        EnvVarsPayload {
            shell,
            user,
            home,
            proxy_configured,
            proxy_summary,
            path_entries,
            env_vars,
        }
    }

    fn detect_secret(name: &str) -> bool {
        let upper = name.to_uppercase();
        upper.contains("KEY")
            || upper.contains("SECRET")
            || upper.contains("TOKEN")
            || upper.contains("PASSWORD")
            || upper.contains("PASSWD")
            || upper.contains("AUTH")
            || upper.contains("PRIVATE")
            || upper.contains("CREDENTIAL")
            || upper.contains("SIGNING")
    }

    fn categorize_env_var(name: &str) -> String {
        let upper = name.to_uppercase();
        if upper.starts_with("PROXY")
            || upper.ends_with("_PROXY")
            || upper.contains("HTTP_")
            || upper.contains("HTTPS_")
            || upper.contains("NO_PROXY")
        {
            "Proxy & Network".to_string()
        } else if upper == "PATH"
            || upper.starts_with("NODE_")
            || upper.starts_with("NVM_")
            || upper.starts_with("RUST_")
            || upper.starts_with("CARGO_")
            || upper.starts_with("PYTHON")
            || upper.starts_with("JAVA_")
            || upper.starts_with("GO")
            || upper.starts_with("DENO_")
            || upper.starts_with("BUN_")
        {
            "Dev & Runtimes".to_string()
        } else if upper == "SHELL"
            || upper == "USER"
            || upper == "HOME"
            || upper == "TERM"
            || upper == "TMPDIR"
            || upper == "LANG"
            || upper == "LC_ALL"
            || upper.starts_with("ZSH")
        {
            "System & Shell".to_string()
        } else {
            "Custom & App".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_collector() {
        let payload = EnvVarsCollector::collect();
        assert!(!payload.shell.is_empty());
        assert!(!payload.path_entries.is_empty());
        assert!(!payload.env_vars.is_empty());
    }

    #[test]
    fn test_secret_detection() {
        assert!(EnvVarsCollector::detect_secret("ANTHROPIC_API_KEY"));
        assert!(EnvVarsCollector::detect_secret("AWS_SECRET_ACCESS_KEY"));
        assert!(EnvVarsCollector::detect_secret("GITHUB_TOKEN"));
        assert!(!EnvVarsCollector::detect_secret("SHELL"));
        assert!(!EnvVarsCollector::detect_secret("PATH"));
    }
}
