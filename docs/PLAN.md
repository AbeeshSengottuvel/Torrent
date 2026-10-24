# Project Cairn: Secure, Ad-Free Torrent Client (PC + Mobile)

**Architecture and delivery plan. Working name: Cairn.**
*Written so it can be dropped into a repo as `/docs/PLAN.md` and given to an AI coding agent (Antigravity) one phase at a time.*

---

## 1. Product Vision

A fast, calm, native-feeling BitTorrent client for Windows, macOS, Linux and Android (iOS later, with limits) that has no ads, no telemetry, no accounts, and a security model that assumes every peer on the internet is hostile.

### Non-negotiables
1. **No ads, no trackers, no analytics SDKs, no bundled offers. Ever.** No third-party SDK enters the app without written justification.
2. **Zero telemetry.** Nothing leaves the device except BitTorrent traffic and an optional, signed update check.
3. **Memory-safe handling of untrusted input.** Torrent files, magnet metadata, and peer messages are parsed in Rust or in a hardened, fuzzed, version-pinned library.
4. **Secure by default.** Safe defaults, not a hardening checklist users must discover.
5. **One engine, one API, many shells.** The UI never touches the network or the disk directly.
6. **Open source (MPL 2.0 or GPLv3)**, so the claims of no ads and strong security are verifiable.

### Scope
- **v1.0**: Windows, macOS, Linux, Android. Magnet and .torrent add, file selection, queue, limits, schedule, categories and tags, Network Guard (VPN bind and kill-switch), encryption, IP blocklist, torrent creation, signed auto-update, light and dark themes, localization framework.
- **v1.1**: RSS auto-download, remote Web UI (off by default), seeding rules, bandwidth profiles, import from other clients.
- **v2.0**: iOS (feature-limited), optional encrypted settings sync between your own devices (no cloud account), plugin-free scripting hooks.
- **Non-goals**: Built-in search or indexers of content (legal and app-store risk), built-in VPN (we bind to the user's VPN instead), cloud seedbox accounts, media streaming, cryptocurrency or any monetization inside the app.

The app is a neutral tool for the BitTorrent protocol, which has many legitimate uses (Linux distributions, game patches, open datasets, public-domain media). Include a short, plain-language notice in onboarding that users are responsible for what they download and share.

---

## 2. Key Architecture Decisions

### ADR-1: Torrent Engine
- **Decision**: Wrap libtorrent-rasterbar 2.x (C++) in a thin, safe Rust crate.
- **Why**: More than 15 years of production use (qBittorrent, Deluge), and coverage of what matters: BitTorrent v1, v2 and hybrid torrents, DHT, PEX, LSD, uTP, protocol encryption (MSE/PE), web seeds, IPv6, UPnP and NAT-PMP, resume data, and interface binding. Writing a new engine from scratch costs 12 months or more and creates new security bugs.
- **Trade-off**: A C++ attack surface. Mitigations are in section 4 (separate sandboxed process on desktop, fuzzing, pinned version, tracked upstream security advisories).
- **Alternative to test in Phase 0**: `rqbit` (pure Rust). If it reaches feature and performance parity for our v1 scope, it removes C++ entirely. Decide at the Phase 0 gate with a written benchmark.

### ADR-2: UI Framework
- **Decision**: Flutter (Dart), one codebase for Windows, macOS, Linux, Android and later iOS.
- **Why**: Own rendering pipeline means pixel-consistent UI, high frame rates, and no embedded web view, so no XSS or script-injection class of bugs. One team and one design system.

### ADR-3: Core and UI Bridge
- **Desktop**: The engine runs as a separate process, `cairn-core`, with least privilege. The UI talks to it over a Unix domain socket (macOS and Linux) or named pipe (Windows) with per-user permissions. Torrents keep running when the window is closed (tray or menu bar).
- **Mobile**: The engine runs in-process inside an Android foreground service via FFI (`flutter_rust_bridge` or `uniffi`).
- **Protobuf API**: One API contract defined in Protobuf (`/proto`): commands, queries, and a server-streamed event feed. Code is generated for Rust and Dart.
- **No localhost TCP port by default**: Removes a whole class of cross-site request attacks against local apps.

### ADR-4: Persistence
- SQLite (via `rusqlite`) for settings, torrent registry, statistics, RSS rules. Optional SQLCipher encryption with the key in the OS keystore.
- libtorrent resume data stored per torrent in the per-user data directory, written atomically (write temp file, fsync, rename).

### ADR-5: Remote Control
- A remote Web UI is off by default and ships after 1.0, over TLS with a long random token and rate limiting. Never bind to 0.0.0.0 without an explicit user action and a visible warning.

---

## 3. System Architecture

```text
┌──────────────── UI shell (Flutter) ────────────────┐
│ Screens · State (Riverpod) · Design system · i18n │
└───────────────────────┬─────────────────────────────┘
                        │ Protobuf API (commands, queries, event stream)
       Desktop: socket / named pipe   Mobile: in-process FFI
                        │
┌───────────────────────┴──────── cairn-core (Rust) ──┐
│ API server         Session manager  Storage manager │
│ Network Guard      Scheduler        RSS/automation  │
│ Settings           Stats            Update verifier │
│ Safety layer (path sanitizer, quarantine, file-type)│
└───────────────────────┬──────────────────────────────┘
                        │ safe FFI (cxx)
             libtorrent-rasterbar (C++)
                sandboxed on desktop
                        │
       OS: sockets · disk · keystore · notifications
```

### Core Modules
- `api`: Protobuf service, auth (local peer credentials), versioned contract, event stream with coalescing.
- `session`: Owns the libtorrent session, translates alerts into domain events, applies settings.
- `storage`: Download paths, free-space checks, move storage, file preallocation limits, path sanitization.
- `netguard`: Interface binding, VPN detection, kill-switch, DNS and IP leak checks, port-forward control.
- `scheduler`: Queue, global and per-torrent limits, schedule windows, battery and Wi-Fi-only rules (mobile).
- `automation`: RSS feeds, filters, seeding-ratio and time rules (v1.1).
- `stats`: Session and lifetime counters, rolling graphs, stored locally only.
- `settings`: Typed settings with validation, migration, secure defaults.
- `safety`: Filename and path validation, quarantine flags, risky file-type warnings, optional scan hook.
- `updater`: Verifies signed update manifests, never executes unverified code.
- `platform`: Thin per-OS adapters (keystore, notifications, power state, network change events).

---

## 4. Security Design & Invariants

### 4.1 Invariants (MUST always hold)
- **INV-01**: The app opens network connections only to peers, trackers, DHT nodes, web seeds (all engine only), the update host (updater only), and user-configured proxies.
- **INV-02**: In Private mode, no packet leaves the machine except through the selected VPN interface. A drop of that interface stops all engine traffic within 1 second.
- **INV-03**: No file is created, written, renamed or deleted outside the user-approved root folder of that torrent (plus app data directories).
- **INV-04**: No external trigger (magnet link, file association, Android intent, clipboard, command line, IPC call) can start a download without an explicit user confirmation in the UI.
- **INV-05**: The app never executes, opens or passes downloaded content to a shell or interpreter.
- **INV-06**: The Engine process cannot read the app database, the key material, or any user file outside the approved download and resume directories.
- **INV-07**: Every message crossing a process boundary is validated for size, schema, range and authorization before use.
- **INV-08**: No secret appears in logs, crash dumps, command lines, environment variables or error messages.
- **INV-09**: An update is accepted only if signed by a pinned key chain, not expired, and newer than the installed version.
- **INV-10**: No parser allocates memory based on an attacker-declared length before that length is checked against a hard limit.
- **INV-11**: Any internal error inside Network Guard, SafePath or the updater results in blocking, not allowing.
- **INV-12**: The shipped binaries contain no telemetry endpoint, analytics SDK or ad SDK.
- **INV-13**: In Stealth mode, torrent names never appear in notifications, task switcher, recents, or screenshots/recordings.
- **INV-14**: A torrent that crashes the Engine is automatically paused and flagged, and is never restarted without user action.

---

## 5. UI and UX Design

- **Apple-grade bar**: Calm and legible, progressive disclosure, never surprise, honest copy, native feel, accessible from day one.
- **Desktop layout**: Left sidebar, center list (with density switch and live sorting), right inspector (toggleable tabs), top toolbar, status bar with Network Guard chip.
- **Mobile layout**: Bottom navigation, swipe/multi-select transfer rows, detail sheet, persistent notification, share-sheet integration.
- **Design system**: Tokens (semantic colors, 4/8pt spacing, radii 8/12), system fonts, open-licensed icons (Lucide / Phosphor), themes (light, dark, follow system).

---

## 6. Monorepo Structure

```text
cairn/
├─ AGENTS.md            # rules for the coding agent
├─ docs/                # PLAN.md, ADRs, threat model, design system
│  ├─ adr/
│  └─ dependencies.md
├─ proto/               # Protobuf API contract (source of truth)
├─ core/                # Rust workspace
│  ├─ cairn-core/       # daemon / broker library
│  ├─ cairn-engine/     # libtorrent wrapper (cxx)
│  ├─ cairn-safety/     # path, file-type, quarantine logic
│  └─ cairn-fuzz/       # fuzz targets
├─ app/                 # Flutter app (all platforms)
├─ platform/            # per-OS glue: android service, windows, macos, linux
├─ tools/               # release, signing, SBOM, leak-test harness
└─ .github/workflows/   # CI matrix
```

---

## 7. Delivery Plan & Phases

| Phase | Goal | Exit Criteria |
|---|---|---|
| **0. Spikes & Decisions** | Compare libtorrent vs rqbit; prove Flutter to Rust bridge; prove interface-bind kill-switch; freeze threat model and API v0 | Written ADR decisions, working download prototype, benchmark |
| **1. Core Engine & API** | `cairn-core`, session, storage, safety layer, Network Guard, settings, persistence, Protobuf API | Headless CLI client downloads, resumes, survives network drop; fuzz targets in CI |
| **2. Desktop UI** | Design system, Transfers, Add sheet, Detail, Settings, tray, installers | Daily-usable on Windows, macOS, Linux; accessibility pass |
| **3. Android App** | Foreground service, scoped storage, mobile UI, notification actions, share handlers | Stable 24-hour background run on 3 device types |
| **4. Hardening & Beta** | Fuzzing at scale, leak tests, performance tuning, update system, signing, beta | No known high-severity bugs, beta feedback addressed |
| **5. Audit & 1.0** | Independent security review, fixes, docs, store listings | Audit summary published, 1.0 tagged |
