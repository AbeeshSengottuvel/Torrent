//! # haven-sign: Offline Ed25519 Signing Tool for Haven Update Manifests
//!
//! Enforces Section 22 and Section 39.2:
//! - Offline key generation with OS CSPRNG.
//! - Canonical manifest serialization for bit-exact cross-platform signing.
//! - Never touches network; private key is kept offline by maintainer.

#![forbid(unsafe_code)]

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ManifestAsset {
    pub filename: String,
    pub url: String,
    pub sha256: String,
    pub size_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authenticode_fingerprint: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ManifestSignature {
    pub key_id: String,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateManifest {
    pub schema_version: u32,
    pub app_id: String,
    pub channel: String,
    pub version: String,
    pub min_supported_version: String,
    pub published_at: String,
    pub valid_until: String,
    pub release_notes_url: String,
    pub assets: BTreeMap<String, ManifestAsset>,
    #[serde(default)]
    pub signatures: Vec<ManifestSignature>,
}

impl UpdateManifest {
    /// Compute the deterministic canonical payload for signing.
    pub fn canonical_payload(&self) -> Vec<u8> {
        let mut out = String::new();
        out.push_str("haven-manifest-v1\n");
        out.push_str(&format!("app_id={}\n", self.app_id));
        out.push_str(&format!("channel={}\n", self.channel));
        out.push_str(&format!("version={}\n", self.version));
        out.push_str(&format!("min_supported_version={}\n", self.min_supported_version));
        out.push_str(&format!("published_at={}\n", self.published_at));
        out.push_str(&format!("valid_until={}\n", self.valid_until));
        out.push_str(&format!("release_notes_url={}\n", self.release_notes_url));

        // Deterministic lexicographical ordering of assets
        for (target, asset) in &self.assets {
            out.push_str(&format!(
                "asset:{target}={filename}:{sha256}:{size}\n",
                target = target,
                filename = asset.filename,
                sha256 = asset.sha256.to_lowercase(),
                size = asset.size_bytes
            ));
        }

        out.into_bytes()
    }
}

fn print_usage() {
    eprintln!(
        r#"haven-sign: Offline Ed25519 Signing Tool for Haven Update Manifests

Usage:
  haven-sign keygen --out-private <path> --out-public <path>
  haven-sign sign <manifest.json> --key <private_key_path> [--key-id <id>]
  haven-sign verify <manifest.json> --key <public_key_hex_or_file>

Commands:
  keygen    Generate a new Ed25519 keypair using OS CSPRNG.
  sign      Sign a manifest.json with an offline private key.
  verify    Verify a manifest.json against an Ed25519 public key.
"#
    );
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        std::process::exit(1);
    }

    match args[1].as_str() {
        "keygen" => handle_keygen(&args[2..]),
        "sign" => handle_sign(&args[2..]),
        "verify" => handle_verify(&args[2..]),
        _ => {
            eprintln!("Unknown command: {}", args[1]);
            print_usage();
            std::process::exit(1);
        }
    }
}

fn handle_keygen(args: &[String]) {
    let mut out_private: Option<String> = None;
    let mut out_public: Option<String> = None;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--out-private" => {
                if i + 1 < args.len() {
                    out_private = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--out-public" => {
                if i + 1 < args.len() {
                    out_public = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }

    let priv_path = out_private.unwrap_or_else(|| "haven_root.priv".to_string());
    let pub_path = out_public.unwrap_or_else(|| "haven_root.pub".to_string());

    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key: VerifyingKey = signing_key.verifying_key();

    let priv_hex = hex::encode(signing_key.to_bytes());
    let pub_hex = hex::encode(verifying_key.to_bytes());

    fs::write(&priv_path, format!("{}\n", priv_hex)).expect("write private key file");
    fs::write(&pub_path, format!("{}\n", pub_hex)).expect("write public key file");

    println!("=======================================================");
    println!("  Ed25519 Signing Keypair Generated Successfully!      ");
    println!("=======================================================");
    println!("  Private Key: {}", priv_path);
    println!("  Public Key:  {}", pub_path);
    println!("  Public Key Hex: {}", pub_hex);
    println!();
    println!("  [CRITICAL SECURITY NOTICE]");
    println!("  Store the private key on an encrypted USB drive or");
    println!("  in your password manager. NEVER commit it to git, and");
    println!("  NEVER paste it into Antigravity or any chat.");
    println!("  Only the public key goes in the repository.");
    println!("=======================================================");
}

fn handle_sign(args: &[String]) {
    if args.is_empty() {
        eprintln!("Error: manifest path required");
        std::process::exit(1);
    }
    let manifest_path = &args[0];
    let mut key_path: Option<String> = None;
    let mut key_id = "primary_root_2026".to_string();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--key" => {
                if i + 1 < args.len() {
                    key_path = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--key-id" => {
                if i + 1 < args.len() {
                    key_id = args[i + 1].clone();
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }

    let key_file = key_path.expect("--key <path> required");
    let priv_hex = fs::read_to_string(&key_file).expect("read key file").trim().to_string();
    let priv_bytes = hex::decode(&priv_hex).expect("decode private key hex");
    if priv_bytes.len() != 32 {
        eprintln!("Error: private key must be 32 bytes (64 hex characters)");
        std::process::exit(1);
    }

    let mut key_arr = [0u8; 32];
    key_arr.copy_from_slice(&priv_bytes);
    let signing_key = SigningKey::from_bytes(&key_arr);
    let verifying_key = signing_key.verifying_key();
    let pub_hex = hex::encode(verifying_key.to_bytes());

    let manifest_content = fs::read_to_string(manifest_path).expect("read manifest");
    let mut manifest: UpdateManifest = serde_json::from_str(&manifest_content).expect("parse manifest JSON");

    let canonical = manifest.canonical_payload();
    let sig: Signature = signing_key.sign(&canonical);
    let sig_hex = hex::encode(sig.to_bytes());

    // Replace or add signature
    manifest.signatures.retain(|s| s.key_id != key_id);
    manifest.signatures.push(ManifestSignature {
        key_id,
        public_key: pub_hex,
        signature: sig_hex.clone(),
    });

    let updated_json = serde_json::to_string_pretty(&manifest).expect("serialize manifest");
    fs::write(manifest_path, updated_json).expect("write updated manifest");

    println!("[SUCCESS] Manifest signed: {}", manifest_path);
    println!("  Signature: {}", sig_hex);
}

fn handle_verify(args: &[String]) {
    if args.is_empty() {
        eprintln!("Error: manifest path required");
        std::process::exit(1);
    }
    let manifest_path = &args[0];
    let mut key_arg: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        if args[i] == "--key" && i + 1 < args.len() {
            key_arg = Some(args[i + 1].clone());
            i += 1;
        }
        i += 1;
    }

    let key_str = key_arg.expect("--key <hex_or_file> required");
    let pub_hex = if Path::new(&key_str).exists() {
        fs::read_to_string(&key_str).expect("read key file").trim().to_string()
    } else {
        key_str.trim().to_string()
    };

    let pub_bytes = hex::decode(&pub_hex).expect("decode public key hex");
    let mut pub_arr = [0u8; 32];
    pub_arr.copy_from_slice(&pub_bytes);
    let verifying_key = VerifyingKey::from_bytes(&pub_arr).expect("valid verifying key");

    let manifest_content = fs::read_to_string(manifest_path).expect("read manifest");
    let manifest: UpdateManifest = serde_json::from_str(&manifest_content).expect("parse manifest JSON");

    let canonical = manifest.canonical_payload();
    let mut verified = false;

    for s in &manifest.signatures {
        if let Ok(sig_bytes) = hex::decode(&s.signature) {
            if sig_bytes.len() == 64 {
                let mut sig_arr = [0u8; 64];
                sig_arr.copy_from_slice(&sig_bytes);
                let sig = Signature::from_bytes(&sig_arr);
                if verifying_key.verify(&canonical, &sig).is_ok() {
                    verified = true;
                    println!("[PASS] Verified valid signature for key_id: {}", s.key_id);
                    break;
                }
            }
        }
    }

    if verified {
        println!("[SUCCESS] Manifest authenticity and integrity confirmed.");
    } else {
        eprintln!("[FAIL] No valid signature matching public key found!");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_and_verify_roundtrip() {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();

        let mut assets = BTreeMap::new();
        assets.insert(
            "windows-x64-installer".to_string(),
            ManifestAsset {
                filename: "Haven-Setup-1.0.0-x64.exe".to_string(),
                url: "https://example.com/Haven-Setup-1.0.0-x64.exe".to_string(),
                sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
                size_bytes: 50_000_000,
                authenticode_fingerprint: None,
            },
        );

        let manifest = UpdateManifest {
            schema_version: 1,
            app_id: "org.haven.cairn".to_string(),
            channel: "stable".to_string(),
            version: "1.0.1".to_string(),
            min_supported_version: "1.0.0".to_string(),
            published_at: "2026-10-24T16:00:00Z".to_string(),
            valid_until: "2026-11-24T16:00:00Z".to_string(),
            release_notes_url: "https://example.com/notes".to_string(),
            assets,
            signatures: Vec::new(),
        };

        let canonical = manifest.canonical_payload();
        let sig: Signature = signing_key.sign(&canonical);

        assert!(verifying_key.verify(&canonical, &sig).is_ok());

        // Tamper test: alter version in canonical payload
        let mut tampered_manifest = manifest.clone();
        tampered_manifest.version = "1.0.2".to_string();
        let tampered_canonical = tampered_manifest.canonical_payload();
        assert!(verifying_key.verify(&tampered_canonical, &sig).is_err());
    }
}
