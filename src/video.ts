import { OctaVisRenderer } from './renderer';

export class OctaVisVideoEncoder {
  private renderer: OctaVisRenderer;

  constructor(renderer: OctaVisRenderer) {
    this.renderer = renderer;
  }

  async createWebMStream(
    dataFrames: Uint8Array[],
    preambleRgb: Uint8Array,
    camouflageMode = false,
    fps = 24,
    onProgress?: (progress: number, status: string) => void
  ): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const stream = canvas.captureStream(fps);
    const supportedMime = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime,
      videoBitsPerSecond: 8_000_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise(async (resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: supportedMime }));
      };
      recorder.onerror = (err) => reject(err);

      recorder.start();

      // 1. Polymorphic Chameleon Preamble (5.0 seconds)
      if (onProgress) onProgress(0.1, '카멜레온 프리앰블 렌더링 중...');
      this.renderer.renderPreamble(canvas, preambleRgb);

      const preambleFrames = Math.ceil(5.0 * fps);
      for (let i = 0; i < preambleFrames; i++) {
        await this.waitNextFrame(1000 / fps);
      }

      // 2. Data frames (Camouflage background optional)
      const total = dataFrames.length;
      for (let i = 0; i < total; i++) {
        if (onProgress) {
          onProgress(0.2 + (0.7 * (i + 1)) / total, `데이터 프레임 송출 중 (${i + 1}/${total})`);
        }
        this.renderer.renderToCanvas(canvas, dataFrames[i], {
          cellSize: 6,
          camouflageMode,
        });
        await this.waitNextFrame(1000 / fps);
      }

      // 3. End Marker (1.0 second): Green (#00FF00)
      if (onProgress) onProgress(0.95, '종료 프레임 마킹 중...');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const endFrames = Math.ceil(1.0 * fps);
      for (let i = 0; i < endFrames; i++) {
        await this.waitNextFrame(1000 / fps);
      }

      recorder.stop();
    });
  }

  private waitNextFrame(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
