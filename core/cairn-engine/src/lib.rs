//! # Cairn Engine
//!
//! Sandboxed BitTorrent engine wrapper. Enforces secure baseline settings (Section 16.2),
//! typed handles, and strict event mapping.

pub mod settings;
pub mod sandbox;

pub use settings::{EngineSettings, EngineSettingsBuilder, EncryptionPolicy};
pub use sandbox::{EngineSandboxPolicy, SandboxError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TorrentHandleId(pub u64);

#[derive(Debug, Clone)]
pub enum EngineAlert {
    MetadataReceived {
        id: TorrentHandleId,
        total_size: u64,
        piece_count: u32,
    },
    PieceFinished {
        id: TorrentHandleId,
        piece_index: u32,
    },
    TorrentFinished {
        id: TorrentHandleId,
    },
    TorrentError {
        id: TorrentHandleId,
        error_message: String,
    },
    InterfaceStateChanged {
        is_bound_active: bool,
    },
}
