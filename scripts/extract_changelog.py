#!/usr/bin/env python3
"""Extract bilingual notes for an exact release version."""

import argparse
import re
import sys
from pathlib import Path


def extract_section(content: str, tag_clean: str) -> str:
    """Return the matching Markdown section from both language halves."""
    english_marker = "# Changelog (English)"
    if english_marker not in content:
        return ""

    chinese_content, english_content = content.split(english_marker, 1)
    version_pattern = re.compile(
        rf"^## \[{re.escape(tag_clean)}\][^\n]*\n.*?(?=^## \[|\Z)",
        re.MULTILINE | re.DOTALL,
    )

    def find_version(section: str) -> str:
        match = version_pattern.search(section)
        if match is None:
            return ""
        extracted = match.group(0).strip()
        return re.sub(r"\n---\s*$", "", extracted).strip()

    zh_section = find_version(chinese_content)
    en_section = find_version(english_content)

    if not zh_section or not en_section:
        return ""

    result = []
    result.append("更新日志（中文）\n" + zh_section)
    result.append("\n---\n")
    result.append("Changelog (English)\n" + en_section)

    return "\n".join(result)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tag", help="release tag, for example v0.2.5")
    args = parser.parse_args()
    tag = args.tag
    tag_clean = tag.lstrip("v")
    
    changelog_path = Path(__file__).resolve().parent.parent / "CHANGELOG.md"
    if not changelog_path.exists():
        print("error: CHANGELOG.md not found", file=sys.stderr)
        return 1

    content = changelog_path.read_text(encoding="utf-8")
    extracted = extract_section(content, tag_clean)

    if not extracted:
        print(
            f"error: CHANGELOG.md has no bilingual section for {tag_clean}",
            file=sys.stderr,
        )
        return 1

    print(extracted)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
