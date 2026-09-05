use crate::color::ColorState;
use crate::grid::{generate_all_hex_coords, TOTAL_CELLS};

#[derive(Clone, Debug, PartialEq)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

// 3x3 Homography Matrix for perspective transformation
#[derive(Clone, Debug)]
pub struct Homography {
    h: [f64; 9],
}

impl Homography {
    // Computes homography mapping source quad to destination quad (DLT algorithm)
    pub fn from_quads(src: &[Point2D; 4], dst: &[Point2D; 4]) -> Option<Self> {
        let mut a = [[0.0f64; 8]; 8];
        let mut b = [0.0f64; 8];

        for i in 0..4 {
            let sx = src[i].x;
            let sy = src[i].y;
            let dx = dst[i].x;
            let dy = dst[i].y;

            a[2 * i] = [sx, sy, 1.0, 0.0, 0.0, 0.0, -sx * dx, -sy * dx];
            b[2 * i] = dx;

            a[2 * i + 1] = [0.0, 0.0, 0.0, sx, sy, 1.0, -sx * dy, -sy * dy];
            b[2 * i + 1] = dy;
        }

        // Solve 8x8 linear system via Gaussian elimination
        let h_vec = solve_8x8(&mut a, &mut b)?;
        Some(Self {
            h: [
                h_vec[0], h_vec[1], h_vec[2],
                h_vec[3], h_vec[4], h_vec[5],
                h_vec[6], h_vec[7], 1.0,
            ],
        })
    }

    pub fn transform(&self, p: &Point2D) -> Point2D {
        let x = self.h[0] * p.x + self.h[1] * p.y + self.h[2];
        let y = self.h[3] * p.x + self.h[4] * p.y + self.h[5];
        let w = self.h[6] * p.x + self.h[7] * p.y + self.h[8];
        let w_inv = if w != 0.0 { 1.0 / w } else { 1.0 };
        Point2D::new(x * w_inv, y * w_inv)
    }
}

fn solve_8x8(a: &mut [[f64; 8]; 8], b: &mut [f64; 8]) -> Option<[f64; 8]> {
    let n = 8;
    for i in 0..n {
        let mut max_row = i;
        for k in (i + 1)..n {
            if a[k][i].abs() > a[max_row][i].abs() {
                max_row = k;
            }
        }
        if a[max_row][i].abs() < 1e-12 {
            return None;
        }
        a.swap(i, max_row);
        b.swap(i, max_row);

        for k in (i + 1)..n {
            let factor = a[k][i] / a[i][i];
            for j in i..n {
                a[k][j] -= factor * a[i][j];
            }
            b[k] -= factor * b[i];
        }
    }

    let mut x = [0.0f64; 8];
    for i in (0..n).rev() {
        let mut sum = b[i];
        for j in (i + 1)..n {
            sum -= a[i][j] * x[j];
        }
        x[i] = sum / a[i][i];
    }
    Some(x)
}

// Bounding box detection of the hexagonal grid in webcam/video frame
pub fn detect_grid_corners(
    rgba: &[u8],
    width: u32,
    height: u32,
) -> Option<[Point2D; 4]> {
    let mut min_x = width as f64;
    let mut max_x = 0.0f64;
    let mut min_y = height as f64;
    let mut max_y = 0.0f64;
    let mut count = 0usize;

    // Scan for saturated non-background pixels (OctaVis colored cells)
    for y in (0..height).step_by(2) {
        for x in (0..width).step_by(2) {
            let idx = ((y * width + x) * 4) as usize;
            let r = rgba[idx] as i32;
            let g = rgba[idx + 1] as i32;
            let b = rgba[idx + 2] as i32;

            // Color saturation check (exclude uniform white background or dark shadow)
            let max_c = r.max(g).max(b);
            let min_c = r.min(g).min(b);
            let diff = max_c - min_c;

            if diff > 50 || (r < 40 && g < 40 && b < 40) {
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

    if count < 200 || (max_x - min_x) < 50.0 || (max_y - min_y) < 50.0 {
        return None;
    }

    Some([
        Point2D::new(min_x, min_y),
        Point2D::new(max_x, min_y),
        Point2D::new(max_x, max_y),
        Point2D::new(min_x, max_y),
    ])
}

// Samples all 10,621 cell colors using homography perspective warp
pub fn sample_warped_grid(
    rgba: &[u8],
    width: u32,
    height: u32,
    corners: &[Point2D; 4],
    palette: &[[u8; 3]; 8],
) -> Vec<u8> {
    // Exact hexagon bounding box extents for Radius 60
    // min_x = -59.0 * sqrt(3) = -102.19099764656376, max_x = 102.19099764656376
    // min_y = -88.5, max_y = 88.5
    const BOUND_X: f64 = 102.19099764656376;
    const BOUND_Y: f64 = 88.5;

    let ideal_quad = [
        Point2D::new(-BOUND_X, -BOUND_Y), // Top-left
        Point2D::new(BOUND_X, -BOUND_Y),  // Top-right
        Point2D::new(BOUND_X, BOUND_Y),   // Bottom-right
        Point2D::new(-BOUND_X, BOUND_Y),  // Bottom-left
    ];

    let h = match Homography::from_quads(&ideal_quad, corners) {
        Some(mat) => mat,
        None => return vec![ColorState::White as u8; TOTAL_CELLS],
    };

    let all_coords = generate_all_hex_coords();
    let sqrt3 = 3.0f64.sqrt();

    let mut out = Vec::with_capacity(TOTAL_CELLS);
    for c in &all_coords {
        let u = sqrt3 * c.q as f64 + (sqrt3 / 2.0) * c.r as f64;
        let v = 1.5 * c.r as f64;
        let p = h.transform(&Point2D::new(u, v));

        let px = p.x.round() as i32;
        let py = p.y.round() as i32;

        if px >= 0 && px < width as i32 && py >= 0 && py < height as i32 {
            let idx = ((py as u32 * width + px as u32) * 4) as usize;
            let rgb = [rgba[idx], rgba[idx + 1], rgba[idx + 2]];
            out.push(ColorState::classify_rgb(rgb, palette) as u8);
        } else {
            out.push(ColorState::White as u8);
        }
    }
    out
}
