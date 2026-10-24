//! Integration test for SR-09 / SR-10: IPC Token Authentication & Message Framing Limits

use cairn_core::{IpcCodec, IpcError, SessionToken};

#[test]
fn test_ipc_token_auth_and_tamper_defense() {
    let core_token = SessionToken::new([0xDE; 32]);
    let codec = IpcCodec::new(core_token);

    // Authorized handshake
    let valid_token = [0xDE; 32];
    assert_eq!(codec.authenticate(&valid_token), Ok(()));

    // Unauthorized handshake (even 1 bit difference)
    let mut attacker_token = [0xDE; 32];
    attacker_token[0] ^= 0x01;
    assert_eq!(codec.authenticate(&attacker_token), Err(IpcError::Unauthorized));
}

#[test]
fn test_ipc_framing_limits_reject_dos() {
    let token = SessionToken::new([0xAA; 32]);
    let max_allowed = 64 * 1024; // 64 KiB cap for test
    let codec = IpcCodec::with_max_frame_size(token, max_allowed);

    // Valid frame within cap
    let normal_msg = b"VALID_IPC_STATUS_QUERY";
    let encoded = codec.encode_frame(normal_msg).expect("encoded");
    let (decoded, consumed) = codec.decode_frame(&encoded).expect("decoded");
    assert_eq!(consumed, encoded.len());
    assert_eq!(decoded, Some(&normal_msg[..]));

    // Oversized message rejected at encoding
    let huge_payload = vec![0x90u8; max_allowed + 1];
    assert_eq!(codec.encode_frame(&huge_payload), Err(IpcError::FrameTooLarge(max_allowed + 1, max_allowed)));

    // Maliciously crafted header claiming huge length rejected at decode
    let mut malicious_packet = (500_000u32).to_be_bytes().to_vec();
    malicious_packet.extend_from_slice(b"fake_prefix");
    assert_eq!(codec.decode_frame(&malicious_packet), Err(IpcError::FrameTooLarge(500_000, max_allowed)));
}
