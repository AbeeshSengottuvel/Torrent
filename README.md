# 🛡️ Haven (formerly Cairn)

> **A fast, calm, native BitTorrent client designed for radical privacy, zero telemetry, and fail-closed network security.**  
> Built with a defense-in-depth architecture that assumes every peer on the internet is hostile.

[![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0_Stable-10b981.svg)](version.json)
[![Website](https://img.shields.io/badge/Website-abeeshsengottuvel.github.io%2FTorrent-10b981.svg)](https://abeeshsengottuvel.github.io/Torrent/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Interactive_Experience-38bdf8.svg)](https://abeeshsengottuvel.github.io/Torrent/experience.html)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](https://opensource.org/licenses/MPL-2.0)
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Strictly_0%25-brightgreen.svg)](tools/check_no_telemetry.py)
[![Security Invariants](https://img.shields.io/badge/Security-INV--01_to_INV--14-emerald.svg)](docs/PLAN.md)
[![Tamper Tests](https://img.shields.io/badge/Updater_Tests-9%2F9_Pass-success.svg)](tools/test_updater_tamper.js)
[![Architecture Spec](https://img.shields.io/badge/Docs-ARCHITECTURE.md-informational.svg)](docs/ARCHITECTURE.md)

---

## 🌐 Official Website & Live Web Experience

The official Haven website is live and hosted on GitHub Pages:

* 🚀 **Main Product Page**: **[https://abeeshsengottuvel.github.io/Torrent/](https://abeeshsengottuvel.github.io/Torrent/)**  
  *Modern Alpine theme with light/dark mode, interactive feature tours, security specs, and full mobile responsiveness.*
* ⚡ **Live Web Experience (Interactive Demo)**: **[https://abeeshsengottuvel.github.io/Torrent/experience.html](https://abeeshsengottuvel.github.io/Torrent/experience.html)**  
  *In-browser client simulation with live transfers (Ubuntu, Blender, Arch Linux), bandwidth waveforms, swarm peer tables, piece map, and settings studio.*
* 📦 **Download & Easy Setup Guide**: **[https://abeeshsengottuvel.github.io/Torrent/download.html](https://abeeshsengottuvel.github.io/Torrent/download.html)**  
  *Direct downloads for standalone installers, portable ZIPs, setup scripts, and SHA-256 verification checksums.*

---

## 📌 Project Status & Roadmap

To maintain complete transparency on current implementation and upcoming milestones:

| Platform / Feature | Status | Notes |
|---|---|---|
| **Windows Desktop App** | **Working (v1.0.0)** | Standalone 64-bit application with genuine P2P engine, live DHT/swarms, Traffic Throttle QoS limiter, Quarantined filter, Direct I/O waveforms, drag-and-drop ingestion, System Tray integration, and SafePath traversal defense. |
| **Windows Installer** | **Working (v1.0.0)** | Per-user setup executable (`Haven-Setup.exe` / `Haven-Setup-1.0.0-x64.exe`), zero admin rights needed, installs to `%LOCALAPPDATA%\Programs\Haven`. |
| **Windows Setup Script** | **Working (v1.0.0)** | Fallback setup batch script (`Haven-Setup.bat`) allowing zero-friction install if Windows SmartScreen or AppLocker restricts unsigned executables. |
| **Portable Package** | **Working (v1.0.0)** | Standalone zero-install archive (`Haven-Portable.zip` / `Haven-1.0.0-win-x64-portable.zip`). |
| **Official Website** | **Live & Responsive** | Alpine-themed product showcase in `site/`, featuring light/dark mode, mobile navigation drawer, and automatic deployment via `.github/workflows/pages.yml`. |
| **Live Web Experience** | **Working (In-Browser)** | Client simulation in `site/experience.html` allowing instant test-drives of swarm transfers, piece maps, and diagnostics. |
| **Signed Auto-Updates** | **Verified (D1b)** | Ed25519 dual-key offline signed TUF manifest (`docs/UPDATE-DESIGN.md`, `tools/haven_sign.js`, 9/9 tamper tests pass). |
| **Linux & macOS Desktop** | **In Progress (Phase 2)** | Core backend builds cleanly; 1-click launcher script `start-haven-pc.sh` and cross-platform Electron shell ready. |
| **Android App** | **Planned (Phase 3)** | Native foreground service, Android SAF scoped storage, and mobile UI. |
| **iOS App** | **Later (Phase 6 / v2.0)** | Feasibility spike for background execution limits; not promised for v1.0. |
| **Remote Web UI** | **Later (v1.1)** | Disabled by default per ADR-5; TLS + token authentication required. |

---

## ⚡ Quick Start

### 1. Launch the Desktop Application

Haven runs as a standalone desktop application with native window frames, OS file pickers, and defense-in-depth security controls:

* **One-Click Launch (Windows)**: Double-click **[`start-haven-pc.bat`](start-haven-pc.bat)**.
* **One-Click Launch (Linux / macOS)**: Run **`./start-haven-pc.sh`**.
* **Direct Installed Binary**: Run `%LOCALAPPDATA%\Programs\Haven\Haven.exe` or open from your Windows Start Menu (`Haven`).
* **Run in Development Mode**:
  ```powershell
  cd desktop
  npm install
  npm start
  ```

### 2. View the Website & Interactive Demo Locally

Preview the official website, download guide, and interactive in-browser simulation on your machine:

* **Using Python Server (Port 3000, RFC 6266 download headers)**:
  ```powershell
  python tools/serve_site.py
  ```
* **Using Node.js Server (Port 5173)**:
  ```powershell
  node site/server.js
  ```

Open your browser to:
- **Landing Page**: [http://localhost:3000/](http://localhost:3000/) (or `http://localhost:5173/` if using Node)
- **Live Web Experience (Interactive Demo)**: [http://localhost:3000/experience.html](http://localhost:3000/experience.html)
- **Download & Setup Guide**: [http://localhost:3000/download.html](http://localhost:3000/download.html)

### 3. Build & Package from Source

#### Step A: Package Standalone Desktop Application
```powershell
cd desktop
npm install
npm run package
```
*Generated output: `desktop/dist/Haven-win32-x64/Haven.exe`.*

#### Step B: Build Windows Installer & Portable ZIP (Task D1a)
```powershell
powershell -ExecutionPolicy Bypass -File tools/build_windows_installer.ps1
```
*Compiles the per-user installer (`Haven-Setup-1.0.0-x64.exe`), per-user uninstaller (`Haven-Uninstall.exe`), portable archive (`Haven-1.0.0-win-x64-portable.zip`), and calculates SHA-256 checksums in `desktop/dist/SHA256SUMS.txt`.*

#### Step C: Associate `magnet:` Protocol on Windows
```powershell
powershell -ExecutionPolicy Bypass -File tools/register_magnet_protocol.ps1
```
*Registers Haven in `HKCU:\Software\Classes\magnet` so clicking magnet links in any browser launches Haven automatically.*

---

## ✨ Core Security & Product Features

* **🛡️ Network Guard (Fail-Closed Killswitch)**: Binds swarm traffic strictly to your VPN interface (`WireGuard`, `OpenVPN`, `wg0`, `tun0`). If the VPN connection drops, all peer transfers are halted within 1 second (`SR-07`, `INV-02`).
* **📁 SafePath Path Traversal Neutralization (Section 16.4)**: Untrusted torrent file paths are sanitized, strictly bounded, and restricted to user-approved download roots. Traversal attacks (`..`, slashes, NUL bytes, Windows reserved device names `CON`, `PRN`, `AUX`, `NUL`, BiDi overrides) are rejected.
* **⚡ Genuine BitTorrent P2P Engine**: Live WebTorrent v3 engine integration with true DHT peer discovery, tracker communication, piece-integrity verification, and Direct I/O disk writes.
* **📊 Live Direct I/O Waveforms & QoS Rate Limiter**: High-precision bezier curve throughput charts, real-time download/upload metrics, and dynamic QoS bandwidth limits (`SR-08`).
* **🔒 Zero-Trust Custom Protocol (`haven://`) & Hardened Sandbox**: UI is served exclusively via custom `haven://` protocol scheme with strict CSP (`default-src 'none'`), no raw network sockets, no Node.js access in renderer, and verified IPC sender frames (`SR-03`).
* **🔍 Swarm Diagnostics & Peer Mesh Graph**: Interactive peer visualization, country flag and client identification, wire latency metrics, and non-blocking queue.
* **🗑️ Safe Disconnect & Keep Files**: Multi-tier deletion allowing users to sever swarm connections while retaining local downloads, or cleanly delete both.
* **🔒 Hardened Bencode Parser**: Check-then-allocate parsing enforcing 16 MiB maximum file size, 64-level maximum recursion depth, and 2,000,000 token limit (`INV-10`, `SR-04`).
* **⚠️ Risky File Warnings & Mark-of-the-Web**: Automatic security warning indicators on `.exe`, `.bat`, `.iso`, `.msi`, and `.ps1` files before download confirmation (`INV-05`), plus Windows NTFS `Zone.Identifier` stream tagging.
* **🔄 Rotating Async Boot & Kernel Logger**: Ring-buffered async file writes (`haven_boot.log`) that prevent UI freezes and disk thrashing.
* **📦 Clean Uninstallation**: Uninstalling removes application binaries and shortcuts, and **never touches user downloads or personal data**.
* **🔑 Cryptographic Update Verification**: Signed with offline Ed25519 dual keys (Primary + Backup), featuring anti-freeze expiration, anti-rollback version counters, and automated rollback on crash.

---

## 🏗️ Architecture Overview

Haven is designed around a multi-tier defense-in-depth model documented in detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):

```
┌────────────────────────────────────────────────────────┐
│ UI Process (Renderer)                                  │
│ • Custom haven:// protocol · Strict CSP (default-src)  │
│ • Sandboxed renderer · ZERO outgoing network access    │
└──────────────────────────┬─────────────────────────────┘
                           │ Zero-Trust Validated IPC Frame
┌──────────────────────────▼─────────────────────────────┐
│ Core & Desktop Broker (Haven Runtime / cairn-core)     │
│ • SafePath Traversal Neutralization (Section 16.4)     │
│ • Network Guard Policy · SQLite DB · Keyed diffing     │
│ • ZERO network access · Ring-buffered async logger     │
└──────────────────────────┬─────────────────────────────┘
                           │ Bound SafePath Transfers
┌──────────────────────────▼─────────────────────────────┐
│ Engine Process (BitTorrent P2P / cairn-engine)         │
│ • WebTorrent v3 / libtorrent · DHT & Tracker Swarms    │
│ • Bound strictly to VPN interface · Direct I/O         │
│ • Writes exclusively to Core-verified SafePaths        │
└────────────────────────────────────────────────────────┘
```

For full architectural diagrams, IPC framing, and subsystem details, see **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

---

## 🧪 Verification & Test Suites

Haven includes automated verification suites for CI and local development:

### 1. Update Verification & Tamper Test Suite
Tests 9 attack vectors against the update verification pipeline:
```powershell
node tools/test_updater_tamper.js
```
*Asserts valid primary signatures, backup key rollover, forged signature rejection, expired manifest rejection, downgrade attack rejection, channel mismatch rejection, payload hash verification, missing platform assets rejection, and automatic rollback on crash.*

### 2. Zero-Telemetry Compliance Scanner
Scans the entire repository for banned tracking SDKs, telemetry keywords, and diagnostic phone-home calls:
```powershell
python tools/check_no_telemetry.py
```
*Enforces Section 13.1 and SR-17: 0% telemetry, analytics, and advertising across all source files.*

### 3. Offline Ed25519 Signing CLI
Manage and verify cryptographic release keys offline:
```powershell
node tools/haven_sign.js keygen --out-private ~/.haven/root.priv --out-public ./trusted_keys.pub
node tools/haven_sign.js sign --manifest manifest.json --key ~/.haven/root.priv --out manifest.sig
node tools/haven_sign.js verify --manifest manifest.json --sig manifest.sig --key ./trusted_keys.pub
```

### 4. Backend Rust Tests
```powershell
cd core
cargo test --workspace
```

---

## 📂 Repository Structure

```text
Haven/
├── AGENTS.md                          # Binding rules and security invariants for AI agents
├── README.md                          # Main repository guide & quick start
├── start-haven-pc.bat                 # 1-click Windows desktop launcher
├── start-haven-pc.sh                  # 1-click Linux / macOS desktop launcher
├── version.json                       # Version manifest & release metadata
│
├── .github/workflows/
│   ├── pages.yml                      # GitHub Pages automatic deployment workflow
│   └── release.yml                    # Release workflow with pinned commit SHAs
│
├── docs/
│   ├── ARCHITECTURE.md                # System Architecture & Security Specification
│   ├── PLAN.md                        # Master Architecture & Delivery Plan
│   ├── AUDIT-1.md                     # Security audit matrix
│   ├── UPDATE-DESIGN.md               # Signed manifest specification (Section 39.2)
│   ├── NAME-CHECK.md                  # Trademark & package registry audit
│   └── dependencies.md                # Dependency registry & license checks
│
├── proto/
│   └── cairn.proto                    # Protobuf API definition (Single source of truth)
│
├── core/                              # Rust Workspace
│   ├── Cargo.toml                     # Workspace manifest
│   ├── cairn-core/                    # State machine, DB, broker, bencode parser, NetGuard
│   ├── cairn-engine/                  # BitTorrent engine abstraction & sandbox
│   ├── cairn-safety/                  # SafePath algorithm & quarantine logic
│   └── cairn-fuzz/                    # Fuzz targets & regression harness
│
├── desktop/                           # Hardened Electron Desktop Shell
│   ├── main.js                        # haven:// protocol, CSP, P2P engine, SafePath, IPC
│   ├── preload.js                     # Zero-trust context isolation bridge
│   ├── package.json                   # Desktop dependencies & build scripts
│   ├── icon.ico / icon.png            # Official Haven shield application icons
│   ├── web/                           # Sandboxed Desktop UI Renderer
│   │   ├── index.html                 # Main interface (Transfers, Swarm, QoS Inspector)
│   │   ├── app.js                     # UI state engine, Direct I/O waveforms, IPC client
│   │   ├── style.css                  # Modern design system & responsive layout
│   │   └── mockSanctuaryData.js       # Offline sandbox data for testing
│   └── dist/                          # Packaged desktop executables & portable archives
│
├── site/                              # Official Website & Live Experience
│   ├── index.html                     # Product landing page (Alpine theme, dark/light toggle)
│   ├── download.html                  # Download & Easy Setup Guide (with SmartScreen tips)
│   ├── experience.html                # In-browser interactive client simulation
│   ├── experience.js / experience.css # Simulation logic, swarm graphs & waveforms
│   ├── site.js / style.css            # Site theme engine, mobile drawer, responsive tokens
│   ├── server.js                      # Local Node.js preview server (port 5173)
│   └── downloads/                     # Haven-Setup.exe, Haven-Setup.bat, Haven-Portable.zip
│
└── tools/                             # Automation, Packaging & Hardening Tools
    ├── check_no_telemetry.py          # CI scanner for banned tracking keywords
    ├── serve_site.py                  # Local Python server (port 3000) with RFC 6266 headers
    ├── haven_sign.js                  # Offline Ed25519 signing tool
    ├── test_updater_tamper.js         # 9-point updater tamper test suite
    ├── build_windows_installer.ps1    # Automated installer, uninstaller & ZIP packager
    ├── register_magnet_protocol.ps1   # Windows magnet: URI protocol associator
    ├── sign_locally.ps1               # Local Authenticode code-signing helper
    └── installer_src/                 # C# source for per-user Installer & Uninstaller
```

---

## 📜 Security Policy & Invariants

Haven strictly enforces the security invariants defined in [`AGENTS.md`](AGENTS.md) and [`docs/PLAN.md`](docs/PLAN.md):
- **INV-01**: No connections outside peers, trackers, DHT, and user proxies.
- **INV-02**: In Private mode, 0 packets escape off the VPN interface.
- **INV-03**: No file is created outside user-approved torrent root directories.
- **INV-04**: No external trigger can start a download without explicit user confirmation.
- **INV-05**: The client never executes, opens, or passes downloaded content to a shell or interpreter.
- **INV-10**: Parsers use check-then-allocate bounds before allocating memory.
- **INV-11**: Fail-closed enforcement: any error inside Network Guard, SafePath, or Updater blocks operations.
- **INV-12**: Shipped binaries contain zero telemetry endpoints or ad SDKs.

---

## 📄 License

Licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. See [`docs/PLAN.md`](docs/PLAN.md) for details.
