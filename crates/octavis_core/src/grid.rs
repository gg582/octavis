pub const RADIUS: i32 = 60;
pub const TOTAL_CELLS: usize = 10621; // 3 * 60 * 59 + 1
pub const RHOMBUS_CELLS: usize = 3538; // 3 * 3538 = 10614
pub const ANCHOR_CELLS: usize = 7;
pub const DATA_CELLS: usize = 7880;
pub const HEADER_CELLS: usize = 60;
pub const LINE_PARITY_CELLS: usize = 851;
pub const BLOCK_ECC_CELLS: usize = 1373;
pub const CALIB_CELLS: usize = 510;

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub struct AxialCoord {
    pub q: i32,
    pub r: i32,
}

impl AxialCoord {
    pub const fn new(q: i32, r: i32) -> Self {
        Self { q, r }
    }

    pub fn is_in_hexagon(&self, n: i32) -> bool {
        let q = self.q;
        let r = self.r;
        let s = -q - r;
        q.abs() < n && r.abs() < n && s.abs() < n
    }
}

pub fn generate_all_hex_coords() -> Vec<AxialCoord> {
    let mut coords = Vec::with_capacity(TOTAL_CELLS);
    let n = RADIUS;
    for q in -(n - 1)..(n) {
        let r1 = (-n + 1).max(-q - n + 1);
        let r2 = (n - 1).min(-q + n - 1);
        for r in r1..=r2 {
            coords.push(AxialCoord::new(q, r));
        }
    }
    coords
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_count() {
        let coords = generate_all_hex_coords();
        assert_eq!(coords.len(), TOTAL_CELLS);
    }
}
