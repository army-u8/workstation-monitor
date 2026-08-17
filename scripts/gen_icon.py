#!/usr/bin/env python3
"""Generate standard Apple .iconset and assets/icon.icns with all 10 Retina resolutions.

Draws a dark rounded 'monitor' card with four activity bars and a live dot,
matching the macOS Workstation Mission Control brand.
"""
import os
import struct
import subprocess
import zlib

S = 1024
PAD = 140


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


top = (33, 38, 56)
bot = (5, 8, 15)
bars = [(77, 217, 140), (89, 192, 242), (242, 192, 89), (242, 115, 128)]
card = (26, 31, 46)
live = (242, 115, 128)


def rounded_mask(x0, y0, x1, y1, r):
    """Return a function (x,y)->bool for a rounded rect in pixel coords."""
    def inside(px, py):
        if not (x0 <= px < x1 and y0 <= py < y1):
            return False
        cx = min(max(px, x0 + r), x1 - r)
        cy = min(max(py, y0 + r), y1 - r)
        if (px - cx) ** 2 + (py - cy) ** 2 > r * r and (px != cx or py != cy):
            if (px < x0 + r or px > x1 - r) and (py < y0 + r or py > y1 - r):
                return False
        return True
    return inside


# Precompute masks
card_mask = rounded_mask(PAD, PAD, S - PAD, S - PAD, 120)
bar_w = 90
gap = 70
start_x = PAD + 150
base_y = S - PAD - 120
heights = [180, 310, 440, 570]
bar_masks = []
for i, h in enumerate(heights):
    x = start_x + i * (bar_w + gap)
    bar_masks.append((bars[i], rounded_mask(x, base_y - h, x + bar_w, base_y, 24)))

# Live dot
dot_cx, dot_cy, dot_r = S - PAD - 100, PAD + 100, 40
dot_mask = lambda px, py: (px - dot_cx) ** 2 + (py - dot_cy) ** 2 <= dot_r * dot_r

raw = bytearray()
for y in range(S):
    row = bytearray()
    row.append(0)  # filter type 0 (none)
    for x in range(S):
        t = (x + y) / (2 * S)
        bg = lerp(top, bot, t)
        r, g, b = bg
        if card_mask(x, y):
            r, g, b = card
        for (c, m) in bar_masks:
            if m(x, y):
                r, g, b = c
        if dot_mask(x, y):
            r, g, b = live
        row += bytes((r, g, b, 255))
    raw += row

idat = zlib.compress(raw, 9)


def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return c


sig = b"\x89PNG\r\n\x1a\n"
ihdr = struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0)  # 8-bit RGBA
out = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

os.makedirs("assets", exist_ok=True)
with open("assets/AppIcon-1024.png", "wb") as f:
    f.write(out)
print("✓ Generated assets/AppIcon-1024.png (1024x1024)")

# Generate Apple standard iconset with all 10 resolutions
ICONSET_SIZES = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

os.makedirs("icons.iconset", exist_ok=True)

import shutil
import sys

# Validate required macOS toolchain
sips_bin = shutil.which("sips")
iconutil_bin = shutil.which("iconutil")

if not sips_bin:
    print("error: 'sips' command not found. Cannot generate iconset.", file=sys.stderr)
    sys.exit(1)

if not iconutil_bin:
    print("error: 'iconutil' command not found. Cannot compile .icns.", file=sys.stderr)
    sys.exit(1)

for filename, px in ICONSET_SIZES:
    out_path = os.path.join("icons.iconset", filename)
    if px == 1024:
        with open(out_path, "wb") as f:
            f.write(out)
    else:
        subprocess.run(
            [sips_bin, "-z", str(px), str(px), "assets/AppIcon-1024.png", "--out", out_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )

print(f"✓ Generated icons.iconset/ with {len(ICONSET_SIZES)} Apple Retina resolutions")

# Compile .icns
subprocess.run(
    [iconutil_bin, "-c", "icns", "icons.iconset", "-o", "assets/icon.icns"],
    check=True,
)

if not os.path.exists("assets/icon.icns") or os.path.getsize("assets/icon.icns") < 10000:
    print("error: assets/icon.icns generation failed or produced invalid file.", file=sys.stderr)
    sys.exit(1)

print(f"✓ Compiled assets/icon.icns ({os.path.getsize('assets/icon.icns')} bytes, Standard 10-layer Apple ICNS)")

