#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EncryptionPolicy {
    Enabled,
    Forced,
}

#[derive(Debug, Clone)]
pub struct EngineSettings {
    pub listen_interfaces: String,
    pub outgoing_interfaces: String,
    pub enable_dht: bool,
    pub enable_lsd: bool,
    pub enable_upnp: bool,
    pub enable_natpmp: bool,
    pub encryption_policy: EncryptionPolicy,
    pub anonymous_mode: bool,
    pub max_metadata_size: usize,
    pub no_connect_privileged_ports: bool,
    pub ssrf_mitigation: bool,
    pub validate_https_trackers: bool,
    pub connections_limit: u32,
    pub user_agent: String,
}

pub struct EngineSettingsBuilder {
    settings: EngineSettings,
}

impl Default for EngineSettingsBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl EngineSettingsBuilder {
    /// Constructs default settings adhering to Section 16.2 Secure Baseline
    pub fn new() -> Self {
        Self {
            settings: EngineSettings {
                listen_interfaces: "127.0.0.1:0".to_string(),
                outgoing_interfaces: "127.0.0.1".to_string(),
                enable_dht: true,
                enable_lsd: true,
                enable_upnp: true,
                enable_natpmp: true,
                encryption_policy: EncryptionPolicy::Enabled,
                anonymous_mode: false,
                max_metadata_size: 8 * 1024 * 1024, // 8 MiB hard limit (17.1)
                no_connect_privileged_ports: true,
                ssrf_mitigation: true,
                validate_https_trackers: true,
                connections_limit: 200,
                user_agent: "Cairn/1.0".to_string(),
            },
        }
    }

    /// Enforces Private Mode baseline settings (Section 16.2 & Section 18)
    pub fn enforce_private_mode(mut self, bound_interface_ip: &str, random_port: u16) -> Self {
        self.settings.listen_interfaces = format!("{}:{}", bound_interface_ip, random_port);
        self.settings.outgoing_interfaces = bound_interface_ip.to_string();
        self.settings.enable_dht = false;
        self.settings.enable_lsd = false;
        self.settings.enable_upnp = false;
        self.settings.enable_natpmp = false;
        self.settings.anonymous_mode = true;
        self.settings.encryption_policy = EncryptionPolicy::Forced;
        self
    }

    pub fn build(self) -> EngineSettings {
        self.settings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_private_mode_baseline() {
        let settings = EngineSettingsBuilder::new()
            .enforce_private_mode("10.8.0.2", 49152)
            .build();

        assert_eq!(settings.listen_interfaces, "10.8.0.2:49152");
        assert_eq!(settings.outgoing_interfaces, "10.8.0.2");
        assert!(!settings.enable_dht);
        assert!(!settings.enable_lsd);
        assert!(!settings.enable_upnp);
        assert!(!settings.enable_natpmp);
        assert!(settings.anonymous_mode);
        assert_eq!(settings.encryption_policy, EncryptionPolicy::Forced);
    }
}
