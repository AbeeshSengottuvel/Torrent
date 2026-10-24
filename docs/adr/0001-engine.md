# ADR 0001: Torrent Engine Selection (libtorrent-rasterbar 2.x vs rqbit)

- **Status**: Proposed / Evaluated
- **Date**: 2026-10-24
- **Decision Owner**: Cairn Engineering
- **Security Requirement Traceability**: SR-01, SR-04, SR-07

---

## Context and Problem Statement

Project Cairn requires a high-performance, battle-tested BitTorrent engine capable of saturating 1 Gbps networking on desktop while maintaining a calm memory profile (<150 MB idle), strictly zero telemetry, and robust Network Guard interface binding (kill-switch support).

The central decision is between:
1. **`libtorrent-rasterbar 2.x` (C++)**: Wrapped in a thin, safe Rust crate (`cairn-engine`) and isolated in a sandboxed, low-privilege child process.
2. **`rqbit` (Pure Rust)**: Written natively in Rust, offering memory safety without C++ FFI.

---

## Comparison Matrix

| Feature / Metric | `libtorrent-rasterbar 2.x` | `rqbit` (Pure Rust) | Cairn v1.0 Requirement |
|---|---|---|---|
| **BitTorrent v1 / v2 / Hybrid** | Full production support | v1 mature; v2 experimental | Mandatory (v1 + v2 + hybrid) |
| **Protocol Encryption (MSE/PE)** | Full Diffie-Hellman / RC4 support | Limited / partial | Mandatory (Standard & Private) |
| **Interface Binding & Kill-Switch** | Native (`listen_interfaces`, `outgoing_interfaces`) | OS default socket routing | Mandatory (SR-07 Network Guard) |
| **uTP (Micro Transport Protocol)** | Production LEDBAT congestion control | Experimental / partial | Mandatory for ISP shaping bypass |
| **DHT, PEX, LSD** | Full BEP 5, BEP 11, BEP 14 compliance | Supported (DHT/PEX) | Mandatory (with Private toggle) |
| **Memory Footprint (Idle)** | ~35 MB - 60 MB | ~25 MB - 45 MB | Target: <150 MB combined |
| **Throughput (Gigabit saturation)**| Verified in production (>100 MB/s) | High async Tokio performance | 1 Gbps saturation |
| **Attack Surface** | C++ memory vulnerabilities (mitigated via OS sandbox) | Memory safe Rust | Process sandboxing required |

---

## Decision

**We adopt `libtorrent-rasterbar 2.x` wrapped via `cxx` inside a dedicated, isolated `cairn-engine` worker process for Cairn v1.0.**

### Rationale
1. **Network Guard Integrity (SR-07)**: `libtorrent` provides exact interface binding for all listen and outgoing sockets down to the OS interface index/IP, preventing socket leaks when VPN interfaces drop.
2. **Protocol Completeness**: Full support for BitTorrent v2/hybrid swarms, uTP, and protocol encryption is non-negotiable for v1.0 release quality.
3. **Sandboxed Defense-in-Depth (SR-01)**: The C++ attack surface is neutralized by isolating `cairn-engine` in a separate process with a restricted security token (Windows AppContainer/Job Object, macOS App Sandbox, Linux Landlock/seccomp). The Core and UI run in separate processes with no direct peer network access.

---

## Future Evolution
`rqbit` will continue to be tracked in test builds. Once `rqbit` achieves full hybrid torrent (BEP 52), uTP, and explicit interface binding parity, migration to pure Rust will be evaluated for Cairn v2.0 to eliminate the C++ sandbox boundary.
