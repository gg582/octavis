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
const downloadBtn = document.getElementById('download-btn') as HTMLAnchorElement;

const decodeFileInput = document.getElementById('decode-file-input') as HTMLInputElement;
const decPassphrase = document.getElementById('dec-passphrase') as HTMLInputElement;
const camToggleBtn = document.getElementById('cam-toggle-btn') as HTMLButtonElement;
const camVideo = document.getElementById('cam-video') as HTMLVideoElement;
const camCanvas = document.getElementById('cam-canvas') as HTMLCanvasElement;
const decodeStatus = document.getElementById('decode-status') as HTMLDivElement;
const decodeOutput = document.getElementById('decode-output') as HTMLTextAreaElement;
const downloadDecodedBtn = document.getElementById('download-decoded-btn') as HTMLButtonElement;
const clearMemBtn = document.getElementById('clear-mem-btn') as HTMLButtonElement;

// OctaZip UI Elements
const zipFileInput = document.getElementById('zip-file-input') as HTMLInputElement;
const zipTextInput = document.getElementById('zip-text-input') as HTMLTextAreaElement;
const zipEncPassphrase = document.getElementById('zip-enc-passphrase') as HTMLInputElement;
const zipEncodeBtn = document.getElementById('zip-encode-btn') as HTMLButtonElement;
const zipEncodeStatus = document.getElementById('zip-encode-status') as HTMLDivElement;
const zipOutputText = document.getElementById('zip-output-text') as HTMLTextAreaElement;
const zipCopyBtn = document.getElementById('zip-copy-btn') as HTMLButtonElement;

const zipDecodeInput = document.getElementById('zip-decode-input') as HTMLTextAreaElement;
const zipDecPassphrase = document.getElementById('zip-dec-passphrase') as HTMLInputElement;
const zipDecodeBtn = document.getElementById('zip-decode-btn') as HTMLButtonElement;
const zipDecodeStatus = document.getElementById('zip-decode-status') as HTMLDivElement;
const zipDecodeOutput = document.getElementById('zip-decode-output') as HTMLTextAreaElement;
const zipDownloadDecodedBtn = document.getElementById('zip-download-decoded-btn') as HTMLButtonElement;
const zipClearMemBtn = document.getElementById('zip-clear-mem-btn') as HTMLButtonElement;

let lastDecodedBytes: Uint8Array | null = null;
let lastZipDecodedBytes: Uint8Array | null = null;
let cameraStream: MediaStream | null = null;
let cameraScanTimer: number | null = null;

// Apply i18n
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

// Tabs switching
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
// OCTAVIS OPTICAL ENCODER
// -------------------------------------------------------------
encodeBtn.addEventListener('click', async () => {
  let binary: Uint8Array;

  if (fileInput.files && fileInput.files[0]) {
    const buf = await fileInput.files[0].arrayBuffer();
    binary = new Uint8Array(buf);
  } else if (textInput.value.trim().length > 0) {
    binary = new TextEncoder().encode(textInput.value);
  } else {
    alert(currentLang === 'ko' ? '인코딩할 파일 또는 텍스트를 입력해주세요.' : currentLang === 'zh' ? '请提供要编码的文件或文本。' : 'Please provide input file or text.');
    return;
  }

  const codec = renderer.getCodec();
  const pass = encPassphrase.value.trim();
  const isCamouflage = camouflageModeInput.checked;

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

    const dataUrl = encodeCanvas.toDataURL('image/png');
    downloadBtn.href = dataUrl;
    downloadBtn.download = 'octavis_frame.png';
    downloadBtn.style.display = 'inline-block';
    downloadBtn.innerText = currentLang === 'ko' ? 'PNG 이미지 다운로드' : currentLang === 'zh' ? '下载 PNG 图片' : 'Download PNG Image';
    encodeStatus.innerText = `${currentLang === 'ko' ? '정적 프레임 생성 완료' : currentLang === 'zh' ? '静态帧生成完毕' : 'Static frame created'} (${frameCells.length} cells)`;
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

    const url = URL.createObjectURL(webmBlob);
    encodeVideo.src = url;
    downloadBtn.href = url;
    downloadBtn.download = 'octavis_stream.webm';
    downloadBtn.style.display = 'inline-block';
    downloadBtn.innerText = currentLang === 'ko' ? 'WebM 비디오 다운로드' : currentLang === 'zh' ? '下载 WebM 视频' : 'Download WebM Video';
    encodeStatus.innerText = `${currentLang === 'ko' ? 'WebM 비디오 생성 완료' : currentLang === 'zh' ? 'WebM 视频生成完毕' : 'WebM video ready'} (${(webmBlob.size / 1024).toFixed(1)} KB)`;
  }
});

// -------------------------------------------------------------
// OCTAVIS OPTICAL DECODER
// -------------------------------------------------------------
function handleDecodedPayload(rawPayload: Uint8Array, isBrotli: boolean) {
  const pass = decPassphrase.value.trim();
  let finalPayload = rawPayload;

  if (pass.length > 0) {
    try {
      finalPayload = renderer.getCodec().decrypt(rawPayload, pass);
    } catch {
      decodeStatus.innerText = currentLang === 'ko' ? '복호화 실패: 비밀번호를 확인하세요.' : currentLang === 'zh' ? '解密失败：请核对密码。' : 'Decryption failed: check passphrase.';
      decodeOutput.value = `[Encrypted Ciphertext (${rawPayload.length} bytes)]`;
      lastDecodedBytes = rawPayload;
      return;
    }
  }

  lastDecodedBytes = finalPayload;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(finalPayload);
    decodeOutput.value = text;
  } catch {
    decodeOutput.value = `[Binary Data Recovered (${finalPayload.length} bytes)]`;
  }
  decodeStatus.innerText = `${currentLang === 'ko' ? '디코딩 성공' : currentLang === 'zh' ? '解码成功' : 'Decoded successfully'} (${finalPayload.length} B, Brotli: ${isBrotli ? 'Yes' : 'No'})`;
  downloadDecodedBtn.style.display = 'inline-block';
}

decodeFileInput.addEventListener('change', async () => {
  if (!decodeFileInput.files || !decodeFileInput.files[0]) return;
  const file = decodeFileInput.files[0];
  stopCamera();

  if (file.type.startsWith('video/') || file.name.endsWith('.webm')) {
    try {
      decodeStatus.innerText = 'Seeking WebM video frames...';
      const pass = decPassphrase.value.trim();
      const expectedPreambleRgb = renderer.getCodec().get_preamble_rgb(pass);

      const result = await videoDecoder.decodeWebMFile(file, expectedPreambleRgb, (info) => {
        decodeStatus.innerText = info.status;
      });
      handleDecodedPayload(result.payload, result.isBrotli);
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
          decodeStatus.innerText = 'Analyzing grid and colors...';
          const result = decoder.decodeCanvas(canvas);
          handleDecodedPayload(result.payload, result.isBrotli);
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

clearMemBtn.addEventListener('click', () => {
  if (lastDecodedBytes) {
    lastDecodedBytes.fill(0);
    lastDecodedBytes = null;
  }
  decodeOutput.value = '';
  decodeStatus.innerText = currentLang === 'ko' ? '메모리가 파기되었습니다.' : currentLang === 'zh' ? '内存已安全粉碎。' : 'Memory zeroized.';
  downloadDecodedBtn.style.display = 'none';
});

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

// -------------------------------------------------------------
// OCTAZIP TEXT ARMOR ENCODER / DECODER
// -------------------------------------------------------------
zipEncodeBtn.addEventListener('click', async () => {
  let binary: Uint8Array;

  if (zipFileInput.files && zipFileInput.files[0]) {
    const buf = await zipFileInput.files[0].arrayBuffer();
    binary = new Uint8Array(buf);
  } else if (zipTextInput.value.trim().length > 0) {
    binary = new TextEncoder().encode(zipTextInput.value);
  } else {
    alert(currentLang === 'ko' ? '인코딩할 파일 또는 텍스트를 입력해주세요.' : currentLang === 'zh' ? '请提供要编码的文件或文本。' : 'Please provide input file or text.');
    return;
  }

  const pass = zipEncPassphrase.value.trim();
  const codec = renderer.getCodec();

  try {
    zipEncodeStatus.innerText = 'Generating OctaZip text armor...';
    const armor = codec.encode_octazip_text(binary, pass);
    zipOutputText.value = armor;
    zipCopyBtn.style.display = 'inline-block';
    zipEncodeStatus.innerText = `${currentLang === 'ko' ? 'OctaZip 아머 생성 완료' : currentLang === 'zh' ? 'OctaZip 装甲生成完毕' : 'OctaZip armor generated'} (${armor.length} chars)`;
  } catch (err: any) {
    zipEncodeStatus.innerText = `Error: ${err?.message || err}`;
  }
});

zipCopyBtn.addEventListener('click', async () => {
  if (!zipOutputText.value) return;
  await navigator.clipboard.writeText(zipOutputText.value);
  zipCopyBtn.innerText = currentLang === 'ko' ? '복사 완료!' : currentLang === 'zh' ? '已复制！' : 'Copied!';
  setTimeout(() => {
    zipCopyBtn.innerText = currentLang === 'ko' ? '클립보드에 복사' : currentLang === 'zh' ? '复制到剪贴板' : 'Copy to Clipboard';
  }, 2000);
});

zipDecodeBtn.addEventListener('click', () => {
  const text = zipDecodeInput.value.trim();
  if (!text) {
    alert(currentLang === 'ko' ? 'OctaZip 아머 텍스트를 입력해주세요.' : currentLang === 'zh' ? '请粘贴 OctaZip 装甲文本。' : 'Please paste OctaZip armor text.');
    return;
  }

  const pass = zipDecPassphrase.value.trim();
  const codec = renderer.getCodec();

  try {
    zipDecodeStatus.innerText = 'Decoding OctaZip armor...';
    const recovered = codec.decode_octazip_text(text, pass);
    lastZipDecodedBytes = recovered;

    try {
      zipDecodeOutput.value = new TextDecoder('utf-8', { fatal: true }).decode(recovered);
    } catch {
      zipDecodeOutput.value = `[Binary Data Recovered (${recovered.length} bytes)]`;
    }

    zipDecodeStatus.innerText = `${currentLang === 'ko' ? '디코딩 성공' : currentLang === 'zh' ? '解码成功' : 'Decoded successfully'} (${recovered.length} B)`;
    zipDownloadDecodedBtn.style.display = 'inline-block';
  } catch (err: any) {
    zipDecodeStatus.innerText = `Error: ${err?.message || err}`;
    zipDecodeOutput.value = '';
  }
});

zipClearMemBtn.addEventListener('click', () => {
  if (lastZipDecodedBytes) {
    lastZipDecodedBytes.fill(0);
    lastZipDecodedBytes = null;
  }
  zipDecodeOutput.value = '';
  zipDecodeStatus.innerText = currentLang === 'ko' ? '메모리가 파기되었습니다.' : currentLang === 'zh' ? '内存已安全粉碎。' : 'Memory zeroized.';
  zipDownloadDecodedBtn.style.display = 'none';
});

zipDownloadDecodedBtn.addEventListener('click', () => {
  if (!lastZipDecodedBytes) return;
  const copy = new Uint8Array(lastZipDecodedBytes);
  const blob = new Blob([copy.buffer as ArrayBuffer]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recovered_octazip.bin';
  a.click();
});

bootstrap();
