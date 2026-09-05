import init, { OctaVisCodec } from './wasm/octavis_core.js';

export interface RenderOptions {
  cellSize: number;
  quietZoneCells?: number;
  camouflageMode?: boolean; // 위장형 미니맵/액자 모드
}

const HEX_COLOR_STRINGS = [
  '#000000',
  '#0000FF',
  '#00FF00',
  '#00FFFF',
  '#FF0000',
  '#FF00FF',
  '#FFFF00',
  '#FFFFFF',
];

export class OctaVisRenderer {
  private codec: OctaVisCodec | null = null;
  private coords: Int32Array | null = null;

  async init() {
    await init();
    this.codec = new OctaVisCodec();
    this.coords = this.codec.get_all_coords();
  }

  getCodec(): OctaVisCodec {
    if (!this.codec) throw new Error('Codec not initialized');
    return this.codec;
  }

  renderToCanvas(
    canvas: HTMLCanvasElement,
    colorStates: Uint8Array,
    options: RenderOptions = { cellSize: 6, quietZoneCells: 4, camouflageMode: false }
  ) {
    if (!this.coords) throw new Error('Renderer not initialized');

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const r = options.cellSize;
    const quietZone = (options.quietZoneCells ?? 4) * r * Math.sqrt(3);
    const maxRadius = 60 * r * Math.sqrt(3) + quietZone;
    const size = Math.ceil(maxRadius * 2);
    canvas.width = size;
    canvas.height = size;

    if (options.camouflageMode) {
      // 위장 모드: 게임 레이더 / 사이버펑크 미니맵 스타일 그래픽 배경
      const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#030712');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // 격자 주변 레이더 그리드 원선 위장
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
    }

    const cx = size / 2;
    const cy = size / 2;
    const sqrt3 = Math.sqrt(3);

    const totalCells = colorStates.length;
    for (let i = 0; i < totalCells; i++) {
      const q = this.coords[i * 2];
      const r_coord = this.coords[i * 2 + 1];
      const colorIdx = colorStates[i];

      const x = cx + r * (sqrt3 * q + (sqrt3 / 2) * r_coord);
      const y = cy + r * (1.5 * r_coord);

      ctx.fillStyle = HEX_COLOR_STRINGS[colorIdx] || '#FFFFFF';
      this.drawHexagon(ctx, x, y, r);
    }
  }

  private drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const hx = x + radius * Math.cos(angle);
      const hy = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Chameleon Preamble: Passphrase-derived polymorphic colors
  renderPreamble(canvas: HTMLCanvasElement, preambleRgb: Uint8Array, options: RenderOptions = { cellSize: 6 }) {
    if (!this.coords) throw new Error('Renderer not initialized');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const r = options.cellSize;
    const quietZone = 4 * r * Math.sqrt(3);
    const maxRadius = 60 * r * Math.sqrt(3) + quietZone;
    const size = Math.ceil(maxRadius * 2);
    canvas.width = size;
    canvas.height = size;

    // Outer background: Black (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const sqrt3 = Math.sqrt(3);

    const colorStr = `rgb(${preambleRgb[0]}, ${preambleRgb[1]}, ${preambleRgb[2]})`;
    ctx.fillStyle = colorStr;
    const totalCells = this.coords.length / 2;
    for (let i = 0; i < totalCells; i++) {
      const q = this.coords[i * 2];
      const r_coord = this.coords[i * 2 + 1];
      const x = cx + r * (sqrt3 * q + (sqrt3 / 2) * r_coord);
      const y = cy + r * (1.5 * r_coord);
      this.drawHexagon(ctx, x, y, r);
    }
  }
}
