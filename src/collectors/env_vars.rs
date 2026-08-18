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
pub struct DetectedApiKey {
    pub key: String,
    pub value: String,
    pub provider: String,
    pub category: String, // "ai", "cloud", "saas", "custom"
    pub source: String,   // "~/.zshrc", "~/.zshenv", "Process Env", etc.
    pub icon: String,
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
    pub detected_api_keys: Vec<DetectedApiKey>,
}

pub struct EnvVarsCollector;

impl EnvVarsCollector {
    pub fn collect() -> EnvVarsPayload {
        let mut all_vars: HashMap<String, String> = std::env::vars().collect();
        let mut var_sources: HashMap<String, String> = HashMap::new();

        // Mark process environment variables source
        for key in all_vars.keys() {
            var_sources.insert(key.clone(), "Process Env".to_string());
        }

        // Determine user home directory reliably
        let home = Self::resolve_home_dir(&all_vars);

        // Scan shell rc files and track source
        let rc_files = [
            (format!("{}/.zshenv", home), "~/.zshenv"),
            (format!("{}/.zprofile", home), "~/.zprofile"),
            (format!("{}/.zshrc", home), "~/.zshrc"),
            (format!("{}/.bash_profile", home), "~/.bash_profile"),
            (format!("{}/.bashrc", home), "~/.bashrc"),
            (format!("{}/.profile", home), "~/.profile"),
            (format!("{}/.env", home), "~/.env"),
        ];

        for (rc_path, display_name) in &rc_files {
            if let Ok(content) = std::fs::read_to_string(rc_path) {
                Self::parse_rc_content_with_source(&content, &mut all_vars, &mut var_sources, display_name);
            }
        }

        // Scan AWS credentials file if present (~/.aws/credentials)
        let aws_cred_path = format!("{}/.aws/credentials", home);
        if let Ok(content) = std::fs::read_to_string(&aws_cred_path) {
            Self::parse_ini_credentials(&content, &mut all_vars, &mut var_sources, "~/.aws/credentials");
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

        // Format env vars list & build detected_api_keys
        let mut env_vars = Vec::new();
        let mut detected_api_keys = Vec::new();

        for (name, value) in &all_vars {
            let is_secret = Self::detect_secret(name);
            let category = Self::categorize_env_var(name);

            env_vars.push(EnvVarEntry {
                name: name.clone(),
                value: value.clone(),
                is_secret,
                category: category.clone(),
            });

            // If it's a secret, API key or token, record in detected_api_keys
            if is_secret || category == "API Keys & Secrets" {
                if !value.trim().is_empty() {
                    let (provider, cat, icon) = Self::infer_provider_and_category(name);
                    let source = var_sources.get(name).cloned().unwrap_or_else(|| "Env".to_string());
                    detected_api_keys.push(DetectedApiKey {
                        key: name.clone(),
                        value: value.clone(),
                        provider,
                        category: cat,
                        source,
                        icon,
                    });
                }
            }
        }

        // Sort alphabetically
        env_vars.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        detected_api_keys.sort_by(|a, b| a.key.to_lowercase().cmp(&b.key.to_lowercase()));

        EnvVarsPayload {
            shell,
            user,
            home,
            proxy_configured,
            proxy_summary,
            path_entries,
            env_vars,
            detected_api_keys,
        }
    }

    fn resolve_home_dir(all_vars: &HashMap<String, String>) -> String {
        if let Ok(sudo_user) = std::env::var("SUDO_USER") {
            if !sudo_user.trim().is_empty() && sudo_user != "root" {
                let candidate = format!("/Users/{}", sudo_user);
                if Path::new(&candidate).exists() {
                    return candidate;
                }
            }
        }

        if let Some(h) = all_vars.get("HOME") {
            if h != "/var/root" && Path::new(h).exists() {
                return h.clone();
            }
        }

        if let Ok(h) = std::env::var("HOME") {
            if h != "/var/root" && Path::new(&h).exists() {
                return h;
            }
        }

        // Fallback checks
        if Path::new("/Users/wishlife").exists() {
            return "/Users/wishlife".to_string();
        }

        "/Users/wishlife".to_string()
    }

    /// Parses export KEY="value" and KEY=value lines from shell profile files
    pub fn parse_rc_content_with_source(
        content: &str,
        vars: &mut HashMap<String, String>,
        sources: &mut HashMap<String, String>,
        source_name: &str,
    ) {
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

                    let val = val_str.to_string();
                    if !val.is_empty() {
                        sources.insert(key.clone(), source_name.to_string());
                        vars.insert(key, val);
                    }
                }
            }
        }
    }

    /// Parses ini-style credentials (like ~/.aws/credentials)
    pub fn parse_ini_credentials(
        content: &str,
        vars: &mut HashMap<String, String>,
        sources: &mut HashMap<String, String>,
        source_name: &str,
    ) {
        for raw_line in content.lines() {
            let line = raw_line.trim();
            if line.is_empty() || line.starts_with('#') || line.starts_with('[') {
                continue;
            }

            if let Some((k, v)) = line.split_once('=') {
                let key_raw = k.trim();
                let val_raw = v.trim();
                let upper_k = key_raw.to_uppercase();

                let key = if upper_k == "AWS_ACCESS_KEY_ID" || upper_k == "AWS_SECRET_ACCESS_KEY" {
                    upper_k
                } else {
                    format!("AWS_{}", upper_k)
                };

                if !val_raw.is_empty() {
                    sources.entry(key.clone()).or_insert_with(|| source_name.to_string());
                    vars.insert(key, val_raw.to_string());
                }
            }
        }
    }

    pub fn infer_provider_and_category(name: &str) -> (String, String, String) {
        let upper = name.to_uppercase();

        if upper.contains("OPENAI") {
            ("OpenAI".to_string(), "ai".to_string(), "🤖".to_string())
        } else if upper.contains("ANTHROPIC") || upper.contains("CLAUDE") {
            ("Anthropic Claude".to_string(), "ai".to_string(), "🧠".to_string())
        } else if upper.contains("DEEPSEEK") {
            ("DeepSeek".to_string(), "ai".to_string(), "⚡".to_string())
        } else if upper.contains("GEMINI") || upper.contains("GOOGLE") {
            ("Google Gemini".to_string(), "ai".to_string(), "✨".to_string())
        } else if upper.contains("GROQ") {
            ("Groq".to_string(), "ai".to_string(), "🚀".to_string())
        } else if upper.contains("MISTRAL") {
            ("Mistral AI".to_string(), "ai".to_string(), "🌪️".to_string())
        } else if upper.contains("OPENROUTER") {
            ("OpenRouter".to_string(), "ai".to_string(), "🌌".to_string())
        } else if upper.contains("SILICONFLOW") {
            ("SiliconFlow".to_string(), "ai".to_string(), "🌊".to_string())
        } else if upper.contains("MOONSHOT") || upper.contains("KIMI") {
            ("Moonshot Kimi".to_string(), "ai".to_string(), "🌙".to_string())
        } else if upper.contains("ZHIPU") || upper.contains("GLM") {
            ("Zhipu AI".to_string(), "ai".to_string(), "🔮".to_string())
        } else if upper.contains("OLLAMA") {
            ("Ollama".to_string(), "ai".to_string(), "🦙".to_string())
        } else if upper.contains("ELEVENLABS") {
            ("ElevenLabs".to_string(), "ai".to_string(), "🎙️".to_string())
        } else if upper.contains("HUGGINGFACE") || upper.contains("HF_") {
            ("HuggingFace".to_string(), "ai".to_string(), "🤗".to_string())
        } else if upper.contains("TAVILY") {
            ("Tavily AI".to_string(), "ai".to_string(), "🔍".to_string())
        } else if upper.contains("PERPLEXITY") {
            ("Perplexity AI".to_string(), "ai".to_string(), "💡".to_string())
        } else if upper.contains("COHERE") {
            ("Cohere".to_string(), "ai".to_string(), "🧬".to_string())
        } else if upper.contains("GITHUB") || upper.contains("GH_") {
            ("GitHub".to_string(), "cloud".to_string(), "🐙".to_string())
        } else if upper.contains("AWS_") {
            ("Amazon Web Services".to_string(), "cloud".to_string(), "☁️".to_string())
        } else if upper.contains("CLOUDFLARE") {
            ("Cloudflare".to_string(), "cloud".to_string(), "🛡️".to_string())
        } else if upper.contains("VERCEL") {
            ("Vercel".to_string(), "cloud".to_string(), "▲".to_string())
        } else if upper.contains("SUPABASE") {
            ("Supabase".to_string(), "cloud".to_string(), "⚡".to_string())
        } else if upper.contains("STRIPE") {
            ("Stripe".to_string(), "cloud".to_string(), "💳".to_string())
        } else if upper.contains("SENTRY") {
            ("Sentry".to_string(), "cloud".to_string(), "🎯".to_string())
        } else if upper.contains("RESEND") {
            ("Resend".to_string(), "cloud".to_string(), "✉️".to_string())
        } else if upper.contains("ASANA") {
            ("Asana".to_string(), "saas".to_string(), "📋".to_string())
        } else if upper.contains("TENCENT") {
            ("Tencent".to_string(), "saas".to_string(), "🐧".to_string())
        } else {
            ("Custom Credential".to_string(), "custom".to_string(), "🔑".to_string())
        }
    }

    pub fn detect_secret(name: &str) -> bool {
        let upper = name.to_uppercase();
        if upper == "SSH_AUTH_SOCK"
            || upper == "STARSHIP_SESSION_KEY"
            || upper == "TERM_SESSION_ID"
            || upper == "XPC_SERVICE_NAME"
            || upper == "SECURITYSESSIONID"
            || upper == "COLORTERM"
        {
            return false;
        }

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
        let mut sources = HashMap::new();
        let content = r#"
# Comments
export OPENAI_API_KEY="sk-proj-12345"
export DEEPSEEK_API_KEY='sk-deepseek-67890'
ANTHROPIC_API_KEY=sk-ant-abcde
INVALID LINE
"#;
        EnvVarsCollector::parse_rc_content_with_source(content, &mut map, &mut sources, "~/.zshrc");
        assert_eq!(map.get("OPENAI_API_KEY").unwrap(), "sk-proj-12345");
        assert_eq!(map.get("DEEPSEEK_API_KEY").unwrap(), "sk-deepseek-67890");
        assert_eq!(map.get("ANTHROPIC_API_KEY").unwrap(), "sk-ant-abcde");
        assert_eq!(sources.get("OPENAI_API_KEY").unwrap(), "~/.zshrc");
    }
}
