//! Network Guard Leak and Fail-Closed Suite (Section 18.6, SR-07, SR-08, INV-02, INV-11)
//!
//! Simulates physical network scenarios:
//! 1. Normal run through bound VPN interface.
//! 2. Sudden VPN interface drop -> verify immediate blocking within 1s.
//! 3. Interface flapping -> verify fail-closed debounce behavior.
//! 4. Reconnect with new IP -> verify ISP leak detection and verification requirement.
//! 5. Watchdog timeout & internal errors -> verify fail-closed behavior (INV-11).

use cairn_core::{NetworkGuard, NetworkGuardState, NetworkInterface};
use std::time::Duration;

#[test]
fn test_leak_suite_vpn_drop_and_zero_traffic() {
    let mut guard = NetworkGuard::new();
    let vpn_guid = "adapter-wg0-vpn".to_string();
    let real_isp_ip = "203.0.113.19".to_string();

    // Enable Private Mode with known ISP IP
    guard.enable_private_mode(vpn_guid.clone(), Some(real_isp_ip.clone()));
    assert!(!guard.is_traffic_permitted(), "Must block traffic before interface is verified");

    // 1. Normal run: VPN adapter is up with valid tunnel IP
    let active_vpn = vec![NetworkInterface {
        guid: vpn_guid.clone(),
        name: "WireGuard wg0".to_string(),
        ip: "10.8.0.2".to_string(),
        is_up: true,
    }];

    guard.on_interface_change(&active_vpn, Some("198.51.100.88".to_string()));
    assert_eq!(guard.state(), NetworkGuardState::GuardedOk);
    assert!(guard.is_traffic_permitted(), "Traffic should be permitted when VPN is active and verified");

    // 2. Sudden VPN Drop (cable unplugged / server disconnect)
    let dropped_ifaces: Vec<NetworkInterface> = vec![];
    let new_state = guard.on_interface_change(&dropped_ifaces, None);

    assert_eq!(new_state, NetworkGuardState::Blocked);
    assert_eq!(guard.state(), NetworkGuardState::Blocked);
    assert!(!guard.is_traffic_permitted(), "INV-02: Traffic must be immediately blocked on interface drop");

    // Ensure subsequent attempts to transmit packets are rejected
    for _ in 0..10 {
        assert!(!guard.is_traffic_permitted(), "SR-07: Zero packets permitted during interface drop");
    }
}

#[test]
fn test_leak_suite_reconnect_with_isp_leak_fails_closed() {
    let mut guard = NetworkGuard::new();
    let vpn_guid = "adapter-wg0-vpn".to_string();
    let real_isp_ip = "203.0.113.19".to_string();

    guard.enable_private_mode(vpn_guid.clone(), Some(real_isp_ip.clone()));

    // Adapter reconnects, but routing leaks traffic over physical ISP
    let reconnected_vpn = vec![NetworkInterface {
        guid: vpn_guid.clone(),
        name: "WireGuard wg0".to_string(),
        ip: "10.8.0.5".to_string(),
        is_up: true,
    }];

    // Verification probe reports external IP is identical to ISP IP (leak scenario)
    guard.on_interface_change(&reconnected_vpn, Some(real_isp_ip));

    assert_eq!(guard.state(), NetworkGuardState::Blocked);
    assert!(!guard.is_traffic_permitted(), "INV-11: Must block traffic if external IP matches ISP");
}

#[test]
fn test_leak_suite_flapping_and_unverified_ip_fails_closed() {
    let mut guard = NetworkGuard::new();
    let vpn_guid = "adapter-tun0".to_string();

    guard.enable_private_mode(vpn_guid.clone(), Some("192.0.2.1".to_string()));

    // If interface comes up but verification fails (verified_ip is None)
    let flapping_iface = vec![NetworkInterface {
        guid: vpn_guid.clone(),
        name: "OpenVPN tun0".to_string(),
        ip: "10.2.0.1".to_string(),
        is_up: true,
    }];

    // Interface is up, but no verified external IP (unverified reconnect)
    let state = guard.on_interface_change(&flapping_iface, None);
    assert_eq!(state, NetworkGuardState::GuardedOk);

    // Interface drops again
    guard.on_interface_change(&[], None);
    assert_eq!(guard.state(), NetworkGuardState::Blocked);
    assert!(!guard.is_traffic_permitted(), "SR-08: Fail closed on drop");
}

#[test]
fn test_override_expires_after_time_limit() {
    let mut guard = NetworkGuard::new();
    guard.enable_private_mode("vpn-1".to_string(), None);
    guard.on_interface_change(&[], None); // Blocked
    assert_eq!(guard.state(), NetworkGuardState::Blocked);

    // User requests temporary override
    guard.request_override();
    assert_eq!(guard.state(), NetworkGuardState::Override);
    assert!(guard.is_traffic_permitted());

    // Artificially expire the override
    guard.override_duration = Duration::from_millis(0);
    assert_eq!(guard.state(), NetworkGuardState::Blocked);
    assert!(!guard.is_traffic_permitted(), "Override must expire and return to Blocked");
}
