pub const USD_TO_CNY_RATE: f64 = 7.25;

#[derive(Debug, Clone, Copy)]
pub struct ModelPrice {
    pub input_per_m: f64,
    pub output_per_m: f64,
    pub cache_write_per_m: f64,
    pub cache_read_per_m: f64,
}

pub struct PricingEngine;

impl PricingEngine {
    /// Strips namespace prefixes like openrouter/, anthropic/, openai/, bedrock/, etc.
    pub fn normalize_model_id(raw_model: &str) -> String {
        let mut trimmed = raw_model.trim().to_lowercase();
        let prefixes = [
            "openrouter/",
            "anthropic/",
            "openai/",
            "google/",
            "deepseek/",
            "meta-llama/",
            "mistralai/",
            "bedrock/",
            "azure/",
            "ollama/",
            "together/",
            "groq/",
            "siliconflow/",
            "alibaba/",
            "moonshot/",
            "xai/",
            "zhipu/",
            "cohere/",
            "fireworks/",
        ];

        let mut changed = true;
        while changed {
            changed = false;
            for p in &prefixes {
                if trimmed.starts_with(p) {
                    trimmed = trimmed[p.len()..].to_string();
                    changed = true;
                    break;
                }
            }
        }
        trimmed
    }

    /// Dynamic hierarchical model pricing lookup
    pub fn get_model_price(model_name: &str) -> ModelPrice {
        let m = Self::normalize_model_id(model_name);

        // 1. Free Local & Ollama models
        if m.contains("ollama")
            || m.contains("local")
            || m.contains("gguf")
            || m.contains("localhost")
            || m.contains("127.0.0.1")
        {
            return ModelPrice {
                input_per_m: 0.0,
                output_per_m: 0.0,
                cache_write_per_m: 0.0,
                cache_read_per_m: 0.0,
            };
        }

        // 2. Anthropic Claude family (hierarchical matching)
        if m.contains("claude") || m.contains("anthropic") {
            if m.contains("opus") {
                return ModelPrice {
                    input_per_m: 15.00,
                    output_per_m: 75.00,
                    cache_write_per_m: 18.75,
                    cache_read_per_m: 1.50,
                };
            } else if m.contains("haiku") {
                return ModelPrice {
                    input_per_m: 0.80,
                    output_per_m: 4.00,
                    cache_write_per_m: 1.00,
                    cache_read_per_m: 0.08,
                };
            } else {
                // Sonnet 3.7 / 3.5 / 4.0 / default Sonnet
                return ModelPrice {
                    input_per_m: 3.00,
                    output_per_m: 15.00,
                    cache_write_per_m: 3.75,
                    cache_read_per_m: 0.30,
                };
            }
        }

        // 3. OpenAI family (hierarchical matching)
        if m.contains("gpt") || m.contains("o1") || m.contains("o3") || m.contains("o4") || m.contains("openai") || m.contains("chatgpt") {
            if m.contains("gpt-4.5") {
                return ModelPrice {
                    input_per_m: 75.00,
                    output_per_m: 150.00,
                    cache_write_per_m: 75.00,
                    cache_read_per_m: 37.50,
                };
            } else if (m.contains("o1") || m.contains("o3") || m.contains("o4")) && (m.contains("mini")) {
                return ModelPrice {
                    input_per_m: 1.10,
                    output_per_m: 4.40,
                    cache_write_per_m: 1.10,
                    cache_read_per_m: 0.55,
                };
            } else if m.contains("o1") || m.contains("o3") || m.contains("o4") {
                return ModelPrice {
                    input_per_m: 15.00,
                    output_per_m: 60.00,
                    cache_write_per_m: 15.00,
                    cache_read_per_m: 7.50,
                };
            } else if m.contains("4o-mini") || m.contains("mini") {
                return ModelPrice {
                    input_per_m: 0.15,
                    output_per_m: 0.60,
                    cache_write_per_m: 0.15,
                    cache_read_per_m: 0.075,
                };
            } else if m.contains("4o") {
                return ModelPrice {
                    input_per_m: 2.50,
                    output_per_m: 10.00,
                    cache_write_per_m: 2.50,
                    cache_read_per_m: 1.25,
                };
            } else if m.contains("gpt-4") {
                return ModelPrice {
                    input_per_m: 10.00,
                    output_per_m: 30.00,
                    cache_write_per_m: 10.00,
                    cache_read_per_m: 5.00,
                };
            } else if m.contains("gpt-3.5") {
                return ModelPrice {
                    input_per_m: 0.50,
                    output_per_m: 1.50,
                    cache_write_per_m: 0.50,
                    cache_read_per_m: 0.25,
                };
            }
        }

        // 4. DeepSeek family
        if m.contains("deepseek") || m.contains("r1") || m.contains("r2") {
            if m.contains("reasoner") || m.contains("r1") || m.contains("r2") {
                return ModelPrice {
                    input_per_m: 0.55,
                    output_per_m: 2.19,
                    cache_write_per_m: 0.55,
                    cache_read_per_m: 0.14,
                };
            } else {
                // DeepSeek V3 / V4 / Chat / Coder
                return ModelPrice {
                    input_per_m: 0.27,
                    output_per_m: 1.10,
                    cache_write_per_m: 0.27,
                    cache_read_per_m: 0.07,
                };
            }
        }

        // 5. Google Gemini family
        if m.contains("gemini") || m.contains("gemma") {
            if m.contains("pro") || m.contains("ultra") {
                return ModelPrice {
                    input_per_m: 1.25,
                    output_per_m: 5.00,
                    cache_write_per_m: 1.25,
                    cache_read_per_m: 0.3125,
                };
            } else {
                // Flash 2.5 / 2.0 / 1.5 / Flash-Lite
                return ModelPrice {
                    input_per_m: 0.10,
                    output_per_m: 0.40,
                    cache_write_per_m: 0.10,
                    cache_read_per_m: 0.025,
                };
            }
        }

        // 6. Mistral AI family
        if m.contains("mistral") || m.contains("mixtral") || m.contains("codestral") {
            if m.contains("large") || m.contains("codestral") {
                return ModelPrice {
                    input_per_m: 2.00,
                    output_per_m: 6.00,
                    cache_write_per_m: 2.00,
                    cache_read_per_m: 0.50,
                };
            } else {
                return ModelPrice {
                    input_per_m: 0.20,
                    output_per_m: 0.60,
                    cache_write_per_m: 0.20,
                    cache_read_per_m: 0.05,
                };
            }
        }

        // 7. Meta Llama family
        if m.contains("llama") {
            if m.contains("405b") {
                return ModelPrice {
                    input_per_m: 3.00,
                    output_per_m: 9.00,
                    cache_write_per_m: 3.00,
                    cache_read_per_m: 0.75,
                };
            } else if m.contains("70b") {
                return ModelPrice {
                    input_per_m: 0.60,
                    output_per_m: 1.80,
                    cache_write_per_m: 0.60,
                    cache_read_per_m: 0.15,
                };
            } else {
                return ModelPrice {
                    input_per_m: 0.10,
                    output_per_m: 0.20,
                    cache_write_per_m: 0.10,
                    cache_read_per_m: 0.02,
                };
            }
        }

        // 8. Qwen / Moonshot Kimi / xAI Grok
        if m.contains("qwen") {
            if m.contains("max") || m.contains("72b") {
                return ModelPrice {
                    input_per_m: 0.40,
                    output_per_m: 1.20,
                    cache_write_per_m: 0.40,
                    cache_read_per_m: 0.10,
                };
            } else {
                return ModelPrice {
                    input_per_m: 0.20,
                    output_per_m: 0.60,
                    cache_write_per_m: 0.20,
                    cache_read_per_m: 0.05,
                };
            }
        } else if m.contains("kimi") || m.contains("moonshot") {
            return ModelPrice {
                input_per_m: 1.00,
                output_per_m: 1.00,
                cache_write_per_m: 1.00,
                cache_read_per_m: 0.20,
            };
        } else if m.contains("grok") {
            return ModelPrice {
                input_per_m: 2.00,
                output_per_m: 10.00,
                cache_write_per_m: 2.00,
                cache_read_per_m: 0.50,
            };
        }

        // 9. Dynamic Size-Tier Fallback for any unknown or future model
        if m.contains("mini")
            || m.contains("small")
            || m.contains("nano")
            || m.contains("lite")
            || m.contains("flash")
            || m.contains("haiku")
            || m.contains("7b")
            || m.contains("8b")
        {
            ModelPrice {
                input_per_m: 0.15,
                output_per_m: 0.60,
                cache_write_per_m: 0.15,
                cache_read_per_m: 0.04,
            }
        } else if m.contains("large")
            || m.contains("opus")
            || m.contains("max")
            || m.contains("ultra")
            || m.contains("70b")
            || m.contains("405b")
            || m.contains("reasoner")
        {
            ModelPrice {
                input_per_m: 3.00,
                output_per_m: 12.00,
                cache_write_per_m: 3.00,
                cache_read_per_m: 0.75,
            }
        } else {
            // General standard fallback
            ModelPrice {
                input_per_m: 1.00,
                output_per_m: 3.00,
                cache_write_per_m: 1.00,
                cache_read_per_m: 0.25,
            }
        }
    }

    pub fn calculate_cost(
        model_name: &str,
        input_tokens: u64,
        output_tokens: u64,
        cache_read_tokens: u64,
        cache_write_tokens: u64,
    ) -> (f64, f64, f64) {
        let price = Self::get_model_price(model_name);

        let input_cost = (input_tokens as f64 / 1_000_000.0) * price.input_per_m;
        let output_cost = (output_tokens as f64 / 1_000_000.0) * price.output_per_m;
        let cache_write_cost = (cache_write_tokens as f64 / 1_000_000.0) * price.cache_write_per_m;
        let cache_read_cost = (cache_read_tokens as f64 / 1_000_000.0) * price.cache_read_per_m;

        let total_cost_usd = input_cost + output_cost + cache_write_cost + cache_read_cost;
        let total_cost_cny = total_cost_usd * USD_TO_CNY_RATE;

        // Savings = cache_read_tokens * (regular_input_price - cache_read_price)
        let savings_usd = if price.input_per_m > price.cache_read_per_m {
            (cache_read_tokens as f64 / 1_000_000.0) * (price.input_per_m - price.cache_read_per_m)
        } else {
            0.0
        };

        (total_cost_usd, total_cost_cny, savings_usd)
    }

    /// Dynamic provider resolution from model ID or namespace
    pub fn resolve_provider(model_name: &str) -> (&'static str, &'static str) {
        let m = model_name.to_lowercase();
        if m.contains("ollama") || m.contains("local") || m.contains("gguf") || m.contains("localhost") {
            ("Ollama Local", "ollama")
        } else if m.contains("claude") || m.contains("anthropic") {
            ("Anthropic", "anthropic")
        } else if m.contains("gpt")
            || m.contains("o1")
            || m.contains("o3")
            || m.contains("o4")
            || m.contains("chatgpt")
            || m.contains("openai")
            || m.contains("codex")
            || m.contains("dall-e")
        {
            ("OpenAI", "openai")
        } else if m.contains("deepseek") || m.contains("r1") || m.contains("r2") {
            ("DeepSeek", "deepseek")
        } else if m.contains("gemini") || m.contains("gemma") || m.contains("google") {
            ("Google", "gemini")
        } else if m.contains("llama") || m.contains("meta") {
            ("Meta", "meta")
        } else if m.contains("mistral") || m.contains("mixtral") || m.contains("codestral") {
            ("Mistral AI", "mistral")
        } else if m.contains("qwen") || m.contains("alibaba") || m.contains("dashscope") {
            ("Alibaba Cloud", "qwen")
        } else if m.contains("kimi") || m.contains("moonshot") {
            ("Moonshot AI", "kimi")
        } else if m.contains("grok") || m.contains("xai") {
            ("xAI", "xai")
        } else if m.contains("glm") || m.contains("zhipu") {
            ("Zhipu AI", "zhipu")
        } else if m.contains("doubao") || m.contains("bytedance") {
            ("ByteDance", "doubao")
        } else if m.contains("ernie") || m.contains("baidu") {
            ("Baidu", "baidu")
        } else if m.contains("openrouter") {
            ("OpenRouter", "openrouter")
        } else if m.contains("siliconflow") {
            ("SiliconFlow", "siliconflow")
        } else if m.contains("groq") {
            ("Groq", "groq")
        } else {
            ("Custom Provider", "custom")
        }
    }

    fn strip_date_suffix(s: &str) -> String {
        let mut res = s.to_string();
        if let Some(pos) = res.find('@') {
            res.truncate(pos);
        }
        // Match -YYYY-MM-DD (11 chars: -2025-02-27)
        if res.len() >= 11 {
            let last_11 = &res[res.len() - 11..];
            if last_11.starts_with('-') {
                let date_part = &last_11[1..];
                let parts: Vec<&str> = date_part.split('-').collect();
                if parts.len() == 3
                    && parts[0].len() == 4
                    && parts[0].chars().all(|c| c.is_ascii_digit())
                    && parts[1].len() == 2
                    && parts[1].chars().all(|c| c.is_ascii_digit())
                    && parts[2].len() == 2
                    && parts[2].chars().all(|c| c.is_ascii_digit())
                {
                    let new_len = res.len() - 11;
                    res.truncate(new_len);
                }
            }
        }
        // Match -YYYYMMDD (9 chars: -20250219)
        if res.len() >= 9 {
            let last_9 = &res[res.len() - 9..];
            if last_9.starts_with('-') && last_9[1..].chars().all(|c| c.is_ascii_digit()) {
                let new_len = res.len() - 9;
                res.truncate(new_len);
            }
        }
        res
    }

    /// Dynamic formatting of any arbitrary model identifier
    pub fn format_model_name(raw_model: &str) -> String {
        let trimmed_raw = raw_model
            .trim_matches(|c: char| c == '.' || c == '`' || c == ' ' || c == '\n' || c == '\r' || c == '"' || c == '\'');
        let cleaned = Self::normalize_model_id(trimmed_raw);
        let undated = Self::strip_date_suffix(&cleaned);

        // Replace version dashes: e.g. claude-3-7-sonnet -> claude-3.7-sonnet
        let normalized = undated
            .replace("-3-7-", "-3.7-")
            .replace("-3-5-", "-3.5-")
            .replace("-2-5-", "-2.5-")
            .replace("-2-0-", "-2.0-")
            .replace("-1-5-", "-1.5-")
            .replace("-3-0-", "-3.0-");

        if normalized.starts_with("claude-") {
            let parts: Vec<&str> = normalized.split('-').collect();
            let mut formatted = String::from("Claude");
            for part in parts.iter().skip(1) {
                if *part == "sonnet" {
                    formatted.push_str(" Sonnet");
                } else if *part == "haiku" {
                    formatted.push_str(" Haiku");
                } else if *part == "opus" {
                    formatted.push_str(" Opus");
                } else {
                    formatted.push(' ');
                    formatted.push_str(part);
                }
            }
            return formatted;
        }

        if normalized.starts_with("gpt-") {
            let rest = normalized.strip_prefix("gpt-").unwrap_or(&normalized);
            let parts: Vec<&str> = rest.split('-').collect();
            let mut formatted = String::from("GPT");
            for (idx, part) in parts.iter().enumerate() {
                if idx == 0 {
                    formatted.push('-');
                } else {
                    formatted.push(' ');
                }
                let mut c = part.chars();
                match c.next() {
                    None => {}
                    Some(f) => {
                        formatted.push(f.to_ascii_uppercase());
                        formatted.push_str(c.as_str());
                    }
                }
            }
            return formatted
                .replace("GPT-4o Mini", "GPT-4o mini")
                .replace("GPT-4.5 Preview", "GPT-4.5 Preview")
                .replace("GPT-4 Turbo", "GPT-4 Turbo");
        }

        if normalized.starts_with("gemini-") {
            let rest = normalized.strip_prefix("gemini-").unwrap_or(&normalized);
            let parts: Vec<&str> = rest.split('-').collect();
            let mut formatted = String::from("Gemini");
            for part in parts {
                formatted.push(' ');
                let mut c = part.chars();
                match c.next() {
                    None => {}
                    Some(f) => {
                        formatted.push(f.to_ascii_uppercase());
                        formatted.push_str(c.as_str());
                    }
                }
            }
            return formatted;
        }

        if normalized.starts_with("deepseek-") {
            let rest = normalized.strip_prefix("deepseek-").unwrap_or(&normalized);
            let parts: Vec<&str> = rest.split('-').collect();
            let mut formatted = String::from("DeepSeek");
            for part in parts {
                formatted.push(' ');
                let mut c = part.chars();
                match c.next() {
                    None => {}
                    Some(f) => {
                        formatted.push(f.to_ascii_uppercase());
                        formatted.push_str(c.as_str());
                    }
                }
            }
            return formatted;
        }

        // Generic dynamic Title Case formatting for arbitrary models
        let tokens: Vec<&str> = raw_model.split(|c: char| c == '-' || c == '_' || c == '/' || c == ':').collect();
        let mut title = Vec::new();
        for token in tokens {
            let t = token.trim();
            if t.is_empty() {
                continue;
            }
            if t.len() == 8 && t.chars().all(|c| c.is_ascii_digit()) {
                continue;
            }
            let mut c = t.chars();
            match c.next() {
                None => {}
                Some(first) => {
                    let mut capitalized = String::new();
                    capitalized.push(first.to_ascii_uppercase());
                    capitalized.push_str(c.as_str());
                    title.push(capitalized);
                }
            }
        }

        if title.is_empty() {
            raw_model.to_string()
        } else {
            title.join(" ")
        }
    }
}
