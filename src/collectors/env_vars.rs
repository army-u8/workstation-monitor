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
        let mut all_vars: HashMap<String, String> = std::env::vars().collect();

        let home = all_vars
            .get("HOME")
            .cloned()
            .or_else(|| std::env::var("HOME").ok())
            .unwrap_or_else(|| "/Users/wishlife".to_string());

        // Parse user's shell rc files to capture exported API keys that might only exist in user profiles
        let rc_files = [
            format!("{}/.zshenv", home),
            format!("{}/.zprofile", home),
            format!("{}/.zshrc", home),
            format!("{}/.bash_profile", home),
            format!("{}/.bashrc", home),
            format!("{}/.profile", home),
            format!("{}/.env", home),
        ];

        for rc_path in &rc_files {
            if let Ok(content) = std::fs::read_to_string(rc_path) {
                Self::parse_rc_content(&content, &mut all_vars);
            }
        }

        let shell = all_vars
            .get("SHELL")
            .cloned()
            .unwrap_or_else(|| "/bin/zsh".to_string());
        let user = all_vars
            .get("USER")
            .cloned()
            .or_else(|| std::env::var("USER").ok())
            .unwrap_or_else(|| "user".to_string());

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

        // Check proxy configuration
        let proxy_keys = [
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
        ];
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

    /// Parses export KEY="value" and KEY=value lines from shell profile files
    pub fn parse_rc_content(content: &str, vars: &mut HashMap<String, String>) {
        for raw_line in content.lines() {
            let line = raw_line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let line_to_parse = if let Some(stripped) = line.strip_prefix("export ") {
                stripped.trim()
            } else {
                line
            };

            if let Some((k, v)) = line_to_parse.split_once('=') {
                let key = k.trim().to_string();
                if !key.is_empty()
                    && key
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '_')
                {
                    // Clean trailing comments and matching quotes
                    let mut val_str = v.trim();
                    if let Some(idx) = val_str.find(" #") {
                        val_str = val_str[..idx].trim();
                    }

                    if (val_str.starts_with('"') && val_str.ends_with('"'))
                        || (val_str.starts_with('\'') && val_str.ends_with('\''))
                    {
                        if val_str.len() >= 2 {
                            val_str = &val_str[1..val_str.len() - 1];
                        }
                    }

                    // Only insert if not already present or if current value is empty
                    vars.entry(key)
                        .or_insert_with(|| val_str.to_string());
                }
            }
        }
    }

    pub fn detect_secret(name: &str) -> bool {
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
            || upper.contains("BEARER")
    }

    pub fn categorize_env_var(name: &str) -> String {
        let upper = name.to_uppercase();
        if upper.contains("API_KEY")
            || upper.contains("API_TOKEN")
            || upper.contains("SECRET_KEY")
            || upper.contains("ACCESS_KEY")
            || upper.contains("ACCESS_TOKEN")
            || upper.contains("AUTH_TOKEN")
            || upper.contains("APIKEY")
            || upper.ends_with("_TOKEN")
            || upper.ends_with("_KEY")
            || upper.ends_with("_SECRET")
            || upper.contains("OPENAI")
            || upper.contains("ANTHROPIC")
            || upper.contains("DEEPSEEK")
            || upper.contains("GEMINI")
            || upper.contains("GROQ")
            || upper.contains("MISTRAL")
            || upper.contains("OPENROUTER")
            || upper.contains("SILICONFLOW")
            || upper.contains("MOONSHOT")
            || upper.contains("ZHIPU")
            || upper.contains("OLLAMA")
            || upper.contains("HUGGINGFACE")
            || upper.contains("ELEVENLABS")
            || upper.contains("TAVILY")
            || upper.contains("PERPLEXITY")
            || upper.contains("COHERE")
            || upper.contains("VOYAGE")
            || upper.contains("FIREWORKS")
            || upper.contains("TOGETHER")
        {
            "API Keys & Secrets".to_string()
        } else if upper.starts_with("PROXY")
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
        assert!(EnvVarsCollector::detect_secret("OPENAI_API_KEY"));
        assert!(!EnvVarsCollector::detect_secret("SHELL"));
        assert!(!EnvVarsCollector::detect_secret("PATH"));
    }

    #[test]
    fn test_parse_rc_content() {
        let mut map = HashMap::new();
        let content = r#"
# Comments
export OPENAI_API_KEY="sk-proj-12345"
export DEEPSEEK_API_KEY='sk-deepseek-67890'
ANTHROPIC_API_KEY=sk-ant-abcde
INVALID LINE
"#;
        EnvVarsCollector::parse_rc_content(content, &mut map);
        assert_eq!(map.get("OPENAI_API_KEY").unwrap(), "sk-proj-12345");
        assert_eq!(map.get("DEEPSEEK_API_KEY").unwrap(), "sk-deepseek-67890");
        assert_eq!(map.get("ANTHROPIC_API_KEY").unwrap(), "sk-ant-abcde");
    }
}
