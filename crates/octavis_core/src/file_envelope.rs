/// File envelope header packing original filename and binary data
/// Envelope layout:
/// [Magic "OVFILE" (6B)] + [Filename Len (1B)] + [Filename (NB)] + [Raw Payload]

pub fn pack_file_envelope(filename: &str, data: &[u8]) -> Vec<u8> {
    let name_bytes = filename.as_bytes();
    let name_len = name_bytes.len().min(255) as u8;
    
    let mut out = Vec::with_capacity(7 + name_len as usize + data.len());
    out.extend_from_slice(b"OVFILE");
    out.push(name_len);
    out.extend_from_slice(&name_bytes[..name_len as usize]);
    out.extend_from_slice(data);
    out
}

pub fn unpack_file_envelope(envelope: &[u8]) -> (String, Vec<u8>) {
    if envelope.len() >= 7 && &envelope[0..6] == b"OVFILE" {
        let name_len = envelope[6] as usize;
        if envelope.len() >= 7 + name_len {
            if let Ok(name) = std::str::from_utf8(&envelope[7..7 + name_len]) {
                let payload = envelope[7 + name_len..].to_vec();
                return (name.to_string(), payload);
            }
        }
    }
    ("restored_data.bin".to_string(), envelope.to_vec())
}
