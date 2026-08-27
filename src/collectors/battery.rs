use crate::types::BatteryInfo;
use std::process::Command;

pub struct BatteryCollector;

impl BatteryCollector {
    pub fn new() -> Self {
        Self
    }

    pub fn collect(&self) -> Option<BatteryInfo> {
        let output = Command::new("pmset").arg("-g").arg("batt").output().ok()?;

        if !output.status.success() {
            return None;
        }

        let text = String::from_utf8_lossy(&output.stdout);
        parse_pmset_output(&text)
    }
}

fn parse_pmset_output(text: &str) -> Option<BatteryInfo> {
    // Example:
    // Now drawing from 'AC Power'
    //  -InternalBattery-0 (id=1234567)	98%; charging; 0:15 remaining present: true
    if !text.contains("InternalBattery") {
        return None;
    }

    let is_ac = text.contains("'AC Power'");

    let mut percentage: u8 = 0;
    let mut state = "Unknown".to_string();
    let mut time_remaining: Option<String> = None;
    let mut is_charging = false;

    for line in text.lines() {
        if line.contains("InternalBattery") || line.contains("%") {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 2 {
                let info_part = parts[1];
                let tokens: Vec<&str> = info_part.split(';').map(|s| s.trim()).collect();

                if let Some(pct_str) = tokens.first() {
                    let num_str = pct_str.trim_end_matches('%');
                    if let Ok(num) = num_str.parse::<u8>() {
                        percentage = num;
                    }
                }

                if let Some(st) = tokens.get(1) {
                    state = st.to_string();
                    if st.contains("charging") || st.contains("charged") {
                        is_charging = true;
                    }
                }

                if let Some(rem) = tokens.get(2) {
                    let rem_clean = rem.replace("present: true", "").trim().to_string();
                    if !rem_clean.is_empty() && !rem_clean.contains("(no estimate)") {
                        time_remaining = Some(rem_clean);
                    }
                }
            }
        }
    }

    if percentage == 0 && state == "Unknown" {
        return None;
    }

    Some(BatteryInfo {
        percentage,
        is_charging: is_charging || is_ac,
        state,
        time_remaining,
    })
}
