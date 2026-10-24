#![forbid(unsafe_code)]

//! # Cairn Core
//!
//! Core orchestration, state machine, and Network Guard policy enforcement.
//! The Core process runs with NO direct network privileges (Part II, Section 15.1, SR-02).

pub mod bencode;
pub mod db;
pub mod ipc;
pub mod keystore;
pub mod netguard;
pub mod resume;
pub mod state;
pub mod updater;

pub use bencode::{BencodeError, BencodeParser, BencodeValue};
pub use db::{CoreDatabase, DatabaseError, TorrentRecord};
pub use ipc::{IpcCodec, IpcError, SessionToken};
pub use keystore::SecretKey256;
pub use netguard::{NetworkGuard, NetworkGuardError, NetworkGuardState, NetworkInterface};
pub use resume::{AuthenticatedResumeEnvelope, ResumeIntegrityError};
pub use state::{StateTransitionError, TorrentState};
pub use updater::{
    SignedUpdateManifest, UpdateTargetMetadata, UpdateVerificationError, UpdateVerifier,
    PINNED_ROOT_PUBLIC_KEY,
};
