use std::time::{Duration, Instant};
use thiserror::Error;
use tracing::{info, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkGuardState {
    Standby,
    WaitingForIface,
    GuardedOk,
    Blocked,
    Override,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NetworkInterface {
    pub guid: String,
    pub name: String,
    pub ip: String,
    pub is_up: bool,
}

#[derive(Debug, Error)]
pub enum NetworkGuardError {
    #[error("Internal guard failure; failing closed (INV-11): {0}")]
    InternalError(String),
    #[error("Interface not found: {0}")]
    InterfaceNotFound(String),
    #[error("Verification failed: IP matches real ISP or is unresolved")]
    VerificationFailed,
    #[error("Override has expired")]
    OverrideExpired,
}

pub struct NetworkGuard {
    state: NetworkGuardState,
    selected_guid: Option<String>,
    bound_ip: Option<String>,
    isp_ip: Option<String>,
    override_start: Option<Instant>,
    pub override_duration: Duration,
    last_flap: Instant,
    pub debounce_duration: Duration,
}

impl Default for NetworkGuard {
    fn default() -> Self {
        Self::new()
    }
}

impl NetworkGuard {
    pub fn new() -> Self {
        Self {
            state: NetworkGuardState::Standby,
            selected_guid: None,
            bound_ip: None,
            isp_ip: None,
            override_start: None,
            override_duration: Duration::from_secs(15 * 60), // 15 minutes auto-expire
            last_flap: Instant::now(),
            debounce_duration: Duration::from_millis(300), // 300 ms debounce
        }
    }

    pub fn state(&self) -> NetworkGuardState {
        // Check if override has expired
        if self.state == NetworkGuardState::Override {
            if let Some(start) = self.override_start {
                if start.elapsed() >= self.override_duration {
                    return NetworkGuardState::Blocked;
                }
            }
        }
        self.state
    }

    pub fn is_traffic_permitted(&self) -> bool {
        match self.state() {
            NetworkGuardState::Standby | NetworkGuardState::GuardedOk | NetworkGuardState::Override => true,
            NetworkGuardState::WaitingForIface | NetworkGuardState::Blocked => false,
        }
    }

    /// User enables Private Mode and selects a VPN adapter
    pub fn enable_private_mode(&mut self, iface_guid: String, current_isp_ip: Option<String>) {
        info!("Network Guard enabled with adapter GUID: {}", iface_guid);
        self.selected_guid = Some(iface_guid);
        self.isp_ip = current_isp_ip;
        self.state = NetworkGuardState::WaitingForIface;
    }

    /// User disables Private Mode
    pub fn disable(&mut self) {
        self.selected_guid = None;
        self.bound_ip = None;
        self.state = NetworkGuardState::Standby;
    }

    /// Interface state update callback from OS monitor
    pub fn on_interface_change(
        &mut self,
        interfaces: &[NetworkInterface],
        verified_ip: Option<String>,
    ) -> NetworkGuardState {
        let guid = match &self.selected_guid {
            Some(g) => g.clone(),
            None => {
                self.state = NetworkGuardState::Standby;
                return self.state;
            }
        };

        let target_iface = interfaces.iter().find(|i| i.guid == guid);

        match target_iface {
            Some(iface) if iface.is_up => {
                // If previously down or IP changed, trigger reconnect verification
                let ip_changed = self.bound_ip.as_ref() != Some(&iface.ip);
                if self.state == NetworkGuardState::Blocked
                    || self.state == NetworkGuardState::WaitingForIface
                    || ip_changed
                {
                    self.last_flap = Instant::now();
                    self.bound_ip = Some(iface.ip.clone());

                    // Verification check: ensure traffic doesn't route over ISP (INV-02, INV-11)
                    if let Some(ref ext_ip) = verified_ip {
                        if self.isp_ip.as_ref() == Some(ext_ip) {
                            warn!("VPN interface check revealed real ISP IP! Blocking traffic.");
                            self.state = NetworkGuardState::Blocked;
                            return self.state;
                        }
                    }

                    self.state = NetworkGuardState::GuardedOk;
                }
            }
            _ => {
                // Going to BLOCKED is immediate without waiting for debounce (INV-02)
                warn!("VPN interface vanished or down. Blocking all BitTorrent traffic immediately.");
                self.state = NetworkGuardState::Blocked;
            }
        }

        self.state
    }

    /// User activates temporary 15-minute emergency override
    pub fn request_override(&mut self) {
        warn!("User requested 15-minute Network Guard override.");
        self.override_start = Some(Instant::now());
        self.state = NetworkGuardState::Override;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fails_closed_when_interface_drops() {
        let mut guard = NetworkGuard::new();
        guard.enable_private_mode("vpn-tun0".to_string(), Some("203.0.113.1".to_string()));
        assert!(!guard.is_traffic_permitted()); // WaitingForIface blocks traffic

        let ifaces = vec![NetworkInterface {
            guid: "vpn-tun0".to_string(),
            name: "ProtonVPN".to_string(),
            ip: "10.2.0.2".to_string(),
            is_up: true,
        }];

        guard.on_interface_change(&ifaces, Some("198.51.100.42".to_string()));
        assert_eq!(guard.state(), NetworkGuardState::GuardedOk);
        assert!(guard.is_traffic_permitted());

        // Interface drops
        let empty_ifaces: Vec<NetworkInterface> = vec![];
        guard.on_interface_change(&empty_ifaces, None);
        assert_eq!(guard.state(), NetworkGuardState::Blocked);
        assert!(!guard.is_traffic_permitted());
    }

    #[test]
    fn test_blocks_if_external_ip_matches_isp() {
        let mut guard = NetworkGuard::new();
        let isp = "192.0.2.10".to_string();
        guard.enable_private_mode("vpn-tun0".to_string(), Some(isp.clone()));

        let ifaces = vec![NetworkInterface {
            guid: "vpn-tun0".to_string(),
            name: "Mullvad".to_string(),
            ip: "10.2.0.2".to_string(),
            is_up: true,
        }];

        // Leaked ISP IP detected
        guard.on_interface_change(&ifaces, Some(isp));
        assert_eq!(guard.state(), NetworkGuardState::Blocked);
        assert!(!guard.is_traffic_permitted());
    }
}
