#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum ColorState {
    Black = 0b000,
    Blue = 0b001,
    Green = 0b010,
    Cyan = 0b011,
    Red = 0b100,
    Magenta = 0b101,
    Yellow = 0b110,
    White = 0b111,
}

impl ColorState {
    pub const ALL: [ColorState; 8] = [
        ColorState::Black,
        ColorState::Blue,
        ColorState::Green,
        ColorState::Cyan,
        ColorState::Red,
        ColorState::Magenta,
        ColorState::Yellow,
        ColorState::White,
    ];

    pub fn to_bits(self) -> u8 {
        self as u8
    }

    pub fn from_bits(val: u8) -> Self {
        match val & 0b111 {
            0b000 => ColorState::Black,
            0b001 => ColorState::Blue,
            0b010 => ColorState::Green,
            0b011 => ColorState::Cyan,
            0b100 => ColorState::Red,
            0b101 => ColorState::Magenta,
            0b110 => ColorState::Yellow,
            0b111 => ColorState::White,
            _ => unreachable!(),
        }
    }

    pub fn reference_rgb(self) -> [u8; 3] {
        match self {
            ColorState::Black => [0, 0, 0],
            ColorState::Blue => [0, 0, 255],
            ColorState::Green => [0, 255, 0],
            ColorState::Cyan => [0, 255, 255],
            ColorState::Red => [255, 0, 0],
            ColorState::Magenta => [255, 0, 255],
            ColorState::Yellow => [255, 255, 0],
            ColorState::White => [255, 255, 255],
        }
    }

    pub fn classify_rgb(rgb: [u8; 3], palette: &[[u8; 3]; 8]) -> Self {
        let mut min_dist = u32::MAX;
        let mut best_idx = 0;
        for (i, p) in palette.iter().enumerate() {
            let r_bar = (rgb[0] as i64 + p[0] as i64) / 2;
            let dr = rgb[0] as i64 - p[0] as i64;
            let dg = rgb[1] as i64 - p[1] as i64;
            let db = rgb[2] as i64 - p[2] as i64;

            let dist = (((512 + r_bar) * dr * dr) >> 8)
                + 4 * dg * dg
                + (((767 - r_bar) * db * db) >> 8);

            if (dist as u32) < min_dist {
                min_dist = dist as u32;
                best_idx = i;
            }
        }
        Self::from_bits(best_idx as u8)
    }
}

// Derive a polymorphic chameleon preamble color [R, G, B] from passphrase
pub fn derive_preamble_rgb(passphrase: &str) -> [u8; 3] {
    if passphrase.trim().is_empty() {
        return [255, 0, 255]; // default Magenta
    }
    let mut h: u32 = 0x811c9dc5;
    for &b in passphrase.as_bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x01000193);
    }
    // Generate saturated high-contrast colors (avoiding pure black/white)
    let r = (((h >> 16) & 0xFF) as u8).max(50);
    let g = (((h >> 8) & 0xFF) as u8).max(50);
    let b = ((h & 0xFF) as u8).max(50);
    [r, g, b]
}
