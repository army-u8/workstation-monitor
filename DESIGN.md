# DESIGN.md — Workstation Mission Control Design System

## 1. Design Thesis & Mode

- **Mode:** `Operate` (macOS Native Developer Cockpit & Real-time Telemetry Observatory).
- **Core Aesthetic:** Obsidian Dark Glass & Precision Engineering.
- **Principles:**
  - **Familiarity & Trust:** Instant scanability for developers; tools disappear into the task.
  - **Density with Discipline:** Standard 4px-based spacing scale (4px / 8px / 12px / 16px / 24px); no arbitrary spacing values.
  - **Proximity over Containers:** Use spacing and alignment to group related data before reaching for cards; strictly ban nested cards.
  - **Monospace for Data:** Use JetBrains Mono / SF Mono strictly for metrics, IP addresses, ports, hashes, versions, and tabular figures (tnum).

---

## 2. Typographic System & Scale Ramp

- **Primary Sans:** Geist, -apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif
- **Data Mono:** JetBrains Mono, SF Mono, ui-monospace, Menlo, Monaco, monospace
- **Scale:**
  - **Display (Hero Telemetry):** 1.75rem (28px), leading 1.1, tracking -0.03em, weight 700
  - **Title (Section Header):** 1.125rem (18px), leading 1.25, tracking -0.02em, weight 700
  - **Subtitle / Card Head:** 0.875rem (14px), leading 1.3, tracking -0.01em, weight 600
  - **Body / Primary Label:** 0.75rem (12px), leading 1.4, tracking 0, weight 500
  - **Caption / Meta:** 0.656rem (10.5px), leading 1.35, tracking 0, weight 500
  - **Data / Numeric Code:** 0.6875rem (11px), leading 1.2, font mono, tabular tnum

---

## 3. Craft Floor Checklist

- No bounce/elastic animations: Replace with cubic-bezier(0.16, 1, 0.3, 1) exponential ease-out.
- No multi-line button labels: Buttons and Badges must enforce whitespace-nowrap shrink-0.
- No unlabeled icon buttons: Every standalone icon button must have a floating SimpleTooltip.
- No container boundary overflows: All card components must have contained boundaries.
