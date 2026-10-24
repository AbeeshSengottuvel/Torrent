//! Integration test for SR-23: Secret Canary & Sensitive Data Redaction
//!
//! Enforces Section 20.4:
//! - Secrets, session tokens, and cryptographic keys must be completely redacted in debug and log representations.
//! - Canary tests assert that sensitive byte sequences never appear in stringified structures.

use cairn_core::{SecretKey256, SessionToken};

#[test]
fn test_secret_canary_redaction() {
    let canary_bytes = [
        0xCA, 0xFE, 0xBA, 0xBE, 0xDE, 0xAD, 0xBE, 0xEF,
        0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
        0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10,
        0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
    ];

    let secret_key = SecretKey256::new(canary_bytes);
    let debug_output = format!("{:?}", secret_key);

    // Assert redacted placeholder is present
    assert_eq!(debug_output, "[REDACTED SECRET KEY]");

    // Assert NO part of the canary byte sequence appears in hex or decimal form
    assert!(!debug_output.contains("cafe"));
    assert!(!debug_output.contains("CAFE"));
    assert!(!debug_output.contains("deadbeef"));
    assert!(!debug_output.contains("DEADBEEF"));

    let session_token = SessionToken::new(canary_bytes);
    let token_debug = format!("{:?}", session_token);
    assert_eq!(token_debug, "[REDACTED_SESSION_TOKEN]");
    assert!(!token_debug.contains("cafe"));
    assert!(!token_debug.contains("deadbeef"));
}
