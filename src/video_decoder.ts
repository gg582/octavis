import { OctaVisDecoder, type DecodedFrameResult } from './decoder';

export interface VideoDecodeProgress {
  currentFrame: number;
  totalFrames?: number;
  collectedFrames: number;
  detectedFps?: number;
  status: string;
}

export class OctaVisVideoDecoder {
  private decoder: OctaVisDecoder;

  constructor(decoder: OctaVisDecoder) {
    this.decoder = decoder;
  }

  async decodeWebMFile(
    file: File,
    expectedPreambleRgb?: Uint8Array,
    onProgress?: (info: VideoDecodeProgress) => void
  ): Promise<{ isBrotli: boolean; payload: Uint8Array }> {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = (e) => reject(e);
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 800;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Cannot create 2d canvas context');

    const duration = video.duration;

    if (onProgress) onProgress({ currentFrame: 0, collectedFrames: 0, status: '가변 카멜레온 프리앰블 경계 탐색 중...' });

    const preambleEndTime = await this.detectPreambleEnd(video, canvas, ctx, duration, expectedPreambleRgb);

    const sampleStep = 1 / 60; // 60Hz 고밀도 오버샘플링
    let currentTime = Math.max(0, preambleEndTime - 0.2);

    const frameMap = new Map<number, Uint8Array>();
    let totalFramesExpected = 0;
    let isBrotli = false;
    const frameTimestamps = new Map<number, number>();

    while (currentTime <= duration) {
      video.currentTime = currentTime;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 종료 마커
      const centerData = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      if (centerData[1] > 180 && centerData[0] < 80 && centerData[2] < 80) {
        break;
      }

      const decoded: DecodedFrameResult | null = this.decoder.decodeFrameDirect(canvas);
      if (decoded && decoded.payload.length > 0) {
        isBrotli = decoded.isBrotli;
        totalFramesExpected = decoded.totalFrames;

        if (!frameMap.has(decoded.frameIdx)) {
          frameMap.set(decoded.frameIdx, decoded.payload);
          frameTimestamps.set(decoded.frameIdx, currentTime);
        }
      }

      let estimatedFps: number | undefined;
      if (frameTimestamps.size >= 2) {
        const sorted = Array.from(frameTimestamps.entries()).sort((a, b) => a[0] - b[0]);
        const delta = (sorted[sorted.length - 1][1] - sorted[0][1]) / (sorted.length - 1);
        if (delta > 0) {
          estimatedFps = Math.round(1 / delta);
        }
      }

      if (onProgress) {
        onProgress({
          currentFrame: frameMap.size,
          totalFrames: totalFramesExpected || undefined,
          collectedFrames: frameMap.size,
          detectedFps: estimatedFps,
          status: `데이터 프레임 수집 중 (${frameMap.size}/${totalFramesExpected || '?'}) [실질 FPS: ${estimatedFps || '계산 중'}fps]...`,
        });
      }

      if (totalFramesExpected > 0 && frameMap.size >= totalFramesExpected) {
        break;
      }

      currentTime += sampleStep;
    }

    URL.revokeObjectURL(video.src);

    if (frameMap.size === 0) {
      throw new Error('유효한 OctaVis 데이터 프레임을 찾을 수 없습니다.');
    }

    const sortedIndices = Array.from(frameMap.keys()).sort((a, b) => a - b);
    let totalLen = 0;
    for (const idx of sortedIndices) {
      totalLen += frameMap.get(idx)!.length;
    }

    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const idx of sortedIndices) {
      const chunk = frameMap.get(idx)!;
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    let finalPayload = merged;
    if (isBrotli) {
      try {
        finalPayload = new Uint8Array(this.decoder.getCodec().decompress_brotli(merged));
      } catch (e) {
        console.warn('Brotli decompress error, returning raw merged:', e);
      }
    }

    return { isBrotli, payload: finalPayload };
  }

  private async detectPreambleEnd(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    duration: number,
    expectedRgb?: Uint8Array
  ): Promise<number> {
    const targetR = expectedRgb ? expectedRgb[0] : 255;
    const targetG = expectedRgb ? expectedRgb[1] : 0;
    const targetB = expectedRgb ? expectedRgb[2] : 255;

    const checkPreambleAt = async (t: number): Promise<boolean> => {
      video.currentTime = Math.min(t, duration);
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      
      const dr = pixel[0] - targetR;
      const dg = pixel[1] - targetG;
      const db = pixel[2] - targetB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      return dist < 90; // 일치 오차 허용
    };

    if (!(await checkPreambleAt(1.0))) {
      return 0.0;
    }

    for (let t = 3.0; t <= Math.min(duration, 7.0); t += 0.1) {
      const isPreamble = await checkPreambleAt(t);
      if (!isPreamble) {
        return t;
      }
    }

    return 5.0;
  }
}
