#[test]
fn test_octazip_package_roundtrip() {
    let original = b"OctaZip: High-efficiency binary package format (.octazip)!";
    let pass = "my-secret-key-123";

    let package = octavis_core::octazip::pack_octazip(original, pass).unwrap();
    assert_eq!(&package[0..8], b"OCTAZIP1");

    let recovered = octavis_core::octazip::unpack_octazip(&package, pass).unwrap();
    assert_eq!(&original[..], &recovered[..]);
}
