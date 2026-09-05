use crate::crypto::{decrypt_payload, encrypt_payload};
use std::io::Write;

pub const OCTAZIP_HEADER: &str = "-----BEGIN OCTAZIP V1.0-----";
pub const OCTAZIP_FOOTER: &str = "-----END OCTAZIP-----";

/// Encodes binary payload into OctaZip text armor format.
/// Pipeline: [ChaCha20-Poly1305 Encrypt if passphrase] -> [Brotli Compression] -> [CRC16 + Flags] -> [Base91 Armor]
pub fn encode_octazip(payload: &[u8], passphrase: &str) -> Result<String, String> {
    // 1. Optional encryption
    let encrypted_flag: u8;
    let data_to_compress: Vec<u8>;
    if !passphrase.trim().is_empty() {
        encrypted_flag = 1;
        data_to_compress = encrypt_payload(payload, passphrase)?;
    } else {
        encrypted_flag = 0;
        data_to_compress = payload.to_vec();
    }

    // 2. Brotli compression check
    let mut writer = brotli::CompressorWriter::new(Vec::new(), 4096, 9, 22);
    let mut brotli_flag: u8 = 0;
    let mut final_bytes = data_to_compress.clone();
    if writer.write_all(&data_to_compress).is_ok() {
        let compressed = writer.into_inner();
        if compressed.len() < data_to_compress.len() {
            brotli_flag = 1;
            final_bytes = compressed;
        }
    }

    // 3. Binary envelope: [Magic "OZ"] + [Flags: (enc << 1) | brotli] + [CRC16 (2 bytes)] + [Payload]
    let crc = crc16::State::<crc16::XMODEM>::calculate(&final_bytes);
    let flags = (encrypted_flag << 1) | brotli_flag;

    let mut envelope = Vec::with_capacity(5 + final_bytes.len());
    envelope.extend_from_slice(b"OZ");
    envelope.push(flags);
    envelope.extend_from_slice(&crc.to_be_bytes());
    envelope.extend_from_slice(&final_bytes);

    // 4. Base91 representation
    let encoded_b91 = base91::slice_encode(&envelope);
    let b91_str = String::from_utf8(encoded_b91).map_err(|e| e.to_string())?;

    // Break into lines of 64 characters
    let mut wrapped = String::new();
    for chunk in b91_str.as_bytes().chunks(64) {
        wrapped.push_str(std::str::from_utf8(chunk).unwrap());
        wrapped.push('\n');
    }

    Ok(format!("{}\n{}{}", OCTAZIP_HEADER, wrapped, OCTAZIP_FOOTER))
}

/// Decodes an OctaZip text armor into raw payload bytes.
pub fn decode_octazip(armor_text: &str, passphrase: &str) -> Result<Vec<u8>, String> {
    let clean = armor_text.trim();
    let body = if clean.contains(OCTAZIP_HEADER) && clean.contains(OCTAZIP_FOOTER) {
        let start = clean.find(OCTAZIP_HEADER).unwrap() + OCTAZIP_HEADER.len();
        let end = clean.find(OCTAZIP_FOOTER).unwrap();
        clean[start..end].replace(['\r', '\n', ' '], "")
    } else {
        clean.replace(['\r', '\n', ' '], "")
    };

    let envelope = base91::slice_decode(body.as_bytes());
    if envelope.len() < 5 || &envelope[0..2] != b"OZ" {
        return Err("Invalid OctaZip header or corrupted envelope".to_string());
    }

    let flags = envelope[2];
    let encrypted_flag = (flags >> 1) & 1;
    let brotli_flag = flags & 1;

    let expected_crc = u16::from_be_bytes([envelope[3], envelope[4]]);
    let compressed_data = &envelope[5..];

    let actual_crc = crc16::State::<crc16::XMODEM>::calculate(compressed_data);
    if actual_crc != expected_crc {
        return Err("OctaZip CRC checksum verification failed".to_string());
    }

    // Decompress Brotli if flag set
    let decompressed = if brotli_flag == 1 {
        let mut out = Vec::new();
        let mut reader = brotli::Decompressor::new(compressed_data, 4096);
        std::io::copy(&mut reader, &mut out)
            .map_err(|e| format!("Brotli decompress error: {}", e))?;
        out
    } else {
        compressed_data.to_vec()
    };

    // Decrypt if encrypted flag set
    if encrypted_flag == 1 {
        if passphrase.trim().is_empty() {
            return Err("OctaZip payload is encrypted. Passphrase required.".to_string());
        }
        decrypt_payload(&decompressed, passphrase)
    } else {
        Ok(decompressed)
    }
}
