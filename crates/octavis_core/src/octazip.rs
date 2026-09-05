use crate::crypto::{decrypt_payload, encrypt_payload};
use std::io::Write;

pub const OCTAZIP_MAGIC: &[u8; 4] = b"OZIP";

/// Encodes binary payload into standalone binary archive format (.ozip).
/// Pipeline: [ChaCha20-Poly1305 Encrypt if passphrase] -> [Brotli Compression] -> [CRC16 + Flags] -> Binary Envelope
pub fn encode_octazip(payload: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
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

    // 3. Binary envelope: [Magic "OZIP" (4B)] + [Flags (1B): (enc << 1) | brotli] + [CRC16 (2B)] + [Payload (NB)]
    let crc = crc16::State::<crc16::XMODEM>::calculate(&final_bytes);
    let flags = (encrypted_flag << 1) | brotli_flag;

    let mut envelope = Vec::with_capacity(7 + final_bytes.len());
    envelope.extend_from_slice(OCTAZIP_MAGIC);
    envelope.push(flags);
    envelope.extend_from_slice(&crc.to_be_bytes());
    envelope.extend_from_slice(&final_bytes);

    Ok(envelope)
}

/// Decodes an OctaZip binary archive into raw payload bytes.
pub fn decode_octazip(envelope: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    if envelope.len() < 7 || &envelope[0..4] != OCTAZIP_MAGIC {
        return Err("Invalid OctaZip binary archive header".to_string());
    }

    let flags = envelope[4];
    let encrypted_flag = (flags >> 1) & 1;
    let brotli_flag = flags & 1;

    let expected_crc = u16::from_be_bytes([envelope[5], envelope[6]]);
    let compressed_data = &envelope[7..];

    let actual_crc = crc16::State::<crc16::XMODEM>::calculate(compressed_data);
    if actual_crc != expected_crc {
        return Err("OctaZip CRC-16 checksum verification failed".to_string());
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
            return Err("OctaZip archive is encrypted. Passphrase required.".to_string());
        }
        decrypt_payload(&decompressed, passphrase)
    } else {
        Ok(decompressed)
    }
}
