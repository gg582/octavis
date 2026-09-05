import { OctaVisCodec } from './wasm/octavis_core.js';

export interface DecodedFrameResult {
  isBrotli: boolean;
  frameIdx: number;
  totalFrames: number;
  payload: Uint8Array;
}

export class OctaVisDecoder {
  private codec: OctaVisCodec;
  private coords: Int32Array;

  constructor(codec: OctaVisCodec) {
    this.codec = codec;
    this.coords = codec.get_all_coords();
  }

  getCodec(): OctaVisCodec {
    return this.codec;
  }

  decodeFrameDirect(canvas: HTMLCanvasElement): DecodedFrameResult | null {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const cx = width / 2;
    const cy = height / 2;
    const totalCells = this.coords.length / 2;
    const cellColors = new Uint8Array(totalCells);

    const r_radius = width / (2 * 64 * Math.sqrt(3));
    const sqrt3 = Math.sqrt(3);

    const referenceColors: [number, number, number][] = [
      [0, 0, 0],       // Black
      [0, 0, 255],     // Blue
      [0, 255, 0],     // Green
      [0, 255, 255],   // Cyan
      [255, 0, 0],     // Red
      [255, 0, 255],   // Magenta
      [255, 255, 0],   // Yellow
      [255, 255, 255], // White
    ];

    for (let i = 0; i < totalCells; i++) {
      const q = this.coords[i * 2];
      const r_coord = this.coords[i * 2 + 1];

      const px = Math.round(cx + r_radius * (sqrt3 * q + (sqrt3 / 2) * r_coord));
      const py = Math.round(cy + r_radius * (1.5 * r_coord));

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * width + px) * 4;
        const cr = data[idx];
        const cg = data[idx + 1];
        const cb = data[idx + 2];

        let minD = Infinity;
        let bestColor = 7;
        for (let c = 0; c < 8; c++) {
          const ref = referenceColors[c];
          const dr = cr - ref[0];
          const dg = cg - ref[1];
          const db = cb - ref[2];
          const d = dr * dr + dg * dg + db * db;
          if (d < minD) {
            minD = d;
            bestColor = c;
          }
        }
        cellColors[i] = bestColor;
      } else {
        cellColors[i] = 7;
      }
    }

    try {
      const decoded = this.codec.decode_frame(cellColors);
      const isBrotli = decoded[0] === 1;
      const frameIdx = (decoded[1] << 8) | decoded[2];
      const totalFrames = (decoded[3] << 8) | decoded[4];
      const payload = new Uint8Array(decoded.slice(5));

      return {
        isBrotli,
        frameIdx,
        totalFrames,
        payload,
      };
    } catch {
      return null;
    }
  }

  decodeCanvas(canvas: HTMLCanvasElement): { isBrotli: boolean; payload: Uint8Array } {
    const res = this.decodeFrameDirect(canvas);
    if (!res) throw new Error('디코딩 실패: 데이터 프레임을 인식할 수 없습니다.');

    let payload = res.payload;
    if (res.isBrotli) {
      try {
        payload = new Uint8Array(this.codec.decompress_brotli(payload));
      } catch (e) {
        console.warn('Brotli decompress error, returning raw:', e);
      }
    }

    return { isBrotli: res.isBrotli, payload };
  }
}
