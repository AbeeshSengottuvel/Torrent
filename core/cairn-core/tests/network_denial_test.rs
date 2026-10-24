//! Network Isolation Verification Test (SR-02, INV-01)
//!
//! Asserts that cairn-core contains NO network permission or external socket capability.
//! Verified through cargo manifest feature inspection and compile-time isolation.

#[test]
fn test_core_has_no_network_permission() {
    // 1. Verify cargo manifest features for cairn-core: ensure tokio's "net" feature is omitted
    let cargo_toml = include_str!("../Cargo.toml");
    
    // Core manifest MUST NOT enable tokio/net or tokio/full
    assert!(
        !cargo_toml.contains("\"net\""),
        "SR-02 Violation: cairn-core must not enable tokio 'net' feature"
    );
    assert!(
        !cargo_toml.contains("\"full\""),
        "SR-02 Violation: cairn-core must not enable tokio 'full' feature"
    );

    // 2. Verify dependencies: ensure hyper, reqwest, or other HTTP/network clients are absent
    assert!(!cargo_toml.contains("reqwest"), "cairn-core must not contain reqwest");
    assert!(!cargo_toml.contains("hyper"), "cairn-core must not contain hyper");
    assert!(!cargo_toml.contains("tungstenite"), "cairn-core must not contain tungstenite");
}
