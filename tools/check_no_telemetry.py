#!/usr/bin/env python3
"""
Haven / Cairn CI Gate: Verify No Analytics, Ad Networks, or Telemetry SDKs.
Enforces Section 13.1 and SR-17.
"""

import os
import sys

FORBIDDEN_KEYWORDS = [
    "google-analytics",
    "google_analytics",
    "firebase_analytics",
    "amplitude",
    "mixpanel",
    "segment.io",
    "sentry.io",
    "bugsnag",
    "crashlytics",
    "appcenter",
    "facebook_sdk",
    "admob",
    "unityads",
    "appsflyer",
    "adjust.com",
    "telemetry",
    "track_event",
    "send_analytics",
]

EXCLUDED_DIRS = {
    ".git",
    "target",
    "node_modules",
    "dist",
    ".system_generated",
    ".gemini",
}

EXCLUDED_FILES = {
    "check_no_telemetry.py",
    "AUDIT-1.md",
    "PLAN.md",
    "AGENTS.md",
}

def scan_repository(root_dir: str):
    violations = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Prune excluded directories
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]

        for filename in filenames:
            if filename in EXCLUDED_FILES:
                continue

            filepath = os.path.join(dirpath, filename)
            ext = os.path.splitext(filename)[1].lower()

            if ext not in [".rs", ".js", ".html", ".css", ".toml", ".json", ".dart", ".yaml", ".yml"]:
                continue

            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        lower_line = line.lower()
                        for keyword in FORBIDDEN_KEYWORDS:
                            if keyword in lower_line:
                                violations.append((filepath, line_num, keyword, line.strip()))
            except Exception as e:
                print(f"Warning: Could not read {filepath}: {e}")

    return violations

def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Scanning {root} for banned tracking/telemetry keywords...")
    violations = scan_repository(root)

    if violations:
        print(f"\n[FAIL] Found {len(violations)} forbidden telemetry/tracking reference(s):")
        for filepath, line_num, kw, snippet in violations:
            print(f"  {filepath}:{line_num} -> matches '{kw}': {snippet}")
        sys.exit(1)
    else:
        print("\n[PASS] Zero ads, telemetry, or analytics SDKs detected repository-wide.")
        sys.exit(0)

if __name__ == "__main__":
    main()
