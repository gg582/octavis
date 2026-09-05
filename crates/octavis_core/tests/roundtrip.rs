use octavis_core::OctaVisCodec;

#[test]
fn test_roundtrip_encode_decode() {
    let codec = OctaVisCodec::new();
    let original = b"Hello, OctaVis optical transmission protocol v1.0!";

    let (is_brotli, payload) = codec.compress_native(original);

    let encoded = codec.encode_frame_native(&payload, 0, 1, is_brotli).unwrap();
    assert_eq!(encoded.len(), 10621);

    let meta = codec.decode_frame_meta_native(&encoded).unwrap();

    assert_eq!(is_brotli, meta.is_brotli);
    assert_eq!(meta.frame_idx, 0);
    assert_eq!(meta.total_frames, 1);
    assert_eq!(&payload[..], &meta.payload[..payload.len()]);
}
