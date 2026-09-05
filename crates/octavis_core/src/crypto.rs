use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use argon2::Argon2;

pub fn derive_key(passphrase: &str, salt: &[u8; 16]) -> [u8; 32] {
    let mut key = [0u8; 32];
    let argon2 = Argon2::default();
    let _ = argon2.hash_password_into(passphrase.as_bytes(), salt, &mut key);
    key
}

/// Encrypts payload with ChaCha20-Poly1305.
/// Output format: [16 bytes salt] + [12 bytes nonce] + [ciphertext + 16 bytes tag]
pub fn encrypt_payload(payload: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    getrandom::getrandom(&mut salt).map_err(|e| e.to_string())?;
    getrandom::getrandom(&mut nonce_bytes).map_err(|e| e.to_string())?;

    let key = derive_key(passphrase, &salt);
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, payload).map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(16 + 12 + ciphertext.len());
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypts payload with ChaCha20-Poly1305.
pub fn decrypt_payload(data: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    if data.len() < 16 + 12 + 16 {
        return Err("Invalid encrypted data length".to_string());
    }

    let salt: [u8; 16] = data[0..16].try_into().unwrap();
    let nonce_bytes = &data[16..28];
    let ciphertext = &data[28..];

    let key = derive_key(passphrase, &salt);
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher.decrypt(nonce, ciphertext).map_err(|_| "복호화 실패: 잘못된 비밀번호이거나 데이터가 변조되었습니다.".to_string())
}
