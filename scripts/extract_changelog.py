#!/usr/bin/env python3
import sys
import re
from pathlib import Path

def extract_section(content: str, tag_clean: str) -> str:
    # Look for [version] sections
    # Returns formatted changelog snippet for the version
    lines = content.splitlines()
    
    zh_lines = []
    en_lines = []
    
    current_lang = None
    collecting = False
    
    for line in lines:
        if '更新日志（中文）' in line:
            current_lang = 'zh'
            collecting = False
            continue
        elif 'Changelog (English)' in line:
            current_lang = 'en'
            collecting = False
            continue
        
        # Check for version header like [0.1.2] - 2026-08-17
        m = re.match(r'^\[(\d+\.\d+\.\d+.*?)\]', line.strip())
        if m:
            if m.group(1) == tag_clean:
                collecting = True
            else:
                collecting = False
                
        if collecting:
            if current_lang == 'zh':
                zh_lines.append(line)
            elif current_lang == 'en':
                en_lines.append(line)

    result = []
    if zh_lines:
        result.append("更新日志（中文）\n" + "\n".join(zh_lines).strip())
    if en_lines:
        if result:
            result.append("\n---\n")
        result.append("Changelog (English)\n" + "\n".join(en_lines).strip())
        
    return "\n".join(result)

def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else "0.1.2"
    tag_clean = tag.lstrip("v")
    
    changelog_path = Path(__file__).resolve().parent.parent / "CHANGELOG.md"
    if not changelog_path.exists():
        print(f"## {tag}\n\nNo CHANGELOG.md found.")
        return

    content = changelog_path.read_text(encoding="utf-8")
    extracted = extract_section(content, tag_clean)
    
    if not extracted:
        extracted = f"更新日志（中文）\n[{tag_clean}]\n新增\n- 版本发布\n\n---\n\nChangelog (English)\n[{tag_clean}]\nAdded\n- Release {tag_clean}"
        
    print(extracted)

if __name__ == "__main__":
    main()
