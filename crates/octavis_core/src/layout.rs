use crate::grid::{generate_all_hex_coords, AxialCoord};
use std::collections::HashSet;

pub const ANCHOR_CENTER: AxialCoord = AxialCoord::new(0, 0);
pub const ANCHOR_RING: [AxialCoord; 6] = [
    AxialCoord::new(1, 0),
    AxialCoord::new(1, -1),
    AxialCoord::new(0, -1),
    AxialCoord::new(-1, 0),
    AxialCoord::new(-1, 1),
    AxialCoord::new(0, 1),
];

pub struct GridSlotPartition {
    pub anchor_center: AxialCoord,
    pub anchor_ring: Vec<AxialCoord>,      // 6 cells
    pub rotation_markers: Vec<AxialCoord>, // Orientation markers at corner of Rhombus A
    pub calib_palette: Vec<AxialCoord>,    // 8-color calibration samples along rhombus seams
    pub header_slots: Vec<AxialCoord>,     // 60 cells (180 bits)
    pub line_parity_slots: Vec<AxialCoord>,// 851 cells
    pub block_ecc_slots: Vec<AxialCoord>,  // 1373 cells
    pub data_slots: Vec<AxialCoord>,       // 7880 cells
}

impl GridSlotPartition {
    pub fn compute() -> Self {
        let all_coords = generate_all_hex_coords();
        let mut reserved = HashSet::new();

        // 1. Anchor 7 cells
        reserved.insert(ANCHOR_CENTER);
        for ring in ANCHOR_RING.iter() {
            reserved.insert(*ring);
        }

        // 2. Calibration & Header (510 total: 60 header + markers & palette)
        let mut rotation_markers = Vec::new();
        let markers = [
            AxialCoord::new(59, -59),
            AxialCoord::new(58, -58),
            AxialCoord::new(59, -58),
        ];
        for m in markers {
            reserved.insert(m);
            rotation_markers.push(m);
        }

        // Calibration palette along axes q=0, r=0, q+r=0
        let mut calib_palette = Vec::new();
        let mut header_slots = Vec::new();

        let mut calib_and_header_candidates = Vec::new();
        for &coord in all_coords.iter() {
            if reserved.contains(&coord) {
                continue;
            }
            if coord.q == 0 || coord.r == 0 || (coord.q + coord.r) == 0 {
                calib_and_header_candidates.push(coord);
            }
        }

        for c in calib_and_header_candidates.iter().take(60) {
            reserved.insert(*c);
            header_slots.push(*c);
        }
        for c in calib_and_header_candidates.iter().skip(60).take(510 - 60 - rotation_markers.len()) {
            reserved.insert(*c);
            calib_palette.push(*c);
        }

        // Collect remaining cells
        let mut remaining = Vec::new();
        for &coord in all_coords.iter() {
            if !reserved.contains(&coord) {
                remaining.push(coord);
            }
        }

        let line_parity_slots = remaining[..851].to_vec();
        let block_ecc_slots = remaining[851..851 + 1373].to_vec();
        let data_slots = remaining[851 + 1373..851 + 1373 + 7880].to_vec();

        Self {
            anchor_center: ANCHOR_CENTER,
            anchor_ring: ANCHOR_RING.to_vec(),
            rotation_markers,
            calib_palette,
            header_slots,
            line_parity_slots,
            block_ecc_slots,
            data_slots,
        }
    }
}
