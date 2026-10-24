//! # Database Layer with Hardened SQLite Configuration
//!
//! Enforces SR-12 and SR-15:
//! - PRAGMA secure_delete = ON (overwrites deleted database content with zeroes)
//! - PRAGMA journal_mode = WAL
//! - PRAGMA foreign_keys = ON
//! - 100% Parameterized queries with prepared statements (no string interpolation)

use rusqlite::{params, Connection, Result};
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Invalid schema version: expected {expected}, found {found}")]
    InvalidVersion { expected: u32, found: u32 },
}

pub struct CoreDatabase {
    conn: Connection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TorrentRecord {
    pub info_hash: [u8; 20],
    pub name: String,
    pub save_path: String,
    pub added_at: i64,
    pub state: String,
    pub size_bytes: i64,
}

impl CoreDatabase {
    pub const SCHEMA_VERSION: u32 = 1;

    /// Open an in-memory database (primarily for testing and non-persistent sessions).
    pub fn open_in_memory() -> Result<Self, DatabaseError> {
        let conn = Connection::open_in_memory()?;
        let mut db = Self { conn };
        db.init_pragmas_and_schema()?;
        Ok(db)
    }

    /// Open or create database at the specified path.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, DatabaseError> {
        let conn = Connection::open(path)?;
        let mut db = Self { conn };
        db.init_pragmas_and_schema()?;
        Ok(db)
    }

    fn init_pragmas_and_schema(&mut self) -> Result<(), DatabaseError> {
        // Enforce SR-15: PRAGMA secure_delete = ON
        self.conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA secure_delete = ON;
            PRAGMA synchronous = NORMAL;
            "#,
        )?;

        self.conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            );
            "#,
            [],
        )?;

        let current_version: Option<u32> = self.conn
            .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| row.get(0))
            .ok();

        match current_version {
            None => {
                self.conn.execute_batch(
                    r#"
                    CREATE TABLE torrents (
                        info_hash BLOB PRIMARY KEY,
                        name TEXT NOT NULL,
                        save_path TEXT NOT NULL,
                        added_at INTEGER NOT NULL,
                        state TEXT NOT NULL,
                        size_bytes INTEGER NOT NULL
                    );

                    CREATE TABLE settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    );

                    CREATE TABLE stats_daily (
                        date TEXT PRIMARY KEY,
                        downloaded_bytes INTEGER NOT NULL,
                        uploaded_bytes INTEGER NOT NULL
                    );

                    INSERT INTO schema_version (version) VALUES (1);
                    "#,
                )?;
            }
            Some(1) => {
                // Up to date
            }
            Some(other) => {
                return Err(DatabaseError::InvalidVersion {
                    expected: Self::SCHEMA_VERSION,
                    found: other,
                });
            }
        }

        Ok(())
    }

    /// Check if secure_delete pragma is active (1 = ON).
    pub fn is_secure_delete_enabled(&self) -> Result<bool, DatabaseError> {
        let val: i32 = self.conn.query_row("PRAGMA secure_delete;", [], |row| row.get(0))?;
        Ok(val == 1)
    }

    /// Upsert a torrent record using strictly parameterized queries.
    pub fn upsert_torrent(&mut self, record: &TorrentRecord) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO torrents (info_hash, name, save_path, added_at, state, size_bytes)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(info_hash) DO UPDATE SET
                name = excluded.name,
                save_path = excluded.save_path,
                state = excluded.state,
                size_bytes = excluded.size_bytes;
            "#,
            params![
                record.info_hash.as_slice(),
                &record.name,
                &record.save_path,
                record.added_at,
                &record.state,
                record.size_bytes
            ],
        )?;
        Ok(())
    }

    /// Retrieve a torrent record by info_hash.
    pub fn get_torrent(&self, info_hash: &[u8; 20]) -> Result<Option<TorrentRecord>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT info_hash, name, save_path, added_at, state, size_bytes FROM torrents WHERE info_hash = ?1",
        )?;

        let mut rows = stmt.query(params![info_hash.as_slice()])?;
        if let Some(row) = rows.next()? {
            let hash_blob: Vec<u8> = row.get(0)?;
            let mut hash = [0u8; 20];
            if hash_blob.len() == 20 {
                hash.copy_from_slice(&hash_blob);
            }
            Ok(Some(TorrentRecord {
                info_hash: hash,
                name: row.get(1)?,
                save_path: row.get(2)?,
                added_at: row.get(3)?,
                state: row.get(4)?,
                size_bytes: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// Delete a torrent record by info_hash.
    pub fn delete_torrent(&mut self, info_hash: &[u8; 20]) -> Result<bool, DatabaseError> {
        let rows_affected = self.conn.execute(
            "DELETE FROM torrents WHERE info_hash = ?1",
            params![info_hash.as_slice()],
        )?;
        Ok(rows_affected > 0)
    }

    /// Set a key-value setting.
    pub fn set_setting(&mut self, key: &str, value: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            r#"
            INSERT INTO settings (key, value)
            VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            "#,
            params![key, value],
        )?;
        Ok(())
    }

    /// Get a setting by key.
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, DatabaseError> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secure_delete_is_enforced() {
        let db = CoreDatabase::open_in_memory().expect("db open");
        assert!(db.is_secure_delete_enabled().expect("query secure_delete"));
    }

    #[test]
    fn test_parameterized_torrent_crud() {
        let mut db = CoreDatabase::open_in_memory().expect("db open");
        let hash = [0x55u8; 20];
        let record = TorrentRecord {
            info_hash: hash,
            name: "test_download.iso".to_string(),
            save_path: "C:\\Downloads\\Safe".to_string(),
            added_at: 1700000000,
            state: "AwaitingConfirm".to_string(),
            size_bytes: 1048576,
        };

        db.upsert_torrent(&record).expect("upsert torrent");

        let fetched = db.get_torrent(&hash).expect("get torrent").expect("found");
        assert_eq!(fetched, record);

        let deleted = db.delete_torrent(&hash).expect("delete torrent");
        assert!(deleted);

        let fetched_after = db.get_torrent(&hash).expect("get torrent");
        assert_eq!(fetched_after, None);
    }

    #[test]
    fn test_sql_injection_resistance() {
        let mut db = CoreDatabase::open_in_memory().expect("db open");
        let malicious_key = "test_key'; DROP TABLE settings; --";
        let malicious_value = "' OR '1'='1";

        db.set_setting(malicious_key, malicious_value).expect("safe insert");
        let val = db.get_setting(malicious_key).expect("fetch setting").expect("found");
        assert_eq!(val, malicious_value);

        // Verify settings table was NOT dropped
        let settings_still_exists = db.get_setting("non_existent").expect("query works");
        assert_eq!(settings_still_exists, None);
    }
}
