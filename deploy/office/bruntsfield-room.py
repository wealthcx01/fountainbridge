"""Recolour the venture office to Bruntsfield's palette.

The room's tiles carry a colour adjustment rather than a colour: {h, s, b, c} — a hue to rotate to,
and shifts for saturation, brightness and contrast. So this is not repainting the art, it is telling
the same art which house it lives in.

Bruntsfield is a dark green (#1a3b26, hue 146), warm paper (#f7f6f2) and near-black ink (#17191f).
pixel-agents ships a blue-and-orange room: hues 209 and 214 for the walls and soft furnishings, 25
for the wood. Blue is the one that has to go — it is the only colour in the room that says "somebody
else's brand".
"""
import json, sys

src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))

BRUNTSFIELD_GREEN = 146   # --color-accent #1a3b26
WOOD = 30                 # a warmer, less orange timber

def restyle(c):
    if not isinstance(c, dict):
        return c
    h = c.get("h")
    out = dict(c)
    if h in (209, 214):
        # The blues become the house green, and most of the colour comes out of them.
        #
        # Two attempts got this wrong before it was read properly. The first only rotated the hue
        # and kept the saturation the room shipped with: a bright snooker-table green, the same
        # loudness wearing a different coat. The second pushed saturation NEGATIVE to calm it, and
        # the room came out mauve — every value pixel-agents ships is a positive saturation
        # (`{h:280,s:40,…}`, `{h:209,s:39,…}`), and a negative one is outside what the renderer is
        # built for.
        #
        # So: desaturate by moving `s` DOWN TOWARDS ZERO, never past it. Bruntsfield's accent
        # (#1a3b26) is very dark and nearly grey, so the green should be only just readable.
        out["h"] = BRUNTSFIELD_GREEN
        out["s"] = max(0, min(100, int(c.get("s", 0)) - 26))
        out["b"] = max(-100, int(c.get("b", 0)) - 8)
    elif h == 25:
        out["h"] = WOOD
        out["s"] = max(0, int(c.get("s", 0)) - 8)
        out["b"] = min(100, int(c.get("b", 0)) + 6)
    return out

d["tileColors"] = [restyle(c) for c in d["tileColors"]]
# A saved layout must outrank the packaged default, and the loader picks the highest revision.
d["layoutRevision"] = int(d.get("layoutRevision", 1)) + 1

json.dump(d, open(dst, "w"))
seen = {json.dumps(c, sort_keys=True) for c in d["tileColors"] if isinstance(c, dict)}
print(f"revision {d['layoutRevision']}, {len(d['tileColors'])} tiles, {len(seen)} distinct tones")
for c in sorted(seen):
    print("  ", c)
