# Project Cairn: Rules for AI Coding Agents

Project: Cairn, a secure, ad-free, open-source torrent client.
Read docs/PLAN.md before any task; follow its non-negotiables.

## Core Rules
- No ads, analytics, telemetry or tracking SDKs. No new dependency without a short written justification and a license check.
- All untrusted input is parsed in Rust with explicit size/depth limits and has a fuzz target.
- The UI never touches network or disk directly; all actions go through the Protobuf API in `/proto`.
- Never bind a TCP listener on 0.0.0.0 by default. Local control uses a socket or named pipe.
- Secrets live in the OS keystore, never in plain files or logs.
- Every PR: tests added or updated, `cargo clippy` and `cargo deny` clean, `flutter analyze` clean.
- Write small commits. Update docs/ADRs when a decision changes.
- If a requirement is ambiguous or a security trade-off is needed, stop and ask.

## Security Rules (Binding)
- Read Part II of `docs/PLAN.md` (sections 13 to 33) before any security-relevant change.
- Desktop = 3 processes (UI, Core, Engine) + on-demand Updater. Core has NO network. UI has NO network. Do not add network code outside Engine and Updater.
- Never accept a file path from the UI unless it came through the Core-recorded folder picker flow. All paths go through SafePath (16.4).
- Every external trigger goes to the Add sheet. Never start a download without confirmation (INV-04).
- Every parser: limits from 17.1, check-then-allocate, fuzz target, regression seeds.
- Network Guard fails closed. Never add a fallback to direct connection.
- No unwrap/expect outside tests. No unsafe outside `cairn-engine` and platform crates. Checked arithmetic for external numbers.
- Never log secrets, paths, peer IPs or torrent names at info level.
- No new dependency without an entry in `docs/dependencies.md` and a license check.
- When a requirement in Part II seems wrong or impossible on a platform, stop and write a short note proposing an alternative. Do not silently weaken it.
- Each task must state which SR-xx requirements it touches and add or update the matching tests.
