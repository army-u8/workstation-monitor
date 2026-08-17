#!/usr/bin/env python3
"""Generate the app icon PNG (1024x1024) using only the standard library.

Draws a dark rounded "monitor" card with four activity bars and a live dot,
matching the brand used in the Swift version (which is unavailable here due to
an SDK toolchain crash). Output: assets/AppIcon-1024.png
"""
import struct
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
        # corner regions
        cx = min(max(px, x0 + r), x1 - r)
        cy = min(max(py, y0 + r), y1 - r)
        if (px - cx) ** 2 + (py - cy) ** 2 > r * r and (px != cx or py != cy):
            # outside the corner circle
            if (px < x0 + r or px > x1 - r) and (py < y0 + r or py > y1 - r):
                return False
        return True
    return inside


# Precompute masks
card_mask = rounded_mask(PAD, PAD, S - PAD, S - PAD, 120)
bar_xs = []
bar_w = 90
gap = 70
start_x = PAD + 150
base_y = S - PAD - 120
heights = [180, 310, 440, 570]
bar_masks = []
for i, h in enumerate(heights):
    x = start_x + i * (bar_w + gap)
    bar_masks.append((bars[i], rounded_mask(x, base_y - h, x + bar_w, base_y, 24)))

# live dot
dot_cx, dot_cy, dot_r = S - PAD - 100, PAD + 100, 40
dot_mask = lambda px, py: (px - dot_cx) ** 2 + (py - dot_cy) ** 2 <= dot_r * dot_r

raw = bytearray()
for y in range(S):
    row = bytearray()
    row.append(0)  # filter type 0 (none) for each scanline
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

# Compress the whole image as ONE continuous zlib stream (PNG requires the
# concatenated IDAT data to be a single zlib datastream, not per-row streams).
idat = zlib.compress(raw, 9)

# PNG chunks
def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return c


sig = b"\x89PNG\r\n\x1a\n"
ihdr = struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0)  # 8-bit RGBA
out = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

with open("assets/AppIcon-1024.png", "wb") as f:
    f.write(out)
print("wrote assets/AppIcon-1024.png")
