# Cairn Dependency Registry & License Audit

Every third-party dependency in Cairn must be recorded in this file with written justification and a license verification before being introduced.

## Permitted Licenses
- Permissive: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC
- Copyleft (Engine/Platform if compliant with chosen project license): MPL-2.0, LGPL-2.1+, GPLv3 (if whole project GPLv3)
- Strictly Prohibited: AGPL, SSPL, proprietary/commercial SDKs, telemetry/analytics SDKs, ad networks.

---

## Workspace Dependencies (Proposed for Phase 0 & Phase 1)

### Rust Crates
| Crate | Version | License | Purpose / Justification | Security Review Notes |
|---|---|---|---|---|
| `tokio` | 1.x | MIT | Async runtime for daemon & IPC event loop | Standard audited runtime |
| `thiserror` | 1.x | MIT / Apache-2.0 | Ergonomic typed domain error definitions | No unsafe, zero runtime overhead |
| `cxx` | 1.x | MIT / Apache-2.0 | Safe C++ <-> Rust interop for libtorrent wrapper | Audited bridge preventing undefined behavior |
| `rqbit` | latest | Apache-2.0 | Pure-Rust BitTorrent engine candidate (evaluated in Phase 0) | Rust memory safety; compared against libtorrent |
| `prost` | 0.12+ | Apache-2.0 | High-performance Protobuf serialization for IPC | Fast, memory-efficient, no unwrap |
| `rusqlite` | 0.31+ | MIT | SQLite database client for state & settings | Parameterized queries only; WAL mode |
| `zeroize` | 1.x | MIT / Apache-2.0 | Secure memory wiping for secrets and keys | Memory hygiene for credentials/tokens |
| `hmac` | 0.12 | MIT / Apache-2.0 | HMAC generation for resume data integrity tags (SR-14) | Standard cryptographic construction |
| `subtle` | 2.5 | BSD-3-Clause | Constant-time comparisons for tokens and tags | Prevents timing attacks |
| `ring` / `ed25519-dalek` | latest | ISC/OpenSSL or MIT | Cryptographic signatures and hashing | Audited crypto primitives |
| `tracing` | 0.1+ | MIT | Structured, redacted local diagnostics logging | Local only, zero telemetry |

### Dart / Flutter Packages (Proposed for UI)
| Package | Version | License | Purpose / Justification |
|---|---|---|---|
| `flutter_riverpod` | 2.x | MIT | Reactive state management without tight UI coupling |
| `flutter_rust_bridge` | 2.x | MIT | Cross-process or in-process FFI bridge between Dart and Rust |
| `protobuf` | 3.x | BSD-3-Clause | Protocol Buffer Dart runtime for UI IPC contract |
| `lucide_icons` | latest | ISC | Clean, consistent, open-licensed iconography (1.5-2px stroke) |
