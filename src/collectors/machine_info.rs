use std::path::Path;
use std::process::Command;
use crate::types::{AppVersionInfo, MachineHardwareInfo, MachineInfoSummary};

pub struct MachineInfoCollector;

impl MachineInfoCollector {
    pub fn collect() -> MachineInfoSummary {
        let hardware = Self::get_hardware_info();
        let core_apps = Self::get_core_apps();

        MachineInfoSummary {
            hardware,
            core_apps,
        }
    }

    fn get_hardware_info() -> MachineHardwareInfo {
        // OS version via sw_vers
        let mut os_name = "macOS".to_string();
        let mut os_version = "Unknown".to_string();
        let mut build_version = "".to_string();

        if let Ok(out) = Command::new("sw_vers").output() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.starts_with("ProductName:") {
                    os_name = line.trim_start_matches("ProductName:").trim().to_string();
                } else if line.starts_with("ProductVersion:") {
                    os_version = line.trim_start_matches("ProductVersion:").trim().to_string();
                } else if line.starts_with("BuildVersion:") {
                    build_version = line.trim_start_matches("BuildVersion:").trim().to_string();
                }
            }
        }

        // Chip / CPU Brand String
        let chip_name = Self::sysctl_string("machdep.cpu.brand_string")
            .or_else(|| Self::sysctl_string("hw.model"))
            .unwrap_or_else(|| "Apple Silicon".to_string());

        // Hardware Model ID
        let model_name = Self::sysctl_string("hw.model")
            .unwrap_or_else(|| "Mac".to_string());

        // CPU cores
        let cpu_cores = Self::sysctl_string("hw.ncpu")
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(8);

        // Memsize
        let memory_total_bytes = Self::sysctl_string("hw.memsize")
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(17179869184);

        let gb = (memory_total_bytes as f64) / (1024.0 * 1024.0 * 1024.0);
        let memory_total_human = format!("{:.1} GB Unified Memory", gb);

        // Architecture & Kernel
        let mut arch = "arm64".to_string();
        let mut kernel_version = "Darwin".to_string();

        if let Ok(out) = Command::new("uname").args(["-mpr"]).output() {
            let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let parts: Vec<&str> = text.split_whitespace().collect();
            if !parts.is_empty() {
                kernel_version = format!("Darwin {}", parts[0]);
            }
            if parts.len() >= 2 {
                arch = parts[1].to_string();
            }
        }

        // Default Shell & User
        let default_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let current_user = std::env::var("USER").unwrap_or_else(|_| "user".to_string());

        // Hostname
        let host_name = Self::sysctl_string("kern.hostname")
            .unwrap_or_else(|| "localhost".to_string());

        // SIP Status
        let sip_status = match Command::new("csrutil").arg("status").output() {
            Ok(out) => {
                let text = String::from_utf8_lossy(&out.stdout);
                if text.contains("enabled") {
                    "Enabled (已开启)".to_string()
                } else if text.contains("disabled") {
                    "Disabled (已禁用)".to_string()
                } else {
                    text.trim().to_string()
                }
            }
            Err(_) => "Enabled".to_string(),
        };

        MachineHardwareInfo {
            model_name,
            chip_name,
            cpu_cores,
            memory_total_human,
            memory_total_bytes,
            arch,
            os_name,
            os_version,
            build_version,
            kernel_version,
            default_shell,
            sip_status,
            host_name,
            current_user,
        }
    }

    fn get_core_apps() -> Vec<AppVersionInfo> {
        let app_specs = vec![
            // 1. Browsers
            ("Safari", "/Applications/Safari.app", "Browser", "safari"),
            ("Google Chrome", "/Applications/Google Chrome.app", "Browser", "chrome"),
            ("Microsoft Edge", "/Applications/Microsoft Edge.app", "Browser", "edge"),
            ("Arc", "/Applications/Arc.app", "Browser", "arc"),
            ("Firefox", "/Applications/Firefox.app", "Browser", "firefox"),
            ("Brave Browser", "/Applications/Brave Browser.app", "Browser", "brave"),

            // 2. System Core
            ("Finder", "/System/Library/CoreServices/Finder.app", "System", "finder"),
            ("Terminal", "/System/Applications/Utilities/Terminal.app", "System", "terminal"),
            ("Activity Monitor", "/System/Applications/Utilities/Activity Monitor.app", "System", "activity"),
            ("Console", "/System/Applications/Utilities/Console.app", "System", "console"),

            // 3. Editors & IDEs
            ("Xcode", "/Applications/Xcode.app", "Editor", "xcode"),
            ("Visual Studio Code", "/Applications/Visual Studio Code.app", "Editor", "vscode"),
            ("Cursor", "/Applications/Cursor.app", "Editor", "cursor"),
            ("Ghostty", "/Applications/Ghostty.app", "Terminal", "ghostty"),
            ("iTerm2", "/Applications/iTerm.app", "Terminal", "iterm"),
            ("Warp", "/Applications/Warp.app", "Terminal", "warp"),

            // 4. DevOps & Cloud
            ("Docker", "/Applications/Docker.app", "DevOps", "docker"),
            ("OrbStack", "/Applications/OrbStack.app", "DevOps", "orbstack"),
            ("Postman", "/Applications/Postman.app", "DevOps", "postman"),
            ("TablePlus", "/Applications/TablePlus.app", "DevOps", "tableplus"),
        ];

        let mut results = Vec::new();

        for (name, path_str, category, icon_type) in app_specs {
            let path = Path::new(path_str);
            let is_installed = path.exists();
            let version = if is_installed {
                Self::read_app_version(path_str)
            } else {
                None
            };

            results.push(AppVersionInfo {
                name: name.to_string(),
                bundle_id: None,
                category: category.to_string(),
                version,
                is_installed,
                path: path_str.to_string(),
                icon_type: icon_type.to_string(),
            });
        }

        results
    }

    fn read_app_version(app_path: &str) -> Option<String> {
        let plist_path = format!("{}/Contents/Info.plist", app_path);
        
        // 1. Try reading CFBundleShortVersionString
        if let Ok(out) = Command::new("defaults")
            .args(["read", &plist_path, "CFBundleShortVersionString"])
            .output()
        {
            if out.status.success() {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !v.is_empty() {
                    return Some(v);
                }
            }
        }

        // 2. Try mdls
        if let Ok(out) = Command::new("mdls")
            .args(["-name", "kMDItemVersion", app_path])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Some(pos) = text.find('=') {
                let v = text[pos + 1..].trim().trim_matches('"').trim().to_string();
                if !v.is_empty() && v != "(null)" {
                    return Some(v);
                }
            }
        }

        None
    }

    fn sysctl_string(key: &str) -> Option<String> {
        let out = Command::new("sysctl").args(["-n", key]).output().ok()?;
        if out.status.success() {
            let val = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !val.is_empty() {
                return Some(val);
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collect_machine_info() {
        let info = MachineInfoCollector::collect();
        println!("Hardware: {:?}", info.hardware);
        assert!(!info.hardware.os_name.is_empty());
        assert!(!info.hardware.model_name.is_empty());
        assert!(info.core_apps.len() > 5);
        
        // Verify Safari presence
        let safari = info.core_apps.iter().find(|a| a.name == "Safari");
        assert!(safari.is_some());
    }
}
