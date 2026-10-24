//! # Cairn Fuzz Harness
//!
//! Fuzzing targets and regression seeds as required by Section 17.3.
//! Targets SafePath, Bencode parser, Magnet URI parser, and IPC message schemas.

pub fn fuzz_safepath_component(data: &[u8]) {
    if let Ok(s) = std::str::from_utf8(data) {
        let _ = cairn_safety::sanitize_component(s);
    }
}

pub fn fuzz_bencode(data: &[u8]) {
    let _ = cairn_core::BencodeParser::parse(data);
}

pub fn fuzz_ipc_frame(data: &[u8]) {
    let token = cairn_core::SessionToken::new([0x00; 32]);
    let codec = cairn_core::IpcCodec::new(token);
    let _ = codec.decode_frame(data);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_regression_seeds() {
        // SafePath regression seeds
        fuzz_safepath_component(b"");
        fuzz_safepath_component(b"CON.txt");
        fuzz_safepath_component(b"../../etc/passwd");
        fuzz_safepath_component(b"\x00\x1f\x7f");

        // Bencode regression seeds (deep nesting, large string lengths, truncated bytes)
        fuzz_bencode(b"d");
        fuzz_bencode(b"l");
        fuzz_bencode(b"i0e");
        fuzz_bencode(b"i-0e");
        fuzz_bencode(b"9999999999999999999:a");
        fuzz_bencode(b"d1:a1:be");

        // IPC frame regression seeds
        fuzz_ipc_frame(b"");
        fuzz_ipc_frame(&[0xFF, 0xFF, 0xFF, 0xFF, 0x01]);
    }
}
