# OctaVis & OctaZip (v1.1)

[![Deploy to GitHub Pages](https://github.com/gg582/octavis/actions/workflows/deploy.yml/badge.svg)](https://github.com/gg582/octavis/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**OctaVis** is an air-gapped, zero-telemetry optical data transmission codec based on a 60-cell hexagonal grid (10,621 cells) and an 8-state (3-bit) color system. It encodes arbitrary binary files and text into static images (PNG) and video streams (WebM).

**OctaZip** is a standalone, high-performance binary archive format (`.ozip`) powered by the same cryptographic and compression engine. It eliminates text bloat and easily handles large binary files directly through the browser.

Both formats are driven by a unified **Rust WebAssembly (`wasm32-unknown-unknown`)** core, ensuring all cryptographic, compression, and error-correction routines execute strictly inside the client browser sandbox without any server-side telemetry.

---

## Key Specifications

### 1. OctaVis (Optical Codec)
* **Physical Grid:** 60-cell radius symmetric hexagonal tiling ($3 \times 60 \times 59 + 1 = \mathbf{10,621\text{ cells}}$).
* **Color System:** 8 orthogonal color states (3 bits/cell) mapped via Redmean perception distance.
* **Payload Capacity:** 7,880 data cells ($23,640\text{ bits} \approx 2,940\text{ bytes/frame}$).
* **Error Correction:**
  * Level 1: 3-axis line parity (851 cells) for real-time erasure tagging.
  * Level 2: Reed-Solomon erasure codec (1,373 cells) over Galois Field $GF(256)$.
* **Censorship Resistance & Camouflage:**
  * **Polymorphic Chameleon Preamble:** Passphrase-seeded dynamic preamble color and boundary detection.
  * **Camouflage Mode:** Cyberpunk dark radar/minimap background styling to bypass vision-based AI classification.
  * **Robust Platform Sampling:** 60Hz oversampling to recover effective FPS from re-encoded videos (KakaoTalk, Naver Cafe, YouTube).

### 2. OctaZip (Binary Archive `.ozip`)
* **Format:** Standalone binary archive format with magic header `OZIP`.
* **Zero Text Bloat:** Direct binary file packaging (no Base64/Base91 overhead, suitable for arbitrary and large files).
* **Envelope:** `[Magic "OZIP" (4B)]` + `[Flags (1B)]` + `[CRC16 (2B)]` + `[Payload]`.

### 3. Cryptography & Air-Gap Architecture (Kerckhoffs's Principle)
* **Cipher:** ChaCha20-Poly1305 authenticated encryption with random 16-byte salt and 12-byte nonce.
* **KDF:** Argon2id key derivation from user passphrases.
* **Content Security Policy (CSP):** Zero outbound network requests (`connect-src 'self' blob: data:`).
* **Memory Safety:** In-memory zeroization button to immediately wipe decoded byte buffers.

---

## Project Structure

```
octavis/
├── crates/
│   └── octavis_core/       # Rust WebAssembly Core Engine
│       ├── src/
│       │   ├── lib.rs      # wasm-bindgen interface
│       │   ├── color.rs    # 8-color state & Redmean metric
│       │   ├── crypto.rs   # Argon2 + ChaCha20-Poly1305 AEAD
│       │   ├── cv.rs       # Perspective warp & corner detection
│       │   ├── ecc.rs      # 3-axis line parity & Reed-Solomon
│       │   ├── grid.rs     # 60-cell hexagonal geometry
│       │   ├── layout.rs   # Cell slot partitioning
│       │   └── octazip.rs  # Standalone binary .ozip archiver
│       └── tests/
├── src/                    # TypeScript Frontend Application
│   ├── renderer.ts         # Canvas hexagonal tile & preamble renderer
│   ├── video.ts            # WebM stream recorder
│   ├── decoder.ts          # Optical grid sampler & decoder
│   ├── video_decoder.ts    # 60Hz adaptive FPS & preamble detector
│   ├── i18n.ts             # English / Korean / Chinese localization
│   └── main.ts             # Application controller & UI events
├── .github/workflows/      # GitHub Pages automated CI/CD
└── vite.config.ts
```

---

## Deployment (GitHub Pages)

The repository is pre-configured with GitHub Actions (`.github/workflows/deploy.yml`).

Live site: `https://gg582.github.io/octavis/`

---

## License

Released under the [MIT License](LICENSE).
