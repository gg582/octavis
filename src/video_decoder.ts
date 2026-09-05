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

    // -------------------------------------------------------------
    // Phase 1: 플랫폼 재압축/VFR/30fps 강제 변환에 대응하는 실질 FPS 추정 (Preamble 경계 분석)
    // -------------------------------------------------------------
    if (onProgress) onProgress({ currentFrame: 0, collectedFrames: 0, status: '플랫폼 압축률 및 실질 FPS 추정 중...' });

    const preambleEndTime = await this.detectPreambleEnd(video, canvas, ctx, duration);
    
    // 10fps ~ 30fps 다양한 플랫폼 환경을 포용하기 위해 고밀도 오버샘플링 (60Hz 단위 시크)
    // 플랫폼이 30fps/24fps로 강제 변환하며 생긴 모션 블러/블렌딩 프레임을 배제하고
    // 프레임 헤더의 매직넘버('OV') 및 CRC 정합성이 가장 높은 안정된 순간(Peak Stability)을 샘플링합니다.
    const sampleStep = 1 / 60; // 16.6ms 간격 고밀도 스캐닝
    let currentTime = Math.max(0, preambleEndTime - 0.2);

    const frameMap = new Map<number, Uint8Array>();
    let totalFramesExpected = 0;
    let isBrotli = false;

    // 실질 FPS 계산을 위한 프레임 전환 타임스탬프 추적
    const frameTimestamps = new Map<number, number>();

    while (currentTime <= duration) {
      video.currentTime = currentTime;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 종료 녹색 마커 확인
      const centerData = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      if (centerData[1] > 180 && centerData[0] < 80 && centerData[2] < 80) {
        // 종료 프레임 확인
        break;
      }

      // 프레임 디코딩 시도
      const decoded: DecodedFrameResult | null = this.decoder.decodeFrameDirect(canvas);
      if (decoded && decoded.payload.length > 0) {
        isBrotli = decoded.isBrotli;
        totalFramesExpected = decoded.totalFrames;

        if (!frameMap.has(decoded.frameIdx)) {
          frameMap.set(decoded.frameIdx, decoded.payload);
          frameTimestamps.set(decoded.frameIdx, currentTime);
        }
      }

      // 실질 FPS 추정치 계산 (인접 프레임 간의 시간 간격 역수)
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
          status: `데이터 프레임 추출 중 (${frameMap.size}/${totalFramesExpected || '?'}) [실질 FPS: ${estimatedFps || '계산 중'}fps]...`,
        });
      }

      if (totalFramesExpected > 0 && frameMap.size >= totalFramesExpected) {
        break;
      }

      currentTime += sampleStep;
    }

    URL.revokeObjectURL(video.src);

    if (frameMap.size === 0) {
      throw new Error('유효한 OctaVis 데이터 프레임을 찾을 수 없습니다. (비디오 품질 또는 격자 훼손 확인 필요)');
    }

    // 순서대로 프레임 결합
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

  // 0초부터 시작하는 마젠타 프리앰블이 끝나는 정확한 타임스탬프를 이진 탐색/스캔으로 검출
  private async detectPreambleEnd(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    duration: number
  ): Promise<number> {
    const checkMagentaAt = async (t: number): Promise<boolean> => {
      video.currentTime = Math.min(t, duration);
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      // Magenta: R > 150, B > 150, G < 100
      return pixel[0] > 140 && pixel[2] > 140 && pixel[1] < 110;
    };

    // 프리앰블 규격은 통상 5.0초 고정. 플랫폼 트랜스코딩으로 길이가 단축/신장될 수 있으므로 4.0~6.0초 부근 탐색
    let left = 3.0;
    let right = Math.min(duration, 7.0);

    if (!(await checkMagentaAt(1.0))) {
      // 1초 시점에도 마젠타가 아니면 프리앰블이 없거나 건너뛴 스트림 -> 0초부터 즉시 시작
      return 0.0;
    }

    // 0.1초 정밀도로 프리앰블 종료 경계 탐색
    for (let t = left; t <= right; t += 0.1) {
      const isMagenta = await checkMagentaAt(t);
      if (!isMagenta) {
        return t;
      }
    }

    return 5.0;
  }
}
