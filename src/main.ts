import { OctaVisRenderer } from './renderer';
import { OctaVisVideoEncoder } from './video';
import { OctaVisDecoder } from './decoder';
import { OctaVisVideoDecoder } from './video_decoder';

let renderer: OctaVisRenderer;
let decoder: OctaVisDecoder;
let videoEncoder: OctaVisVideoEncoder;
let videoDecoder: OctaVisVideoDecoder;

// Encoder UI
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
const encPassphrase = document.getElementById('enc-passphrase') as HTMLInputElement;
const encodeBtn = document.getElementById('encode-btn') as HTMLButtonElement;
const encodeStatus = document.getElementById('encode-status') as HTMLDivElement;
const encodeCanvas = document.getElementById('encode-canvas') as HTMLCanvasElement;
const encodeVideo = document.getElementById('encode-video') as HTMLVideoElement;
const downloadBtn = document.getElementById('download-btn') as HTMLAnchorElement;

// Decoder UI
const decodeFileInput = document.getElementById('decode-file-input') as HTMLInputElement;
const decPassphrase = document.getElementById('dec-passphrase') as HTMLInputElement;
const camToggleBtn = document.getElementById('cam-toggle-btn') as HTMLButtonElement;
const camVideo = document.getElementById('cam-video') as HTMLVideoElement;
const camCanvas = document.getElementById('cam-canvas') as HTMLCanvasElement;
const decodeStatus = document.getElementById('decode-status') as HTMLDivElement;
const decodeOutput = document.getElementById('decode-output') as HTMLTextAreaElement;
const downloadDecodedBtn = document.getElementById('download-decoded-btn') as HTMLButtonElement;

let lastDecodedBytes: Uint8Array | null = null;
let cameraStream: MediaStream | null = null;
let cameraScanTimer: number | null = null;

async function bootstrap() {
  encodeStatus.innerText = 'WASM 코어 로딩 중...';
  renderer = new OctaVisRenderer();
  await renderer.init();
  decoder = new OctaVisDecoder(renderer.getCodec());
  videoEncoder = new OctaVisVideoEncoder(renderer);
  videoDecoder = new OctaVisVideoDecoder(decoder);
  encodeStatus.innerText = '준비 완료 (ChaCha20-Poly1305 및 WASM 활성화됨)';
}

// ---------------------------
// ENCODER LOGIC
// ---------------------------
encodeBtn.addEventListener('click', async () => {
  let binary: Uint8Array;

  if (fileInput.files && fileInput.files[0]) {
    const buf = await fileInput.files[0].arrayBuffer();
    binary = new Uint8Array(buf);
  } else if (textInput.value.trim().length > 0) {
    binary = new TextEncoder().encode(textInput.value);
  } else {
    alert('인코딩할 파일 또는 텍스트를 입력해주세요.');
    return;
  }

  const codec = renderer.getCodec();
  const pass = encPassphrase.value.trim();

  // 1. Optional ChaCha20-Poly1305 Encryption
  if (pass.length > 0) {
    encodeStatus.innerText = 'Argon2 키 파생 및 ChaCha20-Poly1305 암호화 적용 중...';
    try {
      binary = codec.encrypt(binary, pass);
    } catch (e: any) {
      alert(`암호화 실패: ${e?.message || e}`);
      return;
    }
  }

  const mode = (document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value;

  // 2. Brotli compression check
  encodeStatus.innerText = 'Brotli 압축 적합성 분석 중...';
  const compResult = codec.compress_if_beneficial(binary);
  const isBrotli = compResult[0] === 1;
  const processedData = compResult.slice(1);

  encodeStatus.innerText = `적용 상태: ${pass.length > 0 ? '[ChaCha20 암호화] ' : ''}${isBrotli ? '[Brotli 압축]' : '[원본]'} (${processedData.length} 바이트)`;

  if (mode === 'static') {
    encodeVideo.style.display = 'none';
    encodeCanvas.style.display = 'block';

    if (processedData.length > 2940) {
      alert(`정적 모드 용량 초과 (${processedData.length} > 2940 바이트). 비디오 스트림 모드를 사용하세요.`);
      return;
    }

    const frameCells = codec.encode_frame(processedData, 0, 1, isBrotli);
    renderer.renderToCanvas(encodeCanvas, frameCells, { cellSize: 5, quietZoneCells: 4 });

    const dataUrl = encodeCanvas.toDataURL('image/png');
    downloadBtn.href = dataUrl;
    downloadBtn.download = 'octavis_frame.png';
    downloadBtn.style.display = 'inline-block';
    downloadBtn.innerText = 'PNG 이미지 다운로드';
    encodeStatus.innerText = `정적 프레임 인코딩 완료 (${frameCells.length} 셀 렌더링)`;
  } else {
    encodeCanvas.style.display = 'none';
    encodeVideo.style.display = 'block';

    const frameSize = 2940;
    const totalFrames = Math.ceil(processedData.length / frameSize);
    const frames: Uint8Array[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const chunk = processedData.slice(i * frameSize, (i + 1) * frameSize);
      const cells = codec.encode_frame(chunk, i, totalFrames, isBrotli);
      frames.push(cells);
    }

    encodeStatus.innerText = `비디오 스트림 생성 중 (총 ${totalFrames} 프레임)...`;
    const webmBlob = await videoEncoder.createWebMStream(frames, 24, (progress, status) => {
      encodeStatus.innerText = `[${Math.round(progress * 100)}%] ${status}`;
    });

    const url = URL.createObjectURL(webmBlob);
    encodeVideo.src = url;
    downloadBtn.href = url;
    downloadBtn.download = 'octavis_stream.webm';
    downloadBtn.style.display = 'inline-block';
    downloadBtn.innerText = 'WebM 비디오 다운로드';
    encodeStatus.innerText = `WebM 스트림 생성 완료 (${(webmBlob.size / 1024).toFixed(1)} KB)`;
  }
});

// Helper: Process payload with optional decryption
function handleDecodedPayload(rawPayload: Uint8Array, isBrotli: boolean) {
  const pass = decPassphrase.value.trim();
  let finalPayload = rawPayload;

  if (pass.length > 0) {
    try {
      finalPayload = renderer.getCodec().decrypt(rawPayload, pass);
    } catch (e: any) {
      decodeStatus.innerText = `복호화 실패: 올바른 패스프레이즈를 입력하세요.`;
      decodeOutput.value = `[암호화된 고밀도 난수 페이로드 (${rawPayload.length} 바이트)]\n복호화 키가 일치하지 않습니다.`;
      lastDecodedBytes = rawPayload;
      return;
    }
  }

  lastDecodedBytes = finalPayload;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(finalPayload);
    decodeOutput.value = text;
  } catch {
    decodeOutput.value = `[바이너리 파일 복원됨 (${finalPayload.length} 바이트) - '복원 파일 다운로드'를 누르세요]`;
  }
  decodeStatus.innerText = `성공! (${finalPayload.length} 바이트, ${pass.length > 0 ? 'ChaCha20 복호화 완료, ' : ''}Brotli: ${isBrotli ? '적용' : '미적용'})`;
  downloadDecodedBtn.style.display = 'inline-block';
}

// ---------------------------
// DECODER: DIRECT FILE UPLOAD (Image or WebM Video)
// ---------------------------
decodeFileInput.addEventListener('change', async () => {
  if (!decodeFileInput.files || !decodeFileInput.files[0]) return;
  const file = decodeFileInput.files[0];

  stopCamera();

  if (file.type.startsWith('video/') || file.name.endsWith('.webm')) {
    try {
      decodeStatus.innerText = 'WebM 비디오 직접 프레임 고속 디코딩 중...';
      const result = await videoDecoder.decodeWebMFile(file, (info) => {
        decodeStatus.innerText = info.status;
      });
      handleDecodedPayload(result.payload, result.isBrotli);
    } catch (err: any) {
      decodeStatus.innerText = `비디오 디코딩 오류: ${err?.message || err}`;
    }
  } else {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        try {
          decodeStatus.innerText = '이미지 격자 분석 및 디코딩 중...';
          const result = decoder.decodeCanvas(canvas);
          handleDecodedPayload(result.payload, result.isBrotli);
        } catch (err: any) {
          decodeStatus.innerText = `디코딩 실패: ${err?.message || err}`;
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
});

// ---------------------------
// DECODER: REALTIME CAMERA SCAN
// ---------------------------
camToggleBtn.addEventListener('click', async () => {
  if (cameraStream) {
    stopCamera();
    decodeStatus.innerText = '카메라 스캔 중지됨';
  } else {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      camVideo.srcObject = cameraStream;
      camVideo.style.display = 'block';
      await camVideo.play();

      decodeStatus.innerText = '카메라 락온 대기 중...';
      startCameraLoop();
    } catch (e: any) {
      alert(`카메라 접근 실패: ${e?.message || e}`);
    }
  }
});

function stopCamera() {
  if (cameraScanTimer) {
    cancelAnimationFrame(cameraScanTimer);
    cameraScanTimer = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
    camVideo.srcObject = null;
    camVideo.style.display = 'none';
  }
}

function startCameraLoop() {
  const ctx = camCanvas.getContext('2d', { willReadFrequently: true });
  const scan = () => {
    if (!cameraStream) return;
    if (camVideo.videoWidth > 0 && ctx) {
      camCanvas.width = camVideo.videoWidth;
      camCanvas.height = camVideo.videoHeight;
      ctx.drawImage(camVideo, 0, 0);

      const res = decoder.decodeFrameDirect(camCanvas);
      if (res && res.payload.length > 0) {
        let payload = res.payload;
        if (res.isBrotli) {
          try {
            payload = new Uint8Array(decoder.getCodec().decompress_brotli(payload));
          } catch {}
        }
        handleDecodedPayload(payload, res.isBrotli);
      }
    }
    cameraScanTimer = requestAnimationFrame(scan);
  };
  cameraScanTimer = requestAnimationFrame(scan);
}

// ---------------------------
// EXPORT FILE
// ---------------------------
downloadDecodedBtn.addEventListener('click', () => {
  if (!lastDecodedBytes) return;
  const copy = new Uint8Array(lastDecodedBytes);
  const blob = new Blob([copy.buffer as ArrayBuffer]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recovered_data.bin';
  a.click();
});

bootstrap();
