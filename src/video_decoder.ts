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
    _expectedPreambleRgb?: Uint8Array,
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

    const duration = video.duration || 10.0;

    if (onProgress) onProgress({ currentFrame: 0, collectedFrames: 0, status: 'Scanning video stream frames...' });

    // Try fast playback capture first
    const frameMap = new Map<number, Uint8Array>();
    let totalFramesExpected = 0;
    let isBrotli = false;
    const frameTimestamps = new Map<number, number>();

    const processCanvasFrame = (currentTime: number): boolean => {
      // Check green end marker (#00FF00)
      const centerPixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      if (centerPixel[1] > 200 && centerPixel[0] < 50 && centerPixel[2] < 50) {
        return true; // End marker detected
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
          status: `Collecting data frames (${frameMap.size}/${totalFramesExpected || '?'}) [${estimatedFps ? `${estimatedFps} fps` : 'evaluating'}]...`,
        });
      }

      if (totalFramesExpected > 0 && frameMap.size >= totalFramesExpected) {
        return true; // Finished!
      }
      return false;
    };

    // Fast playback capture loop
    let playbackSucceeded = false;
    try {
      video.playbackRate = 1.0;
      await video.play();

      await new Promise<void>((resolve) => {
        const checkFrame = () => {
          if (video.ended || video.paused) {
            resolve();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const done = processCanvasFrame(video.currentTime);
          if (done) {
            video.pause();
            resolve();
            return;
          }

          if ('requestVideoFrameCallback' in video) {
            (video as any).requestVideoFrameCallback(checkFrame);
          } else {
            requestAnimationFrame(checkFrame);
          }
        };

        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(checkFrame);
        } else {
          requestAnimationFrame(checkFrame);
        }

        video.onended = () => resolve();
      });

      if (totalFramesExpected > 0 && frameMap.size >= totalFramesExpected) {
        playbackSucceeded = true;
      }
    } catch {
      playbackSucceeded = false;
    }

    // Step sampling fallback if playback missed any frames
    if (!playbackSucceeded || (totalFramesExpected > 0 && frameMap.size < totalFramesExpected) || frameMap.size === 0) {
      if (onProgress) onProgress({ currentFrame: frameMap.size, collectedFrames: frameMap.size, status: 'Performing deep seek frame sampling...' });

      const sampleStep = 0.05; // 50ms step sampling
      let currentTime = 0.0;

      while (currentTime <= duration) {
        video.currentTime = currentTime;
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          // Safety timeout in case seeked doesn't fire
          setTimeout(onSeeked, 80);
        });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const done = processCanvasFrame(currentTime);
        if (done) break;

        currentTime += sampleStep;
      }
    }

    URL.revokeObjectURL(video.src);

    if (frameMap.size === 0) {
      throw new Error('No valid OctaVis data frames found in video stream.');
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
}
