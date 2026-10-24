//! Integration test for SR-14 / INV-14: Resume Data HMAC Integrity

use cairn_core::{AuthenticatedResumeEnvelope, ResumeIntegrityError};

#[test]
fn test_resume_data_hmac_tamper_detection() {
    let core_key = [0x5Au8; 32];
    let info_hash = [0xABu8; 20];
    let payload = b"engine_state:finished_pieces=[0,1,2,3,4];peers=none".to_vec();

    // 1. Core creates valid authenticated envelope
    let envelope = AuthenticatedResumeEnvelope::new(info_hash, payload.clone(), &core_key)
        .expect("envelope generation succeeds");
    assert_eq!(envelope.verify(&core_key), Ok(()));

    // 2. Attacker modifies a byte on disk / IPC
    let mut tampered = envelope.clone();
    tampered.payload[5] ^= 0x01;
    assert_eq!(tampered.verify(&core_key), Err(ResumeIntegrityError::TagMismatch));

    // 3. Attacker modifies info_hash to associate with different torrent
    let mut swapped_hash = envelope.clone();
    swapped_hash.info_hash[0] ^= 0xFF;
    assert_eq!(swapped_hash.verify(&core_key), Err(ResumeIntegrityError::TagMismatch));

    // 4. Attacker attempts to forge tag with wrong key
    let foreign_key = [0x12u8; 32];
    let forged = AuthenticatedResumeEnvelope::new(info_hash, payload, &foreign_key).unwrap();
    assert_eq!(forged.verify(&core_key), Err(ResumeIntegrityError::TagMismatch));
}
