#![forbid(unsafe_code)]

//! # Cairn Safety
//!
//! Provides path sanitization, file-type risk classification, and quarantine enforcement
//! conforming strictly to Section 16.4 and Section 17 of `docs/PLAN.md`.
//!
//! - SafePath: Ensures untrusted path inputs from peers or torrent metadata cannot traverse,
//!   collide, escape the user-approved destination directory, or leverage reserved filenames (INV-03, SR-05).
//! - Risky file type detector: Flags executable, script, and macro-enabled files to ensure
//!   explicit warning indicators in the UI (INV-05, SR-18).

pub mod safepath;

pub use safepath::{
    is_risky_file, sanitize_component, sanitize_torrent_file_list, SafePathError,
    RISKY_EXTENSIONS,
};
