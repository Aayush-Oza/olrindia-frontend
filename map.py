import os
import re

FRONTEND = r"D:\OLRINDIA\olr-live\frontend"
VENDOR_DIR = os.path.join(FRONTEND, "vendor")

# The line we want to insert
INSERT_LINE = '<script src="../js/firebase-chat-auth.js?v=1"></script>'

# Insert before this script (vendor-auth.js — matches any path variation)
BEFORE_PATTERN = re.compile(r'(<script[^>]+vendor-auth\.js[^>]*><\/script>)')

print("=== Patching vendor HTML files ===\n")

for fname in os.listdir(VENDOR_DIR):
    if not fname.endswith(".html"):
        continue

    html_path = os.path.join(VENDOR_DIR, fname)
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Skip if already has firebase-chat-auth
    if "firebase-chat-auth.js" in content:
        print(f"  SKIP (already present) : {fname}")
        continue

    # Check vendor-auth.js is in this file
    if not BEFORE_PATTERN.search(content):
        print(f"  SKIP (no vendor-auth.js found) : {fname}")
        continue

    # Insert the line on its own line before vendor-auth.js
    new_content = BEFORE_PATTERN.sub(
        INSERT_LINE + "\n  \\1",
        content
    )

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"  PATCHED : {fname}")

print("\n=== Done! ===")