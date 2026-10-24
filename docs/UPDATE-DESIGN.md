# Haven Update System Design: Signed Manifest Specification
**Document Version:** 1.0.0 (Task D0 Delivery)  
**Standard:** Adheres to `docs/PLAN.md` Section 22 (Update System and Supply Chain) & Section 39.2  
**Security Invariants:** `INV-01`, `INV-09`, `INV-11`  
**Security Requirements:** `SR-16`

---

## 1. Threat Model & Design Principles

Updates are the single highest-value attack vector against desktop software. If an attacker compromises our GitHub account, DNS, CDN, or web hosting, they must **still be mathematically incapable** of pushing a malicious update to Haven users.

### 1.1 Non-Negotiable Rules
1. **No Unauthenticated Updates**: The client will **never** query or trust raw JSON (such as a mutable `version.json` on a git branch). Every update decision is governed strictly by an Ed25519-signed manifest.
2. **Offline Key Custody**: The private signing key **never** touches GitHub, repository secrets, CI runners, or build machines. The private key is generated and held exclusively by the project maintainer on an encrypted hardware/USB drive or offline credential store.
3. **Dual Pinned Public Keys**: Shipped client binaries embed two trusted 32-byte Ed25519 public keys (`PRIMARY_ROOT_KEY` and `BACKUP_ROOT_KEY`) to support key rotation without breaking existing installations.
4. **Strict Monotonicity (Anti-Rollback)**: The target version must be strictly greater than the installed version (`new_version > current_version`). Downgrade attacks to known-vulnerable past versions are rejected.
5. **Freeze / Replay Protection**: Every manifest has an explicit freshness timestamp and an expiration deadline (`valid_until`). Expired manifests are rejected even if the cryptographic signature is valid.
6. **Binary Hash Integrity**: Every asset artifact is bound to a SHA-256 digest in the signed manifest. The client verifies the SHA-256 hash of the downloaded payload before passing it to any installer.
7. **Explicit User Consent**: Updates are never installed silently. The user is prompted with an honest dialog showing version, release notes, and verified signature status.
8. **Automatic Rollback on First-Launch Crash**: If a newly updated binary crashes during its initial launch or fails its health check, the client automatically rolls back to the previous known-good binary.

---

## 2. Manifest Schema (`manifest.json`)

The update manifest is a deterministic, canonical JSON structure signed with an Ed25519 private key.

### 2.1 JSON Schema
```json
{
  "schema_version": 1,
  "app_id": "org.haven.cairn",
  "channel": "stable",
  "version": "0.1.0",
  "min_supported_version": "0.1.0-alpha.1",
  "published_at": "2026-10-24T16:00:00Z",
  "valid_until": "2026-11-24T16:00:00Z",
  "release_notes_url": "https://github.com/AbeeshSengottuvel/Torrent/releases/tag/v0.1.0",
  "assets": {
    "windows-x64-installer": {
      "filename": "Haven-Setup-0.1.0-x64.exe",
      "url": "https://github.com/AbeeshSengottuvel/Torrent/releases/download/v0.1.0/Haven-Setup-0.1.0-x64.exe",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "size_bytes": 68412800,
      "authenticode_fingerprint": "OPTIONAL_WINDOWS_SIG_THUMBPRINT"
    },
    "windows-x64-portable": {
      "filename": "Haven-0.1.0-win-x64-portable.zip",
      "url": "https://github.com/AbeeshSengottuvel/Torrent/releases/download/v0.1.0/Haven-0.1.0-win-x64-portable.zip",
      "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
      "size_bytes": 62145600
    },
    "linux-x64-appimage": {
      "filename": "Haven-0.1.0-x86_64.AppImage",
      "url": "https://github.com/AbeeshSengottuvel/Torrent/releases/download/v0.1.0/Haven-0.1.0-x86_64.AppImage",
      "sha256": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
      "size_bytes": 74312000
    }
  },
  "signatures": [
    {
      "key_id": "primary_root_2026",
      "public_key": "2b117a93483d02ae78d1a9b8ec224e61952a01cc3d76fe12a095516e3392741f",
      "signature": "64_BYTE_ED25519_SIGNATURE_HEX_OVER_CANONICAL_PAYLOAD"
    }
  ]
}
```

### 2.2 Canonical Payload for Signing
To eliminate JSON serialization ambiguities (such as whitespace, indentation, and key ordering), the signature is generated over a canonical byte sequence formed by sorting canonical manifest fields:
```text
haven-manifest-v1\n
channel={channel}\n
version={version}\n
published_at={published_at}\n
valid_until={valid_until}\n
asset:{target}={filename}:{sha256}:{size_bytes}\n
```
This guarantees cross-platform byte-exact reproducibility in Rust, Python, Go, and Node.js.

---

## 3. Client Verification State Machine

```text
[Check Triggered]
       │
       ▼
[Fetch manifest.json over HTTPS]
       │
       ├───> Invalid JSON / Network Error ──> [Abort (Silent in background, Alert if user-triggered)]
       │
       ▼
[Verify Schema & Channel]
       │
       ├───> Channel mismatch ───────────────> [Ignore]
       │
       ▼
[Verify Ed25519 Signature]
       │
       ├───> Signature Mismatch / Invalid ───> [FAIL: Raise Untrusted Manifest Alert (INV-09)]
       │
       ▼
[Verify Expiry (Freeze Protection)]
       │
       ├───> now >= valid_until ─────────────> [FAIL: Reject Expired Manifest]
       │
       ▼
[Verify Version (Rollback Protection)]
       │
       ├───> version <= current_version ─────> [No Update Available]
       │
       ▼
[Verify Platform Asset Listed]
       │
       ├───> Current OS asset missing ───────> [FAIL: Unsupported Target]
       │
       ▼
[Prompt User: "Update vX.Y.Z Available"]
       │
       ├───> User Declines ──────────────────> [Dismiss]
       │
       ▼ (User Confirms)
[Download Asset Binary to Isolated Temp Folder]
       │
       ▼
[Verify SHA-256 Digest]
       │
       ├───> Hash mismatch / size mismatch ──> [FAIL: Delete file, Raise Corrupt Asset Alert]
       │
       ▼
[Verify Platform Signature (Authenticode on Windows)]
       │
       ├───> Signature untrusted / absent ───> [FAIL: Reject Binary]
       │
       ▼
[Stage Update & Launch Installer / Replace Binary]
       │
       ▼
[First Launch Health Check]
       │
       ├───> Crash or failure within 30s ────> [Automatic Rollback to Previous Binary]
       │
       ▼
[Update Succeeded]
```

---

## 4. Key Management & Tooling (`haven-sign`)

### 4.1 Maintaining Zero-Knowledge Security
1. Coding agents, LLMs, and CI scripts **must never** have access to the private signing key.
2. In Task D1b, we will build a standalone offline CLI tool: `haven-sign`.
3. The maintainer compiles and runs `haven-sign keygen` locally on their own secure machine:
   ```bash
   haven-sign keygen --out-private ~/.haven-keys/update_root.priv --out-public ./trusted_keys.pub
   ```
4. Only the public key (`trusted_keys.pub`) is committed to the git repository and compiled into the Core binary.
5. Release manifests are signed offline by the maintainer:
   ```bash
   haven-sign sign manifest.json --key ~/.haven-keys/update_root.priv
   ```

### 4.2 Key Rotation Protocol
- If `PRIMARY_ROOT_KEY` must be rotated (e.g. routine yearly rotation or proactive retirement):
  1. The new manifest is co-signed by both `PRIMARY_ROOT_KEY` and `BACKUP_ROOT_KEY`.
  2. The update binary bundles the next generation of keys (`ROOT_2027` and `BACKUP_2027`).
  3. Clients verify using whichever pinned key matches the key ID.

---

## 5. Tamper-Test Plan & Test Vectors

To satisfy `SR-16` and `INV-09`, an automated test suite will validate rejection of the following attack scenarios:

| Test ID | Scenario | Tamper Method | Expected Result | Verified By |
|---|---|---|---|---|
| **TAMPER-01** | **Forged Signature** | Alter a single bit in `signature` or manifest payload | Verification fails (`UpdateVerificationError::SignatureInvalid`); update rejected | `cairn-core/src/updater.rs` |
| **TAMPER-02** | **Expired Manifest (Freeze Attack)** | Set `valid_until` to a past timestamp (`1970-01-01` or `now - 1 hour`) | Verification fails (`UpdateVerificationError::ManifestExpired`); update rejected | `cairn-core/src/updater.rs` |
| **TAMPER-03** | **Rollback Attack (Downgrade)** | Set manifest version to an older or equal version (`version <= current_version`) | Verification fails (`UpdateVerificationError::RollbackDetected`); update rejected | `cairn-core/src/updater.rs` |
| **TAMPER-04** | **Corrupted Payload (MITM Modification)** | Flip a byte in the downloaded `.exe` / `.zip` artifact so SHA-256 mismatches | Hash verification fails (`UpdateVerificationError::PayloadHashMismatch`); temp file deleted | `cairn-core/src/updater.rs` |
| **TAMPER-05** | **Missing Target Asset** | Provide valid signature but omit `windows-x64-installer` target | Fails with `UpdateVerificationError::TargetNotFound`; no download started | `cairn-core/src/updater.rs` |
| **TAMPER-06** | **Wrong Channel** | Channel set to `nightly` when client is configured for `stable` | Client silently ignores non-matching channel | `cairn-core/src/updater.rs` |
| **TAMPER-07** | **First-Launch Crash Recovery** | Inject crash flag in new binary on launch | Core supervisor detects crash and restores `.backup` binary within 5 seconds | Integration test harness |
