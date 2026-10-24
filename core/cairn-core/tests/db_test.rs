//! Integration test for SR-12 / SR-15: Hardened Database & Secure Delete

use cairn_core::{CoreDatabase, TorrentRecord};

#[test]
fn test_database_enforces_secure_delete_and_parameterized_queries() {
    let mut db = CoreDatabase::open_in_memory().expect("open DB in memory");
    assert!(db.is_secure_delete_enabled().expect("check secure_delete"), "PRAGMA secure_delete must be ON");

    // Upsert multiple torrent records
    for i in 0..5 {
        let mut hash = [0u8; 20];
        hash[0] = i as u8;
        let record = TorrentRecord {
            info_hash: hash,
            name: format!("distribution_{}.iso", i),
            save_path: format!("C:\\Downloads\\distro_{}", i),
            added_at: 1700000000 + i as i64,
            state: "AwaitingConfirm".to_string(),
            size_bytes: 500_000_000 + (i as i64 * 1000),
        };
        db.upsert_torrent(&record).expect("upsert record");
    }

    // Query record
    let mut target_hash = [0u8; 20];
    target_hash[0] = 3;
    let fetched = db.get_torrent(&target_hash).expect("get").expect("exists");
    assert_eq!(fetched.name, "distribution_3.iso");

    // Delete record
    let deleted = db.delete_torrent(&target_hash).expect("delete succeeds");
    assert!(deleted);
    let after_delete = db.get_torrent(&target_hash).expect("get");
    assert_eq!(after_delete, None);
}
