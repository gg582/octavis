pub mod color;
pub mod crypto;
pub mod cv;
pub mod ecc;
pub mod grid;
pub mod layout;
pub mod file_envelope;
pub mod octazip;

use wasm_bindgen::prelude::*;
use color::ColorState;
use grid::{AxialCoord, TOTAL_CELLS};
use layout::GridSlotPartition;
use std::io::Write;

pub struct DecodedFrameMeta {
    pub is_brotli: bool,
    pub frame_idx: u16,
    pub total_frames: u16,
    pub payload: Vec<u8>,
}

#[wasm_bindgen]
pub struct OctaVisCodec {
    partition: GridSlotPartition,
}

impl OctaVisCodec {
    pub fn compress_native(&self, input: &[u8]) -> (bool, Vec<u8>) {
        let mut writer = brotli::CompressorWriter::new(Vec::new(), 4096, 9, 22);
        if writer.write_all(input).is_ok() {
            let compressed = writer.into_inner();
            if compressed.len() < input.len() {
                return (true, compressed);
            }
        }
        (false, input.to_vec())
    }

    pub fn encode_frame_native(
        &self,
        payload: &[u8],
        frame_idx: u16,
        total_frames: u16,
        is_brotli: bool,
    ) -> Result<Vec<u8>, String> {
        let mut cell_colors = vec![ColorState::White as u8; TOTAL_CELLS];
        let all_coords = grid::generate_all_hex_coords();
        let coord_to_idx: std::collections::HashMap<AxialCoord, usize> = all_coords
            .iter()
            .enumerate()
            .map(|(i, &c)| (c, i))
            .collect();

        // 1. Center Anchor 7 cells
        if let Some(&idx) = coord_to_idx.get(&self.partition.anchor_center) {
            cell_colors[idx] = ColorState::Black as u8;
        }
        let ring_color = if is_brotli { ColorState::Black } else { ColorState::White };
        for ring_c in &self.partition.anchor_ring {
            if let Some(&idx) = coord_to_idx.get(ring_c) {
                cell_colors[idx] = ring_color as u8;
            }
        }

        // 2. Rotation markers
        for m in &self.partition.rotation_markers {
            if let Some(&idx) = coord_to_idx.get(m) {
                cell_colors[idx] = ColorState::Magenta as u8;
            }
        }

        // 3. Calibration palette
        for (i, p) in self.partition.calib_palette.iter().enumerate() {
            if let Some(&idx) = coord_to_idx.get(p) {
                cell_colors[idx] = (i % 8) as u8;
            }
        }

        // 4. Header: 60 cells (180 bits)
        let crc = crc16::State::<crc16::XMODEM>::calculate(payload);
        let mut header_bytes = Vec::with_capacity(12);
        header_bytes.extend_from_slice(b"OV");
        header_bytes.push(0x01);
        header_bytes.extend_from_slice(&frame_idx.to_be_bytes());
        header_bytes.extend_from_slice(&total_frames.to_be_bytes());
        header_bytes.extend_from_slice(&(payload.len() as u16).to_be_bytes());
        header_bytes.extend_from_slice(&crc.to_be_bytes());

        let mut header_symbols = Vec::new();
        let mut bit_buf = 0u64;
        let mut bit_count = 0usize;
        for &b in &header_bytes {
            bit_buf = (bit_buf << 8) | (b as u64);
            bit_count += 8;
            while bit_count >= 3 {
                bit_count -= 3;
                header_symbols.push(((bit_buf >> bit_count) & 0b111) as u8);
            }
        }
        if bit_count > 0 {
            header_symbols.push(((bit_buf << (3 - bit_count)) & 0b111) as u8);
        }

        for (i, &sym) in header_symbols.iter().enumerate().take(self.partition.header_slots.len()) {
            let slot = self.partition.header_slots[i];
            if let Some(&idx) = coord_to_idx.get(&slot) {
                cell_colors[idx] = sym;
            }
        }

        // 5. Data cells: 7880 cells
        let mut data_symbols = Vec::with_capacity(self.partition.data_slots.len());
        let mut d_bit_buf = 0u64;
        let mut d_bit_count = 0usize;
        for &b in payload {
            d_bit_buf = (d_bit_buf << 8) | (b as u64);
            d_bit_count += 8;
            while d_bit_count >= 3 {
                d_bit_count -= 3;
                data_symbols.push(((d_bit_buf >> d_bit_count) & 0b111) as u8);
            }
        }
        if d_bit_count > 0 {
            data_symbols.push(((d_bit_buf << (3 - d_bit_count)) & 0b111) as u8);
        }
        while data_symbols.len() < self.partition.data_slots.len() {
            data_symbols.push(ColorState::White as u8);
        }

        for (i, &slot) in self.partition.data_slots.iter().enumerate() {
            if let Some(&idx) = coord_to_idx.get(&slot) {
                cell_colors[idx] = data_symbols[i];
            }
        }

        // 6. Line parity (851 cells)
        let parity_symbols = ecc::compute_line_parity(&data_symbols);
        for (i, &slot) in self.partition.line_parity_slots.iter().enumerate() {
            if let Some(&idx) = coord_to_idx.get(&slot) {
                cell_colors[idx] = parity_symbols[i];
            }
        }

        // 7. Block ECC (1373 cells)
        let ecc_codec = ecc::CodecECC::new().map_err(|e| e.to_string())?;
        if let Ok(ecc_bytes) = ecc_codec.encode(payload) {
            let mut ecc_symbols = Vec::new();
            let mut e_buf = 0u64;
            let mut e_cnt = 0;
            for &b in &ecc_bytes {
                e_buf = (e_buf << 8) | (b as u64);
                e_cnt += 8;
                while e_cnt >= 3 {
                    e_cnt -= 3;
                    ecc_symbols.push(((e_buf >> e_cnt) & 0b111) as u8);
                }
            }
            while ecc_symbols.len() < self.partition.block_ecc_slots.len() {
                ecc_symbols.push(0);
            }
            for (i, &slot) in self.partition.block_ecc_slots.iter().enumerate() {
                if let Some(&idx) = coord_to_idx.get(&slot) {
                    cell_colors[idx] = ecc_symbols[i];
                }
            }
        }

        Ok(cell_colors)
    }

    pub fn decode_frame_meta_native(&self, cell_colors: &[u8]) -> Result<DecodedFrameMeta, String> {
        if cell_colors.len() != TOTAL_CELLS {
            return Err("Invalid cell length".to_string());
        }

        let all_coords = grid::generate_all_hex_coords();
        let coord_to_idx: std::collections::HashMap<AxialCoord, usize> = all_coords
            .iter()
            .enumerate()
            .map(|(i, &c)| (c, i))
            .collect();

        // 1. Brotli ring check
        let mut black_count = 0;
        for ring_c in &self.partition.anchor_ring {
            if let Some(&idx) = coord_to_idx.get(ring_c) {
                if cell_colors[idx] == ColorState::Black as u8 {
                    black_count += 1;
                }
            }
        }
        let is_brotli = black_count >= 4;

        // 2. Read Header
        let mut h_buf = 0u64;
        let mut h_cnt = 0usize;
        let mut header_bytes = Vec::new();
        for &slot in &self.partition.header_slots {
            if let Some(&idx) = coord_to_idx.get(&slot) {
                let sym = cell_colors[idx] & 0b111;
                h_buf = (h_buf << 3) | (sym as u64);
                h_cnt += 3;
                while h_cnt >= 8 {
                    h_cnt -= 8;
                    header_bytes.push(((h_buf >> h_cnt) & 0xFF) as u8);
                }
            }
        }

        let mut frame_idx = 0u16;
        let mut total_frames = 1u16;
        let mut payload_len = 2940usize;

        if header_bytes.len() >= 9 && &header_bytes[0..2] == b"OV" {
            frame_idx = u16::from_be_bytes([header_bytes[3], header_bytes[4]]);
            total_frames = u16::from_be_bytes([header_bytes[5], header_bytes[6]]);
            let len = u16::from_be_bytes([header_bytes[7], header_bytes[8]]) as usize;
            if len <= 2955 {
                payload_len = len;
            }
        }

        // 3. Extract payload
        let mut data_buf = 0u64;
        let mut data_cnt = 0usize;
        let mut payload = Vec::with_capacity(payload_len);

        for &slot in &self.partition.data_slots {
            if let Some(&idx) = coord_to_idx.get(&slot) {
                let sym = cell_colors[idx] & 0b111;
                data_buf = (data_buf << 3) | (sym as u64);
                data_cnt += 3;
                while data_cnt >= 8 {
                    data_cnt -= 8;
                    if payload.len() < payload_len {
                        payload.push(((data_buf >> data_cnt) & 0xFF) as u8);
                    }
                }
            }
        }

        Ok(DecodedFrameMeta {
            is_brotli,
            frame_idx,
            total_frames,
            payload,
        })
    }

    pub fn decode_rgba_frame_native(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
    ) -> Result<DecodedFrameMeta, String> {
        let palette = [
            color::ColorState::Black.reference_rgb(),
            color::ColorState::Blue.reference_rgb(),
            color::ColorState::Green.reference_rgb(),
            color::ColorState::Cyan.reference_rgb(),
            color::ColorState::Red.reference_rgb(),
            color::ColorState::Magenta.reference_rgb(),
            color::ColorState::Yellow.reference_rgb(),
            color::ColorState::White.reference_rgb(),
        ];

        // 1. Detect grid bounding quad or use centered fallback
        let corners = match cv::detect_grid_corners(rgba, width, height) {
            Some(quad) => quad,
            None => {
                // Centered fallback matching hexagon aspect ratio 204.38 : 177.0
                let w = width as f64;
                let h = height as f64;
                let cx = w / 2.0;
                let cy = h / 2.0;
                let aspect = 102.19099764656376 / 88.5; // ~1.1547
                let avail_w = w * 0.9;
                let avail_h = h * 0.9;
                let (box_w, box_h) = if avail_w / avail_h > aspect {
                    (avail_h * aspect, avail_h)
                } else {
                    (avail_w, avail_w / aspect)
                };
                let min_x = cx - box_w / 2.0;
                let max_x = cx + box_w / 2.0;
                let min_y = cy - box_h / 2.0;
                let max_y = cy + box_h / 2.0;
                [
                    cv::Point2D::new(min_x, min_y),
                    cv::Point2D::new(max_x, min_y),
                    cv::Point2D::new(max_x, max_y),
                    cv::Point2D::new(min_x, max_y),
                ]
            }
        };

        // 2. Sample 10,621 cell colors via homography
        let cell_colors = cv::sample_warped_grid(rgba, width, height, &corners, &palette);

        // 3. Decode frame metadata & payload
        self.decode_frame_meta_native(&cell_colors)
    }
}

#[wasm_bindgen]
impl OctaVisCodec {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            partition: GridSlotPartition::compute(),
        }
    }

    /// Packs raw binary data into a standalone .octazip binary package
    pub fn pack_octazip(&self, payload: &[u8], passphrase: &str) -> Result<js_sys::Uint8Array, JsValue> {
        let package = octazip::pack_octazip(payload, passphrase).map_err(|e| JsValue::from_str(&e))?;
        Ok(js_sys::Uint8Array::from(&package[..]))
    }

    /// Unpacks a .octazip binary package into original data
    pub fn unpack_octazip(&self, package_bytes: &[u8], passphrase: &str) -> Result<js_sys::Uint8Array, JsValue> {
        let unpacked = octazip::unpack_octazip(package_bytes, passphrase).map_err(|e| JsValue::from_str(&e))?;
        Ok(js_sys::Uint8Array::from(&unpacked[..]))
    }

    pub fn get_preamble_rgb(&self, passphrase: &str) -> js_sys::Uint8Array {
        let rgb = color::derive_preamble_rgb(passphrase);
        js_sys::Uint8Array::from(&rgb[..])
    }

    pub fn encrypt(&self, payload: &[u8], passphrase: &str) -> Result<js_sys::Uint8Array, JsValue> {
        let encrypted = crypto::encrypt_payload(payload, passphrase).map_err(|e| JsValue::from_str(&e))?;
        Ok(js_sys::Uint8Array::from(&encrypted[..]))
    }

    pub fn decrypt(&self, data: &[u8], passphrase: &str) -> Result<js_sys::Uint8Array, JsValue> {
        let decrypted = crypto::decrypt_payload(data, passphrase).map_err(|e| JsValue::from_str(&e))?;
        Ok(js_sys::Uint8Array::from(&decrypted[..]))
    }

    pub fn compress_if_beneficial(&self, input: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
        let (is_brotli, payload) = self.compress_native(input);
        let mut out = Vec::with_capacity(payload.len() + 1);
        out.push(if is_brotli { 1 } else { 0 });
        out.extend_from_slice(&payload);
        Ok(js_sys::Uint8Array::from(&out[..]))
    }

    pub fn decompress_brotli(&self, input: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
        let mut decompressed = Vec::new();
        let mut reader = brotli::Decompressor::new(input, 4096);
        std::io::copy(&mut reader, &mut decompressed)
            .map_err(|e| JsValue::from_str(&format!("Brotli error: {}", e)))?;
        Ok(js_sys::Uint8Array::from(&decompressed[..]))
    }

    pub fn encode_frame(
        &self,
        payload: &[u8],
        frame_idx: u16,
        total_frames: u16,
        is_brotli: bool,
    ) -> Result<js_sys::Uint8Array, JsValue> {
        let cells = self
            .encode_frame_native(payload, frame_idx, total_frames, is_brotli)
            .map_err(|e| JsValue::from_str(&e))?;
        Ok(js_sys::Uint8Array::from(&cells[..]))
    }

    pub fn decode_frame(&self, cell_colors: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
        let meta = self
            .decode_frame_meta_native(cell_colors)
            .map_err(|e| JsValue::from_str(&e))?;

        let mut result = Vec::with_capacity(meta.payload.len() + 5);
        result.push(if meta.is_brotli { 1 } else { 0 });
        result.extend_from_slice(&meta.frame_idx.to_be_bytes());
        result.extend_from_slice(&meta.total_frames.to_be_bytes());
        result.extend_from_slice(&meta.payload);
        Ok(js_sys::Uint8Array::from(&result[..]))
    }

    
    pub fn pack_file_envelope(&self, filename: &str, data: &[u8]) -> js_sys::Uint8Array {
        let envelope = file_envelope::pack_file_envelope(filename, data);
        js_sys::Uint8Array::from(&envelope[..])
    }

    pub fn unpack_file_envelope(&self, envelope: &[u8]) -> js_sys::Uint8Array {
        let (name, data) = file_envelope::unpack_file_envelope(envelope);
        let name_bytes = name.as_bytes();
        let name_len = name_bytes.len().min(255) as u8;
        let mut out = Vec::with_capacity(1 + name_len as usize + data.len());
        out.push(name_len);
        out.extend_from_slice(&name_bytes[..name_len as usize]);
        out.extend_from_slice(&data);
        js_sys::Uint8Array::from(&out[..])
    }


    /// Decodes an image frame directly from RGBA pixel buffer using perspective warp
    pub fn decode_rgba_frame(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
    ) -> Result<js_sys::Uint8Array, JsValue> {
        let meta = self
            .decode_rgba_frame_native(rgba, width, height)
            .map_err(|e| JsValue::from_str(&e))?;

        let mut result = Vec::with_capacity(meta.payload.len() + 5);
        result.push(if meta.is_brotli { 1 } else { 0 });
        result.extend_from_slice(&meta.frame_idx.to_be_bytes());
        result.extend_from_slice(&meta.total_frames.to_be_bytes());
        result.extend_from_slice(&meta.payload);
        Ok(js_sys::Uint8Array::from(&result[..]))
    }

    pub fn get_all_coords(&self) -> js_sys::Int32Array {
        let coords = grid::generate_all_hex_coords();
        let mut flat = Vec::with_capacity(coords.len() * 2);
        for c in coords {
            flat.push(c.q);
            flat.push(c.r);
        }
        js_sys::Int32Array::from(&flat[..])
    }
}
