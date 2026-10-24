use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};
use thiserror::Error;

/// Pinned root public key for Haven official update verification (Section 22.1, INV-09, SR-16)
/// In release builds, this is the pinned root trust anchor compiled into the binary.
pub const PINNED_ROOT_PUBLIC_KEY: [u8; 32] = [
    0x2b, 0x11, 0x7a, 0x93, 0x48, 0x3d, 0x02, 0xae, 0x78, 0xd1, 0xa9, 0xb8, 0xec, 0x22, 0x4e, 0x61,
    0x95, 0x2a, 0x01, 0xcc, 0x3d, 0x76, 0xfe, 0x12, 0xa0, 0x95, 0x51, 0x6e, 0x33, 0x92, 0x74, 0x1f,
];

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UpdateVerificationError {
    #[error("Manifest signature verification failed (forgery or corrupted key): {0}")]
    InvalidSignature(String),

    #[error("Rollback detected: target version '{target}' is not newer than installed '{installed}'")]
    RollbackDetected {
        target: String,
        installed: String,
    },

    #[error("Manifest expired: valid until {expires_unix}, current time is {current_unix}")]
    ManifestExpired {
        expires_unix: u64,
        current_unix: u64,
    },

    #[error("Artifact payload hash mismatch: expected {expected}, actual {actual}")]
    HashMismatch {
        expected: String,
        actual: String,
    },

    #[error("Artifact payload size mismatch: expected {expected} bytes, actual {actual} bytes")]
    LengthMismatch {
        expected: u64,
        actual: u64,
    },

    #[error("Invalid version string format: {0}")]
    InvalidVersionFormat(String),
}

#[derive(Debug, Clone)]
pub struct UpdateTargetMetadata {
    pub version: String,
    pub timestamp_unix: u64,
    pub expires_unix: u64,
    pub sha256_hex: String,
    pub length_bytes: u64,
}

impl UpdateTargetMetadata {
    /// Canonical byte representation signed by root/online release keys (TUF-style)
    pub fn canonical_bytes(&self) -> Vec<u8> {
        format!(
            "version={}|timestamp={}|expires={}|sha256={}|len={}",
            self.version,
            self.timestamp_unix,
            self.expires_unix,
            self.sha256_hex.to_ascii_lowercase(),
            self.length_bytes
        )
        .into_bytes()
    }
}

pub struct SignedUpdateManifest {
    pub metadata: UpdateTargetMetadata,
    pub signature_bytes: [u8; 64],
}

pub struct UpdateVerifier {
    root_key: VerifyingKey,
    current_version: String,
}

impl UpdateVerifier {
    pub fn new(root_key_bytes: &[u8; 32], current_version: &str) -> Result<Self, UpdateVerificationError> {
        let root_key = VerifyingKey::from_bytes(root_key_bytes)
            .map_err(|e| UpdateVerificationError::InvalidSignature(e.to_string()))?;
        Ok(Self {
            root_key,
            current_version: current_version.to_string(),
        })
    }

    /// Verifies manifest against pinned Ed25519 key, rollback limits, and expiration (INV-09, SR-16)
    pub fn verify_manifest(
        &self,
        manifest: &SignedUpdateManifest,
        current_time_unix: u64,
    ) -> Result<(), UpdateVerificationError> {
        // 1. Freeze attack protection: verify expiry
        if current_time_unix >= manifest.metadata.expires_unix {
            return Err(UpdateVerificationError::ManifestExpired {
                expires_unix: manifest.metadata.expires_unix,
                current_unix: current_time_unix,
            });
        }

        // 2. Rollback protection: target version MUST be strictly newer than installed version
        if !is_version_strictly_greater(&manifest.metadata.version, &self.current_version)? {
            return Err(UpdateVerificationError::RollbackDetected {
                target: manifest.metadata.version.clone(),
                installed: self.current_version.clone(),
            });
        }

        // 3. Cryptographic signature check: Ed25519 over canonical byte representation
        let signature = Signature::from_bytes(&manifest.signature_bytes);
        let canonical_data = manifest.metadata.canonical_bytes();

        self.root_key
            .verify(&canonical_data, &signature)
            .map_err(|e| UpdateVerificationError::InvalidSignature(e.to_string()))?;

        Ok(())
    }

    /// Verifies downloaded installer binary against the signed target metadata (INV-09, SR-16)
    pub fn verify_artifact_payload(
        &self,
        metadata: &UpdateTargetMetadata,
        payload_bytes: &[u8],
    ) -> Result<(), UpdateVerificationError> {
        // Length check
        if payload_bytes.len() as u64 != metadata.length_bytes {
            return Err(UpdateVerificationError::LengthMismatch {
                expected: metadata.length_bytes,
                actual: payload_bytes.len() as u64,
            });
        }

        // SHA-256 check
        let mut hasher = Sha256::new();
        hasher.update(payload_bytes);
        let digest = hasher.finalize();
        let computed_hex = format!("{:x}", digest);

        if computed_hex.to_ascii_lowercase() != metadata.sha256_hex.to_ascii_lowercase() {
            return Err(UpdateVerificationError::HashMismatch {
                expected: metadata.sha256_hex.clone(),
                actual: computed_hex,
            });
        }

        Ok(())
    }
}

/// Strict semantic version comparison (major.minor.patch)
fn parse_version(v: &str) -> Result<(u32, u32, u32), UpdateVerificationError> {
    let clean = v.trim_start_matches('v');
    let parts: Vec<&str> = clean.split('.').collect();
    if parts.len() != 3 {
        return Err(UpdateVerificationError::InvalidVersionFormat(v.to_string()));
    }

    let major = parts[0].parse().map_err(|_| UpdateVerificationError::InvalidVersionFormat(v.to_string()))?;
    let minor = parts[1].parse().map_err(|_| UpdateVerificationError::InvalidVersionFormat(v.to_string()))?;
    let patch = parts[2].parse().map_err(|_| UpdateVerificationError::InvalidVersionFormat(v.to_string()))?;

    Ok((major, minor, patch))
}

fn is_version_strictly_greater(target: &str, installed: &str) -> Result<bool, UpdateVerificationError> {
    let t = parse_version(target)?;
    let i = parse_version(installed)?;

    if t.0 > i.0 {
        return Ok(true);
    }
    if t.0 == i.0 && t.1 > i.1 {
        return Ok(true);
    }
    if t.0 == i.0 && t.1 == i.1 && t.2 > i.2 {
        return Ok(true);
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;

    fn generate_test_keypair() -> (SigningKey, VerifyingKey) {
        let seed = [7u8; 32];
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();
        (signing_key, verifying_key)
    }

    #[test]
    fn test_valid_signed_update_passes() {
        let (signing_key, verifying_key) = generate_test_keypair();
        let verifier = UpdateVerifier::new(&verifying_key.to_bytes(), "1.0.0").unwrap();

        let artifact = b"Haven-v1.1.0-Windows-x64-Setup-Binary";
        let mut hasher = Sha256::new();
        hasher.update(artifact);
        let sha256_hex = format!("{:x}", hasher.finalize());

        let metadata = UpdateTargetMetadata {
            version: "1.1.0".to_string(),
            timestamp_unix: 1700000000,
            expires_unix: 1700100000,
            sha256_hex,
            length_bytes: artifact.len() as u64,
        };

        let canonical = metadata.canonical_bytes();
        let signature = ed25519_dalek::Signer::sign(&signing_key, &canonical);

        let manifest = SignedUpdateManifest {
            metadata: metadata.clone(),
            signature_bytes: signature.to_bytes(),
        };

        // Verification at timestamp 1700050000 (before expiration)
        assert!(verifier.verify_manifest(&manifest, 1700050000).is_ok());
        assert!(verifier.verify_artifact_payload(&metadata, artifact).is_ok());
    }

    #[test]
    fn test_forged_signature_rejected() {
        let (_signing_key, verifying_key) = generate_test_keypair();
        let verifier = UpdateVerifier::new(&verifying_key.to_bytes(), "1.0.0").unwrap();

        let metadata = UpdateTargetMetadata {
            version: "1.1.0".to_string(),
            timestamp_unix: 1700000000,
            expires_unix: 1700100000,
            sha256_hex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string(),
            length_bytes: 100,
        };

        let forged_manifest = SignedUpdateManifest {
            metadata,
            signature_bytes: [0x55; 64], // Invalid signature
        };

        assert!(matches!(
            verifier.verify_manifest(&forged_manifest, 1700050000),
            Err(UpdateVerificationError::InvalidSignature(_))
        ));
    }

    #[test]
    fn test_rollback_attack_rejected() {
        let (signing_key, verifying_key) = generate_test_keypair();
        let verifier = UpdateVerifier::new(&verifying_key.to_bytes(), "1.2.0").unwrap();

        // Attacker serves older validly signed version 1.1.0
        let metadata = UpdateTargetMetadata {
            version: "1.1.0".to_string(),
            timestamp_unix: 1700000000,
            expires_unix: 1700100000,
            sha256_hex: "aaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccdddd".to_string(),
            length_bytes: 50,
        };

        let canonical = metadata.canonical_bytes();
        let signature = ed25519_dalek::Signer::sign(&signing_key, &canonical);

        let manifest = SignedUpdateManifest {
            metadata,
            signature_bytes: signature.to_bytes(),
        };

        assert!(matches!(
            verifier.verify_manifest(&manifest, 1700050000),
            Err(UpdateVerificationError::RollbackDetected { .. })
        ));
    }

    #[test]
    fn test_expired_manifest_freeze_attack_rejected() {
        let (signing_key, verifying_key) = generate_test_keypair();
        let verifier = UpdateVerifier::new(&verifying_key.to_bytes(), "1.0.0").unwrap();

        let metadata = UpdateTargetMetadata {
            version: "1.1.0".to_string(),
            timestamp_unix: 1700000000,
            expires_unix: 1700050000,
            sha256_hex: "aaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccdddd".to_string(),
            length_bytes: 50,
        };

        let canonical = metadata.canonical_bytes();
        let signature = ed25519_dalek::Signer::sign(&signing_key, &canonical);

        let manifest = SignedUpdateManifest {
            metadata,
            signature_bytes: signature.to_bytes(),
        };

        // Current time is past expires_unix (1700060000 > 1700050000)
        assert!(matches!(
            verifier.verify_manifest(&manifest, 1700060000),
            Err(UpdateVerificationError::ManifestExpired { .. })
        ));
    }

    #[test]
    fn test_tampered_artifact_payload_rejected() {
        let (_signing_key, verifying_key) = generate_test_keypair();
        let verifier = UpdateVerifier::new(&verifying_key.to_bytes(), "1.0.0").unwrap();

        let metadata = UpdateTargetMetadata {
            version: "1.1.0".to_string(),
            timestamp_unix: 1700000000,
            expires_unix: 1700100000,
            sha256_hex: "0000000000000000000000000000000000000000000000000000000000000000".to_string(),
            length_bytes: 12,
        };

        let malicious_payload = b"evil_payload";
        assert!(matches!(
            verifier.verify_artifact_payload(&metadata, malicious_payload),
            Err(UpdateVerificationError::HashMismatch { .. })
        ));
    }
}
