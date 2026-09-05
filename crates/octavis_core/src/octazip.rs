use crate::crypto::{decrypt_payload, encrypt_payload};
use std::io::Write;

pub const OCTAZIP_MAGIC: &[u8; 8] = b"OCTAZIP1";

/// Packs raw payload bytes into a .octazip binary package
/// Envelope: [Magic "OCTAZIP1" (8B)] + [Flags (1B): (encrypted << 1) | brotli] + [CRC16 (2B)] + [Data]
pub fn pack_octazip(payload: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    let encrypted_flag: u8;
    let data_to_compress: Vec<u8>;
    if !passphrase.trim().is_empty() {
        encrypted_flag = 1;
        data_to_compress = encrypt_payload(payload, passphrase)?;
    } else {
        encrypted_flag = 0;
        data_to_compress = payload.to_vec();
    }

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

    let crc = crc16::State::<crc16::XMODEM>::calculate(&final_bytes);
    let flags = (encrypted_flag << 1) | brotli_flag;

    let mut package = Vec::with_capacity(11 + final_bytes.len());
    package.extend_from_slice(OCTAZIP_MAGIC);
    package.push(flags);
    package.extend_from_slice(&crc.to_be_bytes());
    package.extend_from_slice(&final_bytes);

    Ok(package)
}

/// Unpacks a .octazip package back into original raw payload bytes
pub fn unpack_octazip(package: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    if package.len() < 11 || &package[0..8] != OCTAZIP_MAGIC {
        return Err("Invalid .octazip format or header corrupted".to_string());
    }

    let flags = package[8];
    let encrypted_flag = (flags >> 1) & 1;
    let brotli_flag = flags & 1;

    let expected_crc = u16::from_be_bytes([package[9], package[10]]);
    let compressed_data = &package[11..];

    let actual_crc = crc16::State::<crc16::XMODEM>::calculate(compressed_data);
    if actual_crc != expected_crc {
        return Err("CRC-16 integrity checksum failed on .octazip".to_string());
    }

    let decompressed = if brotli_flag == 1 {
        let mut out = Vec::new();
        let mut reader = brotli::Decompressor::new(compressed_data, 4096);
        std::io::copy(&mut reader, &mut out)
            .map_err(|e| format!("Brotli decompress error: {}", e))?;
        out
    } else {
        compressed_data.to_vec()
    };

    if encrypted_flag == 1 {
        if passphrase.trim().is_empty() {
            return Err("This .octazip file is encrypted. Passphrase required.".to_string());
        }
        decrypt_payload(&decompressed, passphrase)
    } else {
        Ok(decompressed)
    }
}
