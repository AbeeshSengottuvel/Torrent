//! # IPC Layer with Token Authentication and Framing
//!
//! Enforces SR-09 and SR-10:
//! - Local control exclusively uses local transports (Named Pipes on Windows, Unix domain sockets on POSIX).
//! - 256-bit random session token authentication with constant-time verification.
//! - Strict frame size limit (4 MiB) to prevent memory exhaustion / DoS attacks.

use subtle::ConstantTimeEq;
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum IpcError {
    #[error("Unauthorized: invalid or missing session authentication token")]
    Unauthorized,
    #[error("Frame size exceeds maximum allowable limit ({0} bytes > {1} bytes)")]
    FrameTooLarge(usize, usize),
    #[error("Incomplete frame received")]
    IncompleteFrame,
    #[error("IO error: {0}")]
    Io(String),
}

/// 256-bit Session authentication token.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct SessionToken(pub [u8; 32]);

impl SessionToken {
    pub fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Constant-time equality check to prevent timing side-channels.
    pub fn verify(&self, candidate: &[u8; 32]) -> bool {
        self.0.ct_eq(candidate).into()
    }
}

impl std::fmt::Debug for SessionToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[REDACTED_SESSION_TOKEN]")
    }
}

/// IPC Framing and protocol constraints.
pub struct IpcCodec {
    session_token: SessionToken,
    max_frame_size: usize,
}

impl IpcCodec {
    /// Standard maximum IPC payload (4 MiB) per SR-10.
    pub const DEFAULT_MAX_FRAME_SIZE: usize = 4 * 1024 * 1024;

    pub fn new(session_token: SessionToken) -> Self {
        Self {
            session_token,
            max_frame_size: Self::DEFAULT_MAX_FRAME_SIZE,
        }
    }

    pub fn with_max_frame_size(session_token: SessionToken, max_frame_size: usize) -> Self {
        Self {
            session_token,
            max_frame_size,
        }
    }

    /// Authenticate incoming handshake token.
    pub fn authenticate(&self, candidate_token: &[u8; 32]) -> Result<(), IpcError> {
        if self.session_token.verify(candidate_token) {
            Ok(())
        } else {
            Err(IpcError::Unauthorized)
        }
    }

    /// Encode a payload frame with a 4-byte length prefix.
    pub fn encode_frame(&self, payload: &[u8]) -> Result<Vec<u8>, IpcError> {
        if payload.len() > self.max_frame_size {
            return Err(IpcError::FrameTooLarge(payload.len(), self.max_frame_size));
        }

        let mut frame = Vec::with_capacity(4 + payload.len());
        let len_prefix = (payload.len() as u32).to_be_bytes();
        frame.extend_from_slice(&len_prefix);
        frame.extend_from_slice(payload);
        Ok(frame)
    }

    /// Decode a frame from a byte buffer. Returns (payload, bytes_consumed).
    pub fn decode_frame<'a>(&self, buffer: &'a [u8]) -> Result<(Option<&'a [u8]>, usize), IpcError> {
        if buffer.len() < 4 {
            return Ok((None, 0));
        }

        let mut len_bytes = [0u8; 4];
        len_bytes.copy_from_slice(&buffer[..4]);
        let payload_len = u32::from_be_bytes(len_bytes) as usize;

        if payload_len > self.max_frame_size {
            return Err(IpcError::FrameTooLarge(payload_len, self.max_frame_size));
        }

        let total_frame_len = 4 + payload_len;
        if buffer.len() < total_frame_len {
            return Ok((None, 0));
        }

        let payload = &buffer[4..total_frame_len];
        Ok((Some(payload), total_frame_len))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_auth_constant_time() {
        let expected = SessionToken::new([0x37; 32]);
        let valid = [0x37; 32];
        let mut invalid = [0x37; 32];
        invalid[31] = 0x00;

        let codec = IpcCodec::new(expected);
        assert_eq!(codec.authenticate(&valid), Ok(()));
        assert_eq!(codec.authenticate(&invalid), Err(IpcError::Unauthorized));
    }

    #[test]
    fn test_frame_encode_and_decode() {
        let token = SessionToken::new([0x11; 32]);
        let codec = IpcCodec::new(token);

        let sample_payload = b"protobuf-encoded-state-sync-payload";
        let encoded = codec.encode_frame(sample_payload).expect("encoded");

        let (decoded, consumed) = codec.decode_frame(&encoded).expect("decoded");
        assert_eq!(consumed, encoded.len());
        assert_eq!(decoded, Some(&sample_payload[..]));
    }

    #[test]
    fn test_frame_size_overflow_rejected() {
        let token = SessionToken::new([0x11; 32]);
        let codec = IpcCodec::with_max_frame_size(token, 1024);

        let large_payload = vec![0u8; 2048];
        let err = codec.encode_frame(&large_payload);
        assert_eq!(err, Err(IpcError::FrameTooLarge(2048, 1024)));

        // Malicious header claiming 100MB
        let mut malicious_stream = (100 * 1024 * 1024u32).to_be_bytes().to_vec();
        malicious_stream.extend_from_slice(&[0u8; 16]);

        let decode_err = codec.decode_frame(&malicious_stream);
        assert_eq!(decode_err, Err(IpcError::FrameTooLarge(100 * 1024 * 1024, 1024)));
    }
}
