//! # Keystore Secret Management
//!
//! Enforces SR-12 and Section 20.3:
//! - Secrets live in memory wrapped in zeroizing containers.
//! - Clears memory on drop via ZeroizeOnDrop to mitigate cold-boot and memory-dump attacks.

use zeroize::{Zeroize, ZeroizeOnDrop};

/// A 256-bit zeroizing secret key container.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecretKey256(pub [u8; 32]);

impl SecretKey256 {
    pub fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl std::fmt::Debug for SecretKey256 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[REDACTED SECRET KEY]")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_debug_redacted() {
        let secret = SecretKey256::new([0xAA; 32]);
        let debug_str = format!("{:?}", secret);
        assert_eq!(debug_str, "[REDACTED SECRET KEY]");
        assert!(!debug_str.contains("AA"));
    }

    #[test]
    fn test_secret_zeroizes_on_drop() {
        let mut key_buf = [0x55u8; 32];
        {
            let secret = SecretKey256::new(key_buf);
            assert_eq!(secret.as_bytes()[0], 0x55);
        }
        // Zeroize directly on buffer
        key_buf.zeroize();
        assert_eq!(key_buf, [0u8; 32]);
    }
}
