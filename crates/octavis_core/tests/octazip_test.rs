#[test]
fn test_octazip_binary_roundtrip() {
    let original = b"OctaZip: High-efficiency binary archive format (.ozip) for large files!";
    let pass = "my-secret-key-123";

    let archive = octavis_core::octazip::encode_octazip(original, pass).unwrap();
    assert_eq!(&archive[0..4], b"OZIP");

    let recovered = octavis_core::octazip::decode_octazip(&archive, pass).unwrap();
    assert_eq!(&original[..], &recovered[..]);
}
