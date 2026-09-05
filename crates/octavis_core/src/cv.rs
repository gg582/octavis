#[derive(Clone, Debug)]
pub struct CornerPoint {
    pub x: f64,
    pub y: f64,
}

// Map axial hex coord (q, r) to unit canvas coordinates centered at (0, 0)
pub fn hex_to_pixel(q: i32, r: i32, cell_radius: f64) -> (f64, f64) {
    let sqrt3 = 3.0f64.sqrt();
    let x = cell_radius * (sqrt3 * q as f64 + sqrt3 / 2.0 * r as f64);
    let y = cell_radius * (1.5 * r as f64);
    (x, y)
}

// Find hexagon corners in an image buffer for perspective lock-on
pub fn detect_magenta_preamble(
    rgba: &[u8],
    width: u32,
    height: u32,
) -> Option<[CornerPoint; 6]> {
    let mut min_x = width as f64;
    let mut max_x = 0.0f64;
    let mut min_y = height as f64;
    let mut max_y = 0.0f64;
    let mut count = 0usize;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            let r = rgba[idx];
            let g = rgba[idx + 1];
            let b = rgba[idx + 2];

            // Magenta detection: high R and B, low G
            if r > 160 && b > 160 && g < 80 {
                let fx = x as f64;
                let fy = y as f64;
                if fx < min_x { min_x = fx; }
                if fx > max_x { max_x = fx; }
                if fy < min_y { min_y = fy; }
                if fy > max_y { max_y = fy; }
                count += 1;
            }
        }
    }

    if count < 500 || max_x <= min_x || max_y <= min_y {
        return None;
    }

    let cx = (min_x + max_x) / 2.0;
    let cy = (min_y + max_y) / 2.0;
    let rx = (max_x - min_x) / 2.0;
    let ry = (max_y - min_y) / 2.0;

    // Approximate 6 hexagon vertices
    let mut corners = Vec::with_capacity(6);
    for i in 0..6 {
        let angle = (i as f64 * std::f64::consts::PI / 3.0) - std::f64::consts::PI / 6.0;
        corners.push(CornerPoint {
            x: cx + rx * angle.cos(),
            y: cy + ry * angle.sin(),
        });
    }

    Some([
        corners[0].clone(),
        corners[1].clone(),
        corners[2].clone(),
        corners[3].clone(),
        corners[4].clone(),
        corners[5].clone(),
    ])
}
