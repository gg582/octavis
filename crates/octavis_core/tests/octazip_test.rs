#[test]
fn test_octazip_roundtrip() {
    let original = b"OctaZip: High-density armor text format for censorship-resistant communication!";
    let pass = "my-secret-key-123";

    let armor = octavis_core::octazip::encode_octazip(original, pass).unwrap();
    assert!(armor.contains("-----BEGIN OCTAZIP V1.0-----"));
    assert!(armor.contains("-----END OCTAZIP-----"));

    let recovered = octavis_core::octazip::decode_octazip(&armor, pass).unwrap();
    assert_eq!(&original[..], &recovered[..]);
}
