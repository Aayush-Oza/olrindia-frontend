import os
import re
import shutil

FRONTEND = r"D:\OLRINDIA\olr-live\frontend"

# ── MOVES ────────────────────────────────────────────────────────────────────

CSS_MOVES = {
    "css/admin-dashboard.css": "css/admin/admin-dashboard.css",
    "css/vendor-detail.css":   "css/admin/vendor-detail.css",
}

JS_MOVES = {
    "js/admin-auth.js":      "js/admin/admin-auth.js",
    "js/admin-dashboard.js": "js/admin/admin-dashboard.js",
    "js/vendor-detail.js":   "js/admin/vendor-detail.js",
}

ALL_MOVES = {**CSS_MOVES, **JS_MOVES}

# ── STEP 1: create dirs & move files ─────────────────────────────────────────
print("=== STEP 1: Moving files ===")
for src_rel, dst_rel in ALL_MOVES.items():
    src = os.path.join(FRONTEND, src_rel)
    dst = os.path.join(FRONTEND, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(src):
        shutil.move(src, dst)
        print(f"  MOVED  {src_rel}  ->  {dst_rel}")
    else:
        print(f"  SKIP (not found): {src_rel}")

# ── STEP 2: helper ───────────────────────────────────────────────────────────

def rel_from_html(html_abs, asset_new_rel):
    html_dir = os.path.dirname(html_abs)
    asset_abs = os.path.join(FRONTEND, asset_new_rel.replace("/", os.sep))
    rel = os.path.relpath(asset_abs, html_dir)
    return rel.replace("\\", "/")

def patch_html(html_abs):
    with open(html_abs, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    for src_rel, dst_rel in ALL_MOVES.items():
        filename = os.path.basename(src_rel)
        pattern = r'((?:href|src)=["\'])([^"\']*' + re.escape(filename) + r')(\?v=\d+)?(["\'])'
        new_ref = rel_from_html(html_abs, dst_rel)

        def replacer(m, new_ref=new_ref):
            old_path = m.group(2)
            if old_path.startswith("http") or old_path.startswith("//"):
                return m.group(0)
            return f'{m.group(1)}{new_ref}?v=1{m.group(4)}'

        content = re.sub(pattern, replacer, content)

    # Reset all ?v= on local css/js to ?v=1
    def reset_version(m):
        path = m.group(2)
        if path.startswith("http") or path.startswith("//"):
            return m.group(0)
        return f'{m.group(1)}{path}?v=1{m.group(3)}'

    content = re.sub(
        r'((?:href|src)=["\'])([^"\']+\.(?:css|js))\?v=\d+(["\'])',
        reset_version,
        content
    )

    if content != original:
        with open(html_abs, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False

# ── STEP 3: patch all HTML files ─────────────────────────────────────────────
print("\n=== STEP 2: Patching HTML files ===")
for root, dirs, files in os.walk(FRONTEND):
    dirs[:] = [d for d in dirs if d != ".git"]
    for fname in files:
        if fname.endswith(".html"):
            html_abs = os.path.join(root, fname)
            rel = os.path.relpath(html_abs, FRONTEND)
            changed = patch_html(html_abs)
            print(f"  {'PATCHED' if changed else 'no change'} : {rel}")

print("\n=== Done! ===")
print("Dirs created: css/admin/  js/admin/")
print("All ?v= reset to ?v=1 across every HTML file.")