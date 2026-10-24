# 🛡️ Haven (formerly Cairn)

> **A fast, calm, native-feeling BitTorrent client for PC and Mobile.**  
> Zero ads, zero trackers, zero telemetry, and a fail-closed security architecture that assumes every peer on the internet is hostile.

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](https://opensource.org/licenses/MPL-2.0)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Security Invariants](https://img.shields.io/badge/Security-INV--01_to_INV--14-emerald.svg)](docs/PLAN.md)

---

## ⚡ Quick Start: Physical Application on PC & Mobile

### 🖥️ Native Physical Application (Windows PC)
Haven can run as a **real, standalone native Windows application** (`Haven.exe`) with its own window, system tray, and native OS folder/file pickers:

1. **One-Click Launch**: Double-click **`start-haven-pc.bat`**.
   - If the packaged binary is present, it directly launches **`Haven.exe`**.
   - Otherwise, it launches the native desktop client via `npm start`.
2. **Build the Standalone `.exe` Package**:
   ```powershell
   cd desktop
   npm install
   npm run package
   ```
   This generates the portable executable folder:
   ```text
   desktop/dist/Haven-win32-x64/Haven.exe
   ```

---

## 🔄 GitHub Auto-Update System (Section 22)

Haven is directly integrated with your GitHub repository (**[`AbeeshSengottuvel/Torrent`](https://github.com/AbeeshSengottuvel/Torrent)**):

1. **Automatic Detection**:
   - On startup and in the background, Haven queries `https://raw.githubusercontent.com/AbeeshSengottuvel/Torrent/main/version.json` and the GitHub Releases API.
   - When you bump the version in GitHub (e.g. from `1.0.0` to `1.0.1`) or push a release, a notification banner immediately appears inside the physical application:
     > **🚀 A new version of Haven (v1.0.1) is available on GitHub!**  
     > `[Release Notes]` `[Download Update]`

2. **Automated GitHub Releases (CI/CD)**:
   - The included workflow [`.github/workflows/build-and-release.yml`](.github/workflows/build-and-release.yml) automatically runs your Rust backend tests, packages the Windows `.exe`, and publishes a downloadable GitHub Release whenever you push a version tag (`git tag v1.0.1 && git push --tags`)!

---

### 📱 On Mobile (Android & iOS)
1. Launch Haven on your computer or local server (`node web/server.js`).
2. Open your mobile browser (Chrome/Safari/Brave) to your machine's IP address (e.g. `http://192.168.1.x:3000`).
3. Tap **"Add to Home Screen"** or **"Install Haven"**.
4. Haven installs as a native-feeling standalone PWA with touch-friendly mobile bottom navigation, floating Add button, and real-time updates.

---

## ✨ Key Features

- **🛡️ Network Guard (Fail-Closed Killswitch)**: Binds traffic strictly to your VPN interface (`WireGuard`, `OpenVPN`, `tun0`, `wg0`). If the VPN connection drops, all peer transfers are halted within 1 second.
- **📁 SafePath Path Traversal Neutralization (Section 16.4)**: All torrent file paths are sanitized, strictly bounded, and restricted to user-approved download roots. Traversal attacks (`..`, slashes, NUL bytes, Windows device names `CON`, `PRN`, `AUX`) and bidirectional override attacks are rejected.
- **🗑️ Disconnect & Keep Local Files**: Removing a torrent severs all swarm and peer connections immediately, while keeping your downloaded files safe on your local hard drive.
- **🎯 Drag & Drop Support**: Drag `.torrent` files directly into the window or modal with instant metadata extraction and size limit validation (16 MiB limit).
- **⚠️ Risky File Type Alerts**: Automatic security warning indicators on `.exe`, `.bat`, `.iso`, `.msi`, and `.ps1` files before you confirm downloads (`INV-05`).
- **📊 Realtime Diagnostics**: Canvas piece map visualizer (4,096 piece blocks), live dual-stream bandwidth graphing (Download & Upload), and detailed peer encryption badges.
- **🌓 Themes & Density**: Instant Dark/Light mode toggle and Comfortable/Compact row density switches.

---

## 🧪 Running Backend Rust Tests

Haven's core state machine, Network Guard fail-closed logic, and SafePath security algorithms are written in Rust with `#![forbid(unsafe_code)]`:

```powershell
cd core
cargo test --workspace
```

### Verified Test Matrix:
- **`cairn-core`**:
  - `netguard::tests::test_fails_closed_when_interface_drops`: Verifies immediate traffic block on VPN interface drop (`SR-07`).
  - `netguard::tests::test_blocks_if_external_ip_matches_isp`: Blocks traffic if external IP matches physical ISP IP (`INV-02`).
  - `state::tests::test_valid_lifecycle`: Validates complete lifecycle transitions.
  - `state::tests::test_engine_crash_flagged_as_suspect`: Automatically flags crashed active torrents as `SUSPECT` (`INV-14`).
- **`cairn-safety`**:
  - `safepath::tests::test_rejects_traversal`: Traversal detection.
  - `safepath::tests::test_rejects_windows_reserved_names`: Blocks `CON`, `PRN`, `AUX`, `NUL`, `COM1..9`, `LPT1..9`.
  - `safepath::tests::test_rejects_bidi_and_control_chars`: Blocks RTL override characters.
  - `safepath::tests::test_collision_resolution`: Deterministic case-insensitive collision renaming.
  - `safepath::tests::test_risky_file_identification`: Flags executable and script extensions.
- **`cairn-engine`**:
  - `settings::tests::test_private_mode_baseline`: Verifies forced protocol encryption and disabled DHT/UPnP in Private mode.

---

## 📂 Repository Architecture

```text
Haven/
├── start-haven-pc.bat       # 1-click Windows launcher
├── start-haven-pc.sh        # 1-click macOS / Linux launcher
├── AGENTS.md                # Binding rules and security invariants (INV-01 to INV-14)
├── docs/
│   ├── PLAN.md              # Complete Architecture & Delivery Plan
│   ├── dependencies.md      # Dependency registry and license verification
│   └── adr/
│       └── 0001-engine.md   # ADR: Torrent engine decision (libtorrent vs rqbit)
├── proto/
│   └── cairn.proto          # Protobuf API contract (Single source of truth)
├── core/                    # Rust Workspace
│   ├── cairn-core/          # State machine, Network Guard, broker
│   ├── cairn-engine/        # Engine settings allowlist & event mapping
│   ├── cairn-safety/        # SafePath algorithm & quarantine logic
│   └── cairn-fuzz/          # Fuzzing targets & regression harness
├── app/                     # Flutter Client Architecture
│   └── lib/
│       ├── data/fake_core.dart   # In-memory mock server for UI tests
│       └── design_system/        # Tokens & SafeText widget
└── web/                     # Interactive Web & Mobile PWA Preview
    ├── index.html           # Desktop & Mobile responsive UI
    ├── style.css            # Semantic tokens & glassmorphic aesthetics
    ├── app.js               # Reactive state & simulation loop
    ├── server.js            # Zero-dependency local preview server
    └── manifest.json        # PWA configuration
```

---

## 📜 Security Policy & Invariants

Haven follows the binding security rules defined in [`AGENTS.md`](AGENTS.md):
- **INV-01**: No connections outside peers, trackers, DHT, and user proxies.
- **INV-02**: In Private mode, 0 packets escape off the VPN interface.
- **INV-03**: No file is created outside user-approved torrent root directories.
- **INV-04**: No external trigger can start a download without explicit user confirmation.
- **INV-05**: The client never executes, opens, or passes downloaded content to a shell or interpreter.
- **INV-12**: Shipped binaries contain zero telemetry endpoints or ad SDKs.

---

## 📄 License

Licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. See [`docs/PLAN.md`](docs/PLAN.md) for details.
