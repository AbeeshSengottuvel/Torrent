use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;
use unicode_normalization::UnicodeNormalization;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum SafePathError {
    #[error("Empty path component")]
    EmptyComponent,

    #[error("Invalid character '{0}' in path component")]
    InvalidCharacter(char),

    #[error("Component contains reserved Windows device name: {0}")]
    ReservedDeviceName(String),

    #[error("Path traversal detected with component: {0}")]
    TraversalAttempt(String),

    #[error("Path component exceeds 255 bytes: length is {0}")]
    ComponentTooLong(usize),

    #[error("Total path length exceeds 240 characters: length is {0}")]
    TotalPathTooLong(usize),

    #[error("Resolved path escapes root directory '{0}'")]
    PathEscapesRoot(String),

    #[error("Internal path normalization error")]
    NormalizationError,
}

/// Dangerous file extensions that require a security warning in the UI (INV-05, SR-18)
pub const RISKY_EXTENSIONS: &[&str] = &[
    "exe", "bat", "cmd", "ps1", "vbs", "vbe", "js", "jse", "wsf", "wsh",
    "msi", "msp", "com", "scr", "hta", "cpl", "pif", "reg", "jar", "app",
    "dmg", "pkg", "deb", "rpm", "apk", "sh", "bin", "docm", "xlsm", "pptm",
];

/// Sanitizes a single path component per SafePath rules (docs/PLAN.md 16.4)
pub fn sanitize_component(raw: &str) -> Result<String, SafePathError> {
    if raw.is_empty() {
        return Err(SafePathError::EmptyComponent);
    }

    // 1 & 2. Normalize to Unicode NFC
    let nfc: String = raw.nfc().collect();

    // 3. Reject dot components
    if nfc == "." || nfc == ".." {
        return Err(SafePathError::TraversalAttempt(nfc));
    }

    // 3 & 4. Validate individual characters
    let mut clean_chars = Vec::with_capacity(nfc.len());
    for c in nfc.chars() {
        let code = c as u32;

        // Path separators & NUL
        if c == '/' || c == '\\' || c == '\0' {
            return Err(SafePathError::InvalidCharacter(c));
        }

        // C0 and C1 control characters
        if (code <= 0x1F) || (0x7F..=0x9F).contains(&code) {
            return Err(SafePathError::InvalidCharacter(c));
        }

        // Bidirectional controls (U+202A..=U+202E, U+2066..=U+2069)
        if (0x202A..=0x202E).contains(&code) || (0x2066..=0x2069).contains(&code) {
            return Err(SafePathError::InvalidCharacter(c));
        }

        // Zero-width and BOM characters (U+200B..=U+200F, U+FEFF)
        if (0x200B..=0x200F).contains(&code) || code == 0xFEFF {
            return Err(SafePathError::InvalidCharacter(c));
        }

        // Windows forbidden characters: < > : " | ? *
        if matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*') {
            return Err(SafePathError::InvalidCharacter(c));
        }

        clean_chars.push(c);
    }

    let candidate: String = clean_chars.into_iter().collect();

    // Rule 4: Trailing dots and spaces are stripped or rejected
    let trimmed = candidate.trim_end_matches(['.', ' ']).to_string();
    if trimmed.is_empty() {
        return Err(SafePathError::EmptyComponent);
    }

    // Rule 4: Reserved Windows device names
    let stem = trimmed.split('.').next().unwrap_or("").to_ascii_uppercase();
    let normalized_stem = normalize_superscripts(&stem);
    if is_reserved_device_name(&normalized_stem) {
        return Err(SafePathError::ReservedDeviceName(trimmed));
    }

    // Rule 5: Length: at most 255 bytes (UTF-8)
    if trimmed.len() > 255 {
        return Err(SafePathError::ComponentTooLong(trimmed.len()));
    }

    Ok(trimmed)
}

fn normalize_superscripts(s: &str) -> String {
    s.replace('\u{00B9}', "1")
        .replace('\u{00B2}', "2")
        .replace('\u{00B3}', "3")
}

fn is_reserved_device_name(stem: &str) -> bool {
    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    RESERVED.contains(&stem)
}

/// Normalizes and confines an entire relative torrent path against an approved root folder.
/// Resolves collisions deterministically within a torrent (docs/PLAN.md 16.4 Rule 6).
pub fn sanitize_torrent_file_list(
    raw_paths: &[Vec<String>],
    root_folder: &Path,
) -> Result<Vec<PathBuf>, SafePathError> {
    let mut sanitized_paths = Vec::with_capacity(raw_paths.len());
    let mut case_folded_seen: HashMap<String, usize> = HashMap::new();

    for components in raw_paths {
        if components.is_empty() {
            return Err(SafePathError::EmptyComponent);
        }

        let mut safe_components = Vec::with_capacity(components.len());
        for (idx, comp) in components.iter().enumerate() {
            let sanitized = sanitize_component(comp)?;
            safe_components.push((idx == components.len() - 1, sanitized));
        }

        // Build relative path
        let mut rel_path = PathBuf::new();
        for (_, comp) in &safe_components[..safe_components.len() - 1] {
            rel_path.push(comp);
        }

        // Handle filename collision (Rule 6)
        let last_comp = &safe_components.last().expect("components not empty").1;
        let mut final_filename = last_comp.clone();

        let case_key = rel_path.join(&final_filename).to_string_lossy().to_lowercase();
        if let Some(count) = case_folded_seen.get_mut(&case_key) {
            *count += 1;
            let (stem, ext) = match final_filename.rfind('.') {
                Some(pos) => (&final_filename[..pos], &final_filename[pos..]),
                None => (final_filename.as_str(), ""),
            };
            final_filename = format!("{}_{}{}", stem, count, ext);
        } else {
            case_folded_seen.insert(case_key, 0);
        }

        rel_path.push(final_filename);

        // Rule 5: Check total path length limit (240 characters)
        let full_path = root_folder.join(&rel_path);
        let path_str = full_path.to_string_lossy();
        if path_str.chars().count() > 240 {
            return Err(SafePathError::TotalPathTooLong(path_str.chars().count()));
        }

        // Rule 7: Joining with approved root must stay beneath the canonical root
        sanitized_paths.push(full_path);
    }

    Ok(sanitized_paths)
}

/// Checks if a file has an extension categorized as high-risk
pub fn is_risky_file(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_ascii_lowercase();
        RISKY_EXTENSIONS.contains(&ext_lower.as_str())
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_component() {
        assert_eq!(sanitize_component("hello_world.txt").unwrap(), "hello_world.txt");
        assert_eq!(sanitize_component("video (2026).mp4").unwrap(), "video (2026).mp4");
    }

    #[test]
    fn test_rejects_traversal() {
        assert!(matches!(sanitize_component(".."), Err(SafePathError::TraversalAttempt(_))));
        assert!(matches!(sanitize_component("."), Err(SafePathError::TraversalAttempt(_))));
        assert!(matches!(sanitize_component("../etc"), Err(SafePathError::InvalidCharacter('/'))));
        assert!(matches!(sanitize_component("..\\windows"), Err(SafePathError::InvalidCharacter('\\'))));
    }

    #[test]
    fn test_rejects_windows_reserved_names() {
        assert!(matches!(sanitize_component("CON"), Err(SafePathError::ReservedDeviceName(_))));
        assert!(matches!(sanitize_component("con.txt"), Err(SafePathError::ReservedDeviceName(_))));
        assert!(matches!(sanitize_component("aux.tar.gz"), Err(SafePathError::ReservedDeviceName(_))));
        assert!(matches!(sanitize_component("LPT1"), Err(SafePathError::ReservedDeviceName(_))));
        assert!(matches!(sanitize_component("COM\u{00B9}"), Err(SafePathError::ReservedDeviceName(_))));
    }

    #[test]
    fn test_rejects_bidi_and_control_chars() {
        // RTL override character U+202E
        let bad_str = format!("abc{}def.exe", '\u{202E}');
        assert!(matches!(sanitize_component(&bad_str), Err(SafePathError::InvalidCharacter('\u{202E}'))));

        // NUL byte
        assert!(matches!(sanitize_component("file\0name"), Err(SafePathError::InvalidCharacter('\0'))));
    }

    #[test]
    fn test_collision_resolution() {
        let root = Path::new("C:/Downloads");
        let list = vec![
            vec!["Folder".to_string(), "file.txt".to_string()],
            vec!["folder".to_string(), "FILE.txt".to_string()],
        ];

        let sanitized = sanitize_torrent_file_list(&list, root).unwrap();
        assert_eq!(sanitized.len(), 2);
        assert_eq!(sanitized[0], root.join("Folder").join("file.txt"));
        assert_eq!(sanitized[1], root.join("folder").join("FILE_1.txt"));
    }

    #[test]
    fn test_risky_file_identification() {
        assert!(is_risky_file(Path::new("installer.exe")));
        assert!(is_risky_file(Path::new("payload.bat")));
        assert!(is_risky_file(Path::new("script.PS1")));
        assert!(is_risky_file(Path::new("macro.docm")));
        assert!(!is_risky_file(Path::new("movie.mkv")));
        assert!(!is_risky_file(Path::new("document.pdf")));
    }
}
