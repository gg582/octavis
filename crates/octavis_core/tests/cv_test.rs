use octavis_core::cv::{Point2D, Homography};
use octavis_core::OctaVisCodec;
use octavis_core::grid::generate_all_hex_coords;

#[test]
fn test_homography_identity() {
    let src = [
        Point2D::new(-1.0, -1.0),
        Point2D::new(1.0, -1.0),
        Point2D::new(1.0, 1.0),
        Point2D::new(-1.0, 1.0),
    ];
    let dst = [
        Point2D::new(10.0, 10.0),
        Point2D::new(90.0, 10.0),
        Point2D::new(90.0, 90.0),
        Point2D::new(10.0, 90.0),
    ];

    let h = Homography::from_quads(&src, &dst).expect("Homography failed");
    for i in 0..4 {
        let p = h.transform(&src[i]);
        assert!((p.x - dst[i].x).abs() < 1e-4, "x mismatch at {}: got {}, expected {}", i, p.x, dst[i].x);
        assert!((p.y - dst[i].y).abs() < 1e-4, "y mismatch at {}: got {}, expected {}", i, p.y, dst[i].y);
    }
}

#[test]
fn test_render_and_sample_roundtrip() {
    let codec = OctaVisCodec::new();
    let data = b"Test roundtrip payload with scale invariance";
    let encoded = codec.encode_frame_native(data, 0, 1, false).unwrap();

    let coords = generate_all_hex_coords();
    let r = 6.0f64;
    let quiet_zone = 4.0 * r * 3.0f64.sqrt();
    let max_r = 60.0 * r * 3.0f64.sqrt() + quiet_zone;
    let size = (max_r * 2.0).ceil() as u32;
    let cx = size as f64 / 2.0;
    let cy = size as f64 / 2.0;
    let sqrt3 = 3.0f64.sqrt();

    let mut rgba = vec![255u8; (size * size * 4) as usize];
    let palette = [
        [0, 0, 0],       // Black
        [0, 0, 255],     // Blue
        [0, 255, 0],     // Green
        [0, 255, 255],   // Cyan
        [255, 0, 0],     // Red
        [255, 0, 255],   // Magenta
        [255, 255, 0],   // Yellow
        [255, 255, 255], // White
    ];

    for (i, c) in coords.iter().enumerate() {
        let x = (cx + r * (sqrt3 * c.q as f64 + (sqrt3 / 2.0) * c.r as f64)).round() as i32;
        let y = (cy + r * (1.5 * c.r as f64)).round() as i32;
        let color = encoded[i] as usize;
        let rgb = palette[color];

        for dy in -2..=2 {
            for dx in -2..=2 {
                let px = x + dx;
                let py = y + dy;
                if px >= 0 && px < size as i32 && py >= 0 && py < size as i32 {
                    let idx = ((py as u32 * size + px as u32) * 4) as usize;
                    rgba[idx] = rgb[0];
                    rgba[idx + 1] = rgb[1];
                    rgba[idx + 2] = rgb[2];
                    rgba[idx + 3] = 255;
                }
            }
        }
    }

    let decoded_res = codec.decode_rgba_frame_native(&rgba, size, size);
    assert!(decoded_res.is_ok(), "decode_rgba_frame failed: {:?}", decoded_res.err());
    let meta = decoded_res.unwrap();
    assert_eq!(&meta.payload[..data.len()], data);
}
