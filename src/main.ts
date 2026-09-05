import { OctaVisRenderer } from './renderer';
import { OctaVisVideoEncoder } from './video';
import { OctaVisDecoder } from './decoder';
import { OctaVisVideoDecoder } from './video_decoder';
import { translations, type Lang } from './i18n';

let currentLang: Lang = 'en'; // Default to English
let renderer: OctaVisRenderer;
let decoder: OctaVisDecoder;
let videoEncoder: OctaVisVideoEncoder;
let videoDecoder: OctaVisVideoDecoder;

// Language Elements
const langEnBtn = document.getElementById('lang-en') as HTMLButtonElement;
const langKoBtn = document.getElementById('lang-ko') as HTMLButtonElement;
const langZhBtn = document.getElementById('lang-zh') as HTMLButtonElement;

// Tab Elements
const tabBtnOctavis = document.getElementById('tab-btn-octavis') as HTMLButtonElement;
const tabBtnOctazip = document.getElementById('tab-btn-octazip') as HTMLButtonElement;
const tabOctavis = document.getElementById('tab-octavis') as HTMLElement;
const tabOctazip = document.getElementById('tab-octazip') as HTMLElement;

// OctaVis UI Elements
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
const encPassphrase = document.getElementById('enc-passphrase') as HTMLInputElement;
const camouflageModeInput = document.getElementById('camouflage-mode') as HTMLInputElement;
const encodeBtn = document.getElementById('encode-btn') as HTMLButtonElement;
const encodeStatus = document.getElementById('encode-status') as HTMLDivElement;
const encodeCanvas = document.getElementById('encode-canvas') as HTMLCanvasElement;
const encodeVideo = document.getElementById('encode-video') as HTMLVideoElement;

const decodeFileInput = document.getElementById('decode-file-input') as HTMLInputElement;
const decPassphrase = document.getElementById('dec-passphrase') as HTMLInputElement;
const camToggleBtn = document.getElementById('cam-toggle-btn') as HTMLButtonElement;
const camVideo = document.getElementById('cam-video') as HTMLVideoElement;
const camCanvas = document.getElementById('cam-canvas') as HTMLCanvasElement;
const decodeStatus = document.getElementById('decode-status') as HTMLDivElement;
const clearMemBtn = document.getElementById('clear-mem-btn') as HTMLButtonElement;

// OctaZip UI Elements
const zipFileInput = document.getElementById('zip-file-input') as HTMLInputElement;
const zipTextInput = document.getElementById('zip-text-input') as HTMLTextAreaElement;
const zipEncPassphrase = document.getElementById('zip-enc-passphrase') as HTMLInputElement;
const zipEncodeBtn = document.getElementById('zip-encode-btn') as HTMLButtonElement;
const zipEncodeStatus = document.getElementById('zip-encode-status') as HTMLDivElement;

const zipDecodeFileInput = document.getElementById('zip-decode-file-input') as HTMLInputElement;
const zipDecPassphrase = document.getElementById('zip-dec-passphrase') as HTMLInputElement;
const zipDecodeBtn = document.getElementById('zip-decode-btn') as HTMLButtonElement;
const zipDecodeStatus = document.getElementById('zip-decode-status') as HTMLDivElement;
const zipClearMemBtn = document.getElementById('zip-clear-mem-btn') as HTMLButtonElement;

let lastDecodedBytes: Uint8Array | null = null;
let lastZipDecodedBytes: Uint8Array | null = null;
let cameraStream: MediaStream | null = null;
let cameraScanTimer: number | null = null;

// Helper: trigger direct browser file download
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyLanguage(lang: Lang) {
  currentLang = lang;
  langEnBtn.classList.toggle('active', lang === 'en');
  langKoBtn.classList.toggle('active', lang === 'ko');
  langZhBtn.classList.toggle('active', lang === 'zh');

  const dict = translations[lang];
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as keyof typeof dict;
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder') as keyof typeof dict;
    if (dict[key]) {
      (el as HTMLInputElement).placeholder = dict[key];
    }
  });
}

langEnBtn.addEventListener('click', () => applyLanguage('en'));
langKoBtn.addEventListener('click', () => applyLanguage('ko'));
langZhBtn.addEventListener('click', () => applyLanguage('zh'));

tabBtnOctavis.addEventListener('click', () => {
  tabBtnOctavis.classList.add('active');
  tabBtnOctazip.classList.remove('active');
  tabOctavis.style.display = 'grid';
  tabOctazip.style.display = 'none';
});

tabBtnOctazip.addEventListener('click', () => {
  tabBtnOctazip.classList.add('active');
  tabBtnOctavis.classList.remove('active');
  tabOctavis.style.display = 'none';
  tabOctazip.style.display = 'grid';
});

async function bootstrap() {
  encodeStatus.innerText = 'Initializing WASM core...';
  renderer = new OctaVisRenderer();
  await renderer.init();
  decoder = new OctaVisDecoder(renderer.getCodec());
  videoEncoder = new OctaVisVideoEncoder(renderer);
  videoDecoder = new OctaVisVideoDecoder(decoder);
  encodeStatus.innerText = 'Ready (WASM Active)';
  applyLanguage('en');
}

// -------------------------------------------------------------
// OCTAVIS OPTICAL ENCODER: Direct download as .octavis.png or .octavis.webm
// -------------------------------------------------------------
encodeBtn.addEventListener('click', async () => {
  let binary: Uint8Array;
  let originalName = 'data';

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    originalName = file.name.replace(/\.[^/.]+$/, '');
    const buf = await file.arrayBuffer();
    binary = new Uint8Array(buf);
  } else if (textInput.value.trim().length > 0) {
    binary = new TextEncoder().encode(textInput.value);
    originalName = 'note';
  } else {
    alert(currentLang === 'ko' ? '인코딩할 파일 또는 텍스트를 입력해주세요.' : currentLang === 'zh' ? '请提供要编码的文件或文本。' : 'Please provide input file or text.');
    return;
  }

  const codec = renderer.getCodec();
  const pass = encPassphrase.value.trim();
  const isCamouflage = camouflageModeInput.checked;

  // Pack original filename envelope so restoration recovers the exact filename
  const fileNameToSave = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : 'message.txt';
  binary = codec.pack_file_envelope(fileNameToSave, binary);

  if (pass.length > 0) {
    encodeStatus.innerText = currentLang === 'ko' ? 'ChaCha20-Poly1305 암호화 중...' : currentLang === 'zh' ? '正在执行 ChaCha20-Poly1305 加密...' : 'Applying ChaCha20-Poly1305...';
    try {
      binary = codec.encrypt(binary, pass);
    } catch (e: any) {
      alert(`Encryption failed: ${e?.message || e}`);
      return;
    }
  }

  const mode = (document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value;
  const compResult = codec.compress_if_beneficial(binary);
  const isBrotli = compResult[0] === 1;
  const processedData = compResult.slice(1);

  if (mode === 'static') {
    encodeVideo.style.display = 'none';
    encodeCanvas.style.display = 'block';

    if (processedData.length > 2940) {
      alert(currentLang === 'ko' ? '정적 모드 용량 초과. 비디오 모드를 사용하세요.' : currentLang === 'zh' ? '超出静态模式容量，请使用视频流模式。' : 'Static capacity exceeded. Use video mode.');
      return;
    }

    const frameCells = codec.encode_frame(processedData, 0, 1, isBrotli);
    renderer.renderToCanvas(encodeCanvas, frameCells, {
      cellSize: 5,
      quietZoneCells: 4,
      camouflageMode: isCamouflage,
    });

    encodeCanvas.toBlob((blob) => {
      if (blob) {
        triggerDownload(blob, `${originalName}.octavis.png`);
        encodeStatus.innerText = `${currentLang === 'ko' ? 'PNG 파일 다운로드 완료' : currentLang === 'zh' ? 'PNG 图片已直接下载' : 'PNG downloaded successfully'} (${(blob.size / 1024).toFixed(1)} KB)`;
      }
    }, 'image/png');
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

    const preambleRgb = codec.get_preamble_rgb(pass);
    encodeStatus.innerText = currentLang === 'ko' ? '비디오 스트림 생성 중...' : currentLang === 'zh' ? '正在渲染视频流...' : 'Rendering video stream...';

    const webmBlob = await videoEncoder.createWebMStream(
      frames,
      preambleRgb,
      isCamouflage,
      24,
      (progress, status) => {
        encodeStatus.innerText = `[${Math.round(progress * 100)}%] ${status}`;
      }
    );

    triggerDownload(webmBlob, `${originalName}.octavis.webm`);
    const url = URL.createObjectURL(webmBlob);
    encodeVideo.src = url;
    encodeStatus.innerText = `${currentLang === 'ko' ? 'WebM 비디오 다운로드 완료' : currentLang === 'zh' ? 'WebM 视频已直接下载' : 'WebM video downloaded'} (${(webmBlob.size / 1024).toFixed(1)} KB)`;
  }
});

// -------------------------------------------------------------
// OCTAVIS OPTICAL DECODER: Direct restoration and download
// -------------------------------------------------------------
function handleDecodedPayload(rawPayload: Uint8Array, isBrotli: boolean, _sourceFilename: string) {
  const pass = decPassphrase.value.trim();
  let finalPayload = rawPayload;

  if (pass.length > 0) {
    try {
      finalPayload = renderer.getCodec().decrypt(rawPayload, pass);
    } catch {
      decodeStatus.innerText = currentLang === 'ko' ? '복호화 실패: 올바른 패스프레이즈를 입력하세요.' : currentLang === 'zh' ? '解密失败：请核对密码。' : 'Decryption failed: incorrect passphrase.';
      return;
    }
  }

  lastDecodedBytes = finalPayload;

  // Unpack original filename envelope
  const unpacked = renderer.getCodec().unpack_file_envelope(finalPayload);
  const nameLen = unpacked[0];
  const nameBytes = unpacked.slice(1, 1 + nameLen);
  const recoveredPayload = unpacked.slice(1 + nameLen);
  const originalFileName = new TextDecoder().decode(nameBytes) || 'restored_data.bin';

  // Direct download restored original file
  const copy = new Uint8Array(recoveredPayload);
  const blob = new Blob([copy.buffer as ArrayBuffer]);
  triggerDownload(blob, originalFileName);

  decodeStatus.innerText = `${currentLang === 'ko' ? '복구 완료 및 다운로드됨' : currentLang === 'zh' ? '还原成功并已自动下载' : 'Restored and downloaded successfully'} (${(finalPayload.length / 1024).toFixed(1)} KB, Brotli: ${isBrotli ? 'Yes' : 'No'})`;
}

decodeFileInput.addEventListener('change', async () => {
  if (!decodeFileInput.files || !decodeFileInput.files[0]) return;
  const file = decodeFileInput.files[0];
  stopCamera();

  if (file.type.startsWith('video/') || file.name.endsWith('.webm')) {
    try {
      decodeStatus.innerText = 'Decoding WebM frames via WASM...';
      const pass = decPassphrase.value.trim();
      const expectedPreambleRgb = renderer.getCodec().get_preamble_rgb(pass);

      const result = await videoDecoder.decodeWebMFile(file, expectedPreambleRgb, (info) => {
        decodeStatus.innerText = info.status;
      });
      handleDecodedPayload(result.payload, result.isBrotli, file.name);
    } catch (err: any) {
      decodeStatus.innerText = `Error: ${err?.message || err}`;
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
          decodeStatus.innerText = 'Analyzing grid and colors via WASM...';
          const result = decoder.decodeCanvas(canvas);
          handleDecodedPayload(result.payload, result.isBrotli, file.name);
        } catch (err: any) {
          decodeStatus.innerText = `Error: ${err?.message || err}`;
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
});

camToggleBtn.addEventListener('click', async () => {
  if (cameraStream) {
    stopCamera();
    decodeStatus.innerText = 'Camera stopped';
  } else {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      camVideo.srcObject = cameraStream;
      camVideo.style.display = 'block';
      await camVideo.play();
      decodeStatus.innerText = 'Camera scanner active...';
      startCameraLoop();
    } catch (e: any) {
      alert(`Camera access error: ${e?.message || e}`);
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
  const cameraFrameMap = new Map<number, Uint8Array>();
  let cameraTotalFrames = 0;
  let cameraIsBrotli = false;

  const scan = () => {
    if (!cameraStream) return;
    if (camVideo.videoWidth > 0 && ctx) {
      camCanvas.width = camVideo.videoWidth;
      camCanvas.height = camVideo.videoHeight;
      ctx.drawImage(camVideo, 0, 0);

      const res = decoder.decodeFrameDirect(camCanvas);
      if (res && res.payload.length > 0) {
        cameraIsBrotli = res.isBrotli;
        cameraTotalFrames = res.totalFrames;

        if (!cameraFrameMap.has(res.frameIdx)) {
          cameraFrameMap.set(res.frameIdx, res.payload);
        }

        if (cameraTotalFrames <= 1) {
          // Single frame static image or 1-frame video
          let payload = res.payload;
          if (res.isBrotli) {
            try {
              payload = new Uint8Array(decoder.getCodec().decompress_brotli(payload));
            } catch {}
          }
          stopCamera();
          handleDecodedPayload(payload, res.isBrotli, 'camera_scan');
          return;
        } else {
          // Multi-frame video stream scanning
          decodeStatus.innerText = `Camera stream scan: collected ${cameraFrameMap.size} / ${cameraTotalFrames} frames...`;

          if (cameraFrameMap.size >= cameraTotalFrames) {
            const sortedIndices = Array.from(cameraFrameMap.keys()).sort((a, b) => a - b);
            let totalLen = 0;
            for (const idx of sortedIndices) {
              totalLen += cameraFrameMap.get(idx)!.length;
            }

            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const idx of sortedIndices) {
              const chunk = cameraFrameMap.get(idx)!;
              merged.set(chunk, offset);
              offset += chunk.length;
            }

            let finalPayload = merged;
            if (cameraIsBrotli) {
              try {
                finalPayload = new Uint8Array(decoder.getCodec().decompress_brotli(merged));
              } catch {}
            }

            stopCamera();
            handleDecodedPayload(finalPayload, cameraIsBrotli, 'camera_stream');
            return;
          }
        }
      }
    }
    cameraScanTimer = requestAnimationFrame(scan);
  };
  cameraScanTimer = requestAnimationFrame(scan);
}

clearMemBtn.addEventListener('click', () => {
  if (lastDecodedBytes) {
    lastDecodedBytes.fill(0);
    lastDecodedBytes = null;
  }
  decodeStatus.innerText = currentLang === 'ko' ? '메모리가 파기되었습니다.' : currentLang === 'zh' ? '内存已安全粉碎。' : 'Memory zeroized.';
});

// -------------------------------------------------------------
// OCTAZIP PACK/UNPACK: 100% direct file download/restore
// -------------------------------------------------------------
zipEncodeBtn.addEventListener('click', async () => {
  let binary: Uint8Array;
  let originalName = 'archive';

  if (zipFileInput.files && zipFileInput.files[0]) {
    const file = zipFileInput.files[0];
    originalName = file.name.replace(/\.[^/.]+$/, '');
    const buf = await file.arrayBuffer();
    binary = new Uint8Array(buf);
  } else if (zipTextInput.value.trim().length > 0) {
    binary = new TextEncoder().encode(zipTextInput.value);
    originalName = 'note';
  } else {
    alert(currentLang === 'ko' ? '인코딩할 파일 또는 텍스트를 입력해주세요.' : currentLang === 'zh' ? '请提供要编码的文件或文本。' : 'Please provide input file or text.');
    return;
  }

  const pass = zipEncPassphrase.value.trim();
  const codec = renderer.getCodec();

  try {
    zipEncodeStatus.innerText = 'Packing into .octazip package...';
    const fileNameToSave = zipFileInput.files && zipFileInput.files[0] ? zipFileInput.files[0].name : 'note.txt';
    binary = codec.pack_file_envelope(fileNameToSave, binary);
    const packageBytes = codec.pack_octazip(binary, pass);
    
    // Direct file download as *.octazip
    const copy = new Uint8Array(packageBytes);
    const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    triggerDownload(blob, `${originalName}.octazip`);

    zipEncodeStatus.innerText = `${currentLang === 'ko' ? '.octazip 변환 및 다운로드 완료' : currentLang === 'zh' ? '.octazip 转换并已直接下载' : '.octazip created and downloaded'} (${(packageBytes.length / 1024).toFixed(1)} KB)`;
  } catch (err: any) {
    zipEncodeStatus.innerText = `Error: ${err?.message || err}`;
  }
});

zipDecodeBtn.addEventListener('click', async () => {
  if (!zipDecodeFileInput.files || !zipDecodeFileInput.files[0]) {
    alert(currentLang === 'ko' ? '복구할 .octazip 파일을 선택해주세요.' : currentLang === 'zh' ? '请选择要还原的 .octazip 文件。' : 'Please select an .octazip file to restore.');
    return;
  }

  const file = zipDecodeFileInput.files[0];
  const buf = await file.arrayBuffer();
  const packageBytes = new Uint8Array(buf);
  const pass = zipDecPassphrase.value.trim();
  const codec = renderer.getCodec();

  try {
    zipDecodeStatus.innerText = 'Unpacking .octazip via WASM...';
    const recovered = codec.unpack_octazip(packageBytes, pass);
    lastZipDecodedBytes = recovered;

    // Unpack original filename envelope
    const unpacked = codec.unpack_file_envelope(recovered);
    const nameLen = unpacked[0];
    const nameBytes = unpacked.slice(1, 1 + nameLen);
    const recoveredPayload = unpacked.slice(1 + nameLen);
    const originalFileName = new TextDecoder().decode(nameBytes) || file.name.replace(/\.octazip$/i, '') || 'restored_data.bin';

    // Direct file download of the restored original payload
    const copy = new Uint8Array(recoveredPayload);
    const blob = new Blob([copy.buffer as ArrayBuffer]);
    triggerDownload(blob, originalFileName);

    zipDecodeStatus.innerText = `${currentLang === 'ko' ? '.octazip 복구 및 다운로드 성공' : currentLang === 'zh' ? '.octazip 还原并已自动下载' : '.octazip restored and downloaded'} (${(recovered.length / 1024).toFixed(1)} KB)`;
  } catch (err: any) {
    zipDecodeStatus.innerText = `Error: ${err?.message || err}`;
  }
});

zipClearMemBtn.addEventListener('click', () => {
  if (lastZipDecodedBytes) {
    lastZipDecodedBytes.fill(0);
    lastZipDecodedBytes = null;
  }
  zipDecodeStatus.innerText = currentLang === 'ko' ? '메모리가 파기되었습니다.' : currentLang === 'zh' ? '内存已安全粉碎。' : 'Memory zeroized.';
});

bootstrap();
