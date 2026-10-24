# 🛡️ Haven (formerly Cairn)

> **A fast, calm, native BitTorrent client designed for radical privacy, zero telemetry, and fail-closed network security.**  
> Built with a defense-in-depth architecture that assumes every peer on the internet is hostile.

[![Website](https://img.shields.io/badge/Website-abeeshsengottuvel.github.io%2FTorrent-10b981.svg)](https://abeeshsengottuvel.github.io/Torrent/)
[![Live Experience](https://img.shields.io/badge/Live_Demo-Try_in_Browser-38bdf8.svg)](https://abeeshsengottuvel.github.io/Torrent/experience.html)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](https://opensource.org/licenses/MPL-2.0)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![Security Invariants](https://img.shields.io/badge/Security-INV--01_to_INV--14-emerald.svg)](docs/PLAN.md)
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Strictly_0%25-brightgreen.svg)](tools/check_no_telemetry.py)
[![Architecture Spec](https://img.shields.io/badge/Docs-ARCHITECTURE.md-informational.svg)](docs/ARCHITECTURE.md)

---

## 🌐 Official Website & Online Demo

The official Haven website is deployed and live on GitHub Pages:

* 🚀 **Main Landing Page**: **[https://abeeshsengottuvel.github.io/Torrent/](https://abeeshsengottuvel.github.io/Torrent/)**
* ⚡ **Live Web Experience (Interactive Demo)**: **[https://abeeshsengottuvel.github.io/Torrent/experience.html](https://abeeshsengottuvel.github.io/Torrent/experience.html)**
* 📦 **Download & Easy Setup Guide**: **[https://abeeshsengottuvel.github.io/Torrent/download.html](https://abeeshsengottuvel.github.io/Torrent/download.html)**

---

## 📌 Project Status & Roadmap

To maintain complete transparency on what exists today and what is on the roadmap:

| Platform / Feature | Status | Notes |
|---|---|---|
| **Windows Desktop App** | **Working (Native)** | Standalone 64-bit desktop application with hardened runtime (`Haven.exe`). |
| **Windows Installer** | **Working (v1.0)** | Per-user installer (`Haven-Setup.exe`), zero admin rights needed, installs to `%LOCALAPPDATA%\Programs\Haven`. |
| **Portable Package** | **Working (v1.0)** | Zero-install standalone archive (`Haven-Portable.zip`). |
| **Official Website** | **Live & Deployable** | Production landing site in `site/`, deployable to GitHub Pages via `.github/workflows/pages.yml`. |
| **Live Web Experience** | **Working (In-Browser)** | Full interactive client simulation (`site/experience.html`) allowing users to test drive transfers. |
| **Signed Auto-Updates** | **Verified (D1b)** | Ed25519 dual-key offline signed TUF manifest (`docs/UPDATE-DESIGN.md`, `tools/haven_sign.js`, 9/9 tamper tests pass). |
| **Linux & macOS Desktop** | **In Progress (Phase 2)** | Core backend builds cleanly; native packaging and sandboxing in progress. |
| **Android App** | **Planned (Phase 3)** | Native foreground service, Android SAF scoped storage, and mobile UI. |
| **iOS App** | **Later (Phase 6 / v2.0)** | Feasibility spike for background execution limits; not promised for v1.0. |
| **Remote Web UI** | **Later (v1.1)** | Disabled by default per ADR-5; TLS + token authentication required. |

---

## ⚡ Quick Start

### 1. Launch the Desktop Application
Haven runs as a standalone desktop application with native window frames, OS file pickers, and security controls:
- **One-Click Launch**: Double-click **[`start-haven-pc.bat`](start-haven-pc.bat)**.
- **Direct Executable**: Run `%LOCALAPPDATA%\Programs\Haven\Haven.exe` or use your Windows Start Menu shortcut (`Haven`).

### 2. View the Website & Live Web Experience Locally
To preview the official website, download guide, and interactive in-browser experience:
```powershell
python tools/serve_site.py
```
Then open your browser to:
- **Landing Page**: [http://localhost:3000/](http://localhost:3000/)
- **Live Web Experience (Interactive Demo)**: [http://localhost:3000/experience.html](http://localhost:3000/experience.html)
- **Download & Setup Guide**: [http://localhost:3000/download.html](http://localhost:3000/download.html)

### 3. Packaging from Source
To build the standalone Windows application from source:
```powershell
cd desktop
npm install
npm run package
```
Packaged binaries will be generated at `desktop/dist/Haven-win32-x64/Haven.exe`.

---

## ✨ Core Security Features

- **🛡️ Network Guard (Fail-Closed Killswitch)**: Binds swarm traffic strictly to your VPN interface (`WireGuard`, `OpenVPN`, `wg0`, `tun0`). If the VPN connection drops, all peer transfers are halted within 1 second (`SR-07`, `INV-02`).
- **📁 SafePath Path Traversal Neutralization (Section 16.4)**: Untrusted torrent file paths are sanitized, strictly bounded, and restricted to user-approved download roots. Traversal attacks (`..`, slashes, NUL bytes, Windows reserved names `CON`, `PRN`, `AUX`, `NUL`, BiDi overrides) are completely rejected.
- **🗑️ Disconnect & Keep Local Files**: Removing a torrent severs swarm and peer connections immediately, while preserving downloaded files on your local disk.
- **🔒 Hardened Bencode Parser**: Check-then-allocate parsing enforcing 16 MiB maximum file size, 64-level maximum recursion depth, and 2,000,000 token limit (`INV-10`, `SR-04`).
- **⚠️ Risky File Type Alerts**: Automatic security warning indicators on `.exe`, `.bat`, `.iso`, `.msi`, and `.ps1` files before you confirm downloads (`INV-05`).
- **📦 Clean Uninstallation**: Uninstalling removes application binaries and shortcuts, and **never touches user downloads or personal data**.
- **🔑 Cryptographic Update Verification**: Signed with offline Ed25519 dual keys (Primary + Backup), featuring anti-freeze expiration, anti-rollback version counters, and automated rollback on crash.

---

## 🏗️ Architecture Overview

Haven is structured under a **4-Process Multi-Tier Model** documented in detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):

```
┌────────────────────────────────────────────────────────┐
│ UI Process (Renderer)                                  │
│ • Custom haven:// protocol · ZERO network capability   │
└──────────────────────────┬─────────────────────────────┘
                           │ Protobuf over Named Pipe
┌──────────────────────────▼─────────────────────────────┐
│ Core Process (cairn-core)                              │
│ • Rust forbid(unsafe_code) · State DB · SafePath       │
│ • Network Guard Policy · ZERO network capability       │
└──────────────────────────┬─────────────────────────────┘
                           │ Protobuf over Named Pipe
┌──────────────────────────▼─────────────────────────────┐
│ Engine Process (cairn-engine)                          │
│ • Isolated OS Job Object · VPN Interface Bound         │
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
*Asserts valid primary signatures, backup key rollover, forged signature rejection, expired manifest rejection, downgrade attack rejection, channel mismatch rejection, and payload hash verification.*

### 2. Zero-Telemetry Compliance Scanner
Scans the entire repository for banned tracking SDKs, telemetry keywords, and diagnostic phone-home calls:
```powershell
python tools/check_no_telemetry.py
```

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
├── README.md                          # Main repository guide
├── start-haven-pc.bat                 # 1-click Windows desktop launcher
├── start-haven-pc.sh                  # 1-click Linux / macOS launcher
│
├── .github/workflows/
│   ├── pages.yml                      # GitHub Pages deployment workflow
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
│   ├── cairn-core/                    # State machine, DB, broker, bencode parser, NetGuard
│   ├── cairn-engine/                  # BitTorrent engine abstraction & sandbox
│   ├── cairn-safety/                  # SafePath algorithm & quarantine logic
│   └── cairn-fuzz/                    # Fuzz targets & regression harness
│
├── desktop/                           # Hardened Electron Desktop Shell
│   ├── main.js                        # haven:// protocol, CSP, no-network renderer
│   ├── preload.js                     # Context isolation bridge
│   └── dist/                          # Packaged desktop executables & portable archives
│
├── site/                              # Official Website & Live Experience
│   ├── index.html                     # Product landing page (Dot-matrix engineering aesthetic)
│   ├── download.html                  # Download & Easy Setup Guide
│   ├── experience.html                # In-browser interactive client simulation
│   └── downloads/                     # Haven-Setup.exe and Haven-Portable.zip binaries
│
└── tools/                             # Automation & Hardening Tools
    ├── check_no_telemetry.py          # CI scanner for banned tracking keywords
    ├── serve_site.py                  # Local production server with RFC 6266 headers
    ├── haven_sign.js                  # Offline Ed25519 signing tool
    ├── test_updater_tamper.js         # 9-point updater tamper test suite
    └── install.ps1                    # Installer verification script
```

---

## 📜 Security Policy & Invariants

Haven strictly enforces the security invariants defined in [`AGENTS.md`](AGENTS.md):
- **INV-01**: No connections outside peers, trackers, DHT, and user proxies.
- **INV-02**: In Private mode, 0 packets escape off the VPN interface.
- **INV-03**: No file is created outside user-approved torrent root directories.
- **INV-04**: No external trigger can start a download without explicit user confirmation.
- **INV-05**: The client never executes, opens, or passes downloaded content to a shell or interpreter.
- **INV-12**: Shipped binaries contain zero telemetry endpoints or ad SDKs.

---

## 📄 License

Licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. See [`docs/PLAN.md`](docs/PLAN.md) for details.
