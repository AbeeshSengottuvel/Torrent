//! # Hardened Bencode Parser with Strict Resource Limits
//!
//! Enforces INV-10 and SR-04:
//! - Check-then-allocate semantics to prevent OOM denial of service.
//! - Hard maximum document size: 16 MiB (16 * 1024 * 1024 bytes).
//! - Hard maximum recursion / nesting depth: 64 levels.
//! - Hard maximum total tokens: 2,000,000.
//! - Dictionary keys must be lexicographically sorted byte strings without duplicates.

use thiserror::Error;

pub const MAX_BENCODE_DOCUMENT_BYTES: usize = 16 * 1024 * 1024; // 16 MiB
pub const MAX_BENCODE_DEPTH: usize = 64;
pub const MAX_BENCODE_TOKENS: usize = 2_000_000;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum BencodeError {
    #[error("Document size exceeds maximum allowable limit (16 MiB)")]
    DocumentTooLarge,
    #[error("Recursion / nesting depth exceeds maximum allowable limit (64)")]
    DepthExceeded,
    #[error("Total token count exceeds maximum allowable limit (2,000,000)")]
    TokenLimitExceeded,
    #[error("Unexpected end of input at position {0}")]
    UnexpectedEof(usize),
    #[error("Invalid bencode syntax at position {0}: {1}")]
    SyntaxError(usize, String),
    #[error("Invalid dictionary key order or duplicate key at position {0}")]
    InvalidDictionaryKeyOrder(usize),
    #[error("String length declaration exceeds remaining document bytes at position {0}")]
    StringLengthOverflow(usize),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BencodeValue<'a> {
    Integer(i64),
    ByteString(&'a [u8]),
    List(Vec<BencodeValue<'a>>),
    Dict(Vec<(&'a [u8], BencodeValue<'a>)>),
}

pub struct BencodeParser<'a> {
    input: &'a [u8],
    pos: usize,
    tokens: usize,
}

impl<'a> BencodeParser<'a> {
    pub fn parse(input: &'a [u8]) -> Result<BencodeValue<'a>, BencodeError> {
        if input.len() > MAX_BENCODE_DOCUMENT_BYTES {
            return Err(BencodeError::DocumentTooLarge);
        }

        let mut parser = Self {
            input,
            pos: 0,
            tokens: 0,
        };

        let val = parser.parse_value(0)?;
        if parser.pos != input.len() {
            return Err(BencodeError::SyntaxError(
                parser.pos,
                format!("Trailing garbage: {} unparsed bytes", input.len() - parser.pos),
            ));
        }

        Ok(val)
    }

    fn check_token(&mut self) -> Result<(), BencodeError> {
        self.tokens += 1;
        if self.tokens > MAX_BENCODE_TOKENS {
            Err(BencodeError::TokenLimitExceeded)
        } else {
            Ok(())
        }
    }

    fn parse_value(&mut self, depth: usize) -> Result<BencodeValue<'a>, BencodeError> {
        if depth > MAX_BENCODE_DEPTH {
            return Err(BencodeError::DepthExceeded);
        }

        self.check_token()?;

        if self.pos >= self.input.len() {
            return Err(BencodeError::UnexpectedEof(self.pos));
        }

        match self.input[self.pos] {
            b'i' => self.parse_integer(),
            b'l' => self.parse_list(depth + 1),
            b'd' => self.parse_dict(depth + 1),
            b'0'..=b'9' => self.parse_byte_string(),
            byte => Err(BencodeError::SyntaxError(
                self.pos,
                format!("Unexpected token header byte: 0x{:02x}", byte),
            )),
        }
    }

    fn parse_integer(&mut self) -> Result<BencodeValue<'a>, BencodeError> {
        self.pos += 1; // consume 'i'
        let start = self.pos;

        while self.pos < self.input.len() && self.input[self.pos] != b'e' {
            self.pos += 1;
        }

        if self.pos >= self.input.len() {
            return Err(BencodeError::UnexpectedEof(self.pos));
        }

        let num_str = std::str::from_utf8(&self.input[start..self.pos])
            .map_err(|_| BencodeError::SyntaxError(start, "Non-UTF8 integer literal".to_string()))?;

        // Disallow negative zero "-0" or leading zeroes like "03"
        if num_str == "-0" || (num_str.len() > 1 && num_str.starts_with('0')) || (num_str.starts_with("-0")) {
            return Err(BencodeError::SyntaxError(start, "Invalid leading zero in integer".to_string()));
        }

        let val: i64 = num_str.parse()
            .map_err(|_| BencodeError::SyntaxError(start, "Integer parsing failed / overflow".to_string()))?;

        self.pos += 1; // consume 'e'
        Ok(BencodeValue::Integer(val))
    }

    fn parse_byte_string(&mut self) -> Result<BencodeValue<'a>, BencodeError> {
        let colon_idx = self.input[self.pos..]
            .iter()
            .position(|&b| b == b':')
            .ok_or(BencodeError::UnexpectedEof(self.pos))?;

        let len_str = std::str::from_utf8(&self.input[self.pos..self.pos + colon_idx])
            .map_err(|_| BencodeError::SyntaxError(self.pos, "Non-UTF8 string length".to_string()))?;

        if len_str.len() > 1 && len_str.starts_with('0') {
            return Err(BencodeError::SyntaxError(self.pos, "Leading zero in string length".to_string()));
        }

        let len: usize = len_str.parse()
            .map_err(|_| BencodeError::SyntaxError(self.pos, "Invalid string length integer".to_string()))?;

        self.pos += colon_idx + 1; // skip past ':'

        // Check-then-allocate: ensure string fits in remaining input buffer
        if len > self.input.len().saturating_sub(self.pos) {
            return Err(BencodeError::StringLengthOverflow(self.pos));
        }

        let slice = &self.input[self.pos..self.pos + len];
        self.pos += len;
        Ok(BencodeValue::ByteString(slice))
    }

    fn parse_list(&mut self, depth: usize) -> Result<BencodeValue<'a>, BencodeError> {
        self.pos += 1; // consume 'l'
        let mut list = Vec::new();

        while self.pos < self.input.len() && self.input[self.pos] != b'e' {
            let item = self.parse_value(depth)?;
            list.push(item);
        }

        if self.pos >= self.input.len() {
            return Err(BencodeError::UnexpectedEof(self.pos));
        }

        self.pos += 1; // consume 'e'
        Ok(BencodeValue::List(list))
    }

    fn parse_dict(&mut self, depth: usize) -> Result<BencodeValue<'a>, BencodeError> {
        self.pos += 1; // consume 'd'
        let mut dict = Vec::new();
        let mut prev_key: Option<&'a [u8]> = None;

        while self.pos < self.input.len() && self.input[self.pos] != b'e' {
            let key_pos = self.pos;
            let key_val = self.parse_byte_string()?;
            let key = match key_val {
                BencodeValue::ByteString(s) => s,
                _ => unreachable!(),
            };

            // Enforce canonical sorted key order without duplicates
            if let Some(prev) = prev_key {
                if key <= prev {
                    return Err(BencodeError::InvalidDictionaryKeyOrder(key_pos));
                }
            }
            prev_key = Some(key);

            let val = self.parse_value(depth)?;
            dict.push((key, val));
        }

        if self.pos >= self.input.len() {
            return Err(BencodeError::UnexpectedEof(self.pos));
        }

        self.pos += 1; // consume 'e'
        Ok(BencodeValue::Dict(dict))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_bencode_structures() {
        let input = b"d4:infod6:lengthi12345e4:name10:sample.txt12:piece lengthi16384ee4:sizei54321ee";
        let parsed = BencodeParser::parse(input).expect("valid parse");
        match parsed {
            BencodeValue::Dict(entries) => {
                assert_eq!(entries.len(), 2);
                assert_eq!(entries[0].0, b"info");
                assert_eq!(entries[1].0, b"size");
            }
            _ => panic!("Expected dictionary"),
        }
    }

    #[test]
    fn test_depth_overflow_rejected() {
        // Construct 70 nested lists
        let mut nested = Vec::new();
        for _ in 0..70 {
            nested.push(b'l');
        }
        nested.push(b'i');
        nested.push(b'1');
        nested.push(b'e');
        for _ in 0..70 {
            nested.push(b'e');
        }

        assert_eq!(BencodeParser::parse(&nested), Err(BencodeError::DepthExceeded));
    }

    #[test]
    fn test_string_length_overflow_rejected() {
        // Claims 999999999 bytes but input ends
        let malicious = b"999999999:abc";
        assert_eq!(BencodeParser::parse(malicious), Err(BencodeError::StringLengthOverflow(10)));
    }

    #[test]
    fn test_unsorted_dictionary_keys_rejected() {
        // 'z' precedes 'a'
        let unsorted = b"d1:zi1e1:ai2ee";
        assert!(matches!(BencodeParser::parse(unsorted), Err(BencodeError::InvalidDictionaryKeyOrder(_))));
    }

    #[test]
    fn test_duplicate_dictionary_keys_rejected() {
        let dup = b"d1:ai1e1:ai2ee";
        assert!(matches!(BencodeParser::parse(dup), Err(BencodeError::InvalidDictionaryKeyOrder(_))));
    }
}
