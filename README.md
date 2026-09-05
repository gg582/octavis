# OctaVis & OctaZip (v1.1)

[![Deploy to GitHub Pages](https://github.com/gg582/octavis/actions/workflows/deploy.yml/badge.svg)](https://github.com/gg582/octavis/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**OctaVis** is an air-gapped, zero-telemetry optical data transmission codec based on a 60-cell hexagonal grid (10,621 cells) and an 8-state (3-bit) color system. It encodes arbitrary binary files and text into static images (PNG) and video streams (WebM).

**OctaZip** is the non-visual, high-density text serialization counterpart of OctaVis designed for text-only communication channels (chat comments, forums, email body, and SMS).

Both formats are powered by a unified **Rust WebAssembly (`wasm32-unknown-unknown`)** core, ensuring all cryptographic, compression, and error-correction routines execute strictly inside the client browser sandbox without any server-side telemetry.

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

### 2. OctaZip (Text Armor)
* **Format:** PGP-style armored text (`-----BEGIN OCTAZIP V1.0-----`).
* **Encoding:** High-density Base91 serialization (~20-25% overhead compared to Base64's ~33%).
* **Envelope:** Magic header `OZ` + flags + CRC-16 checksum + compressed ciphertext.

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
│       │   └── octazip.rs  # Base91 text armor codec
│       └── tests/
├── src/                    # TypeScript Frontend Application
│   ├── renderer.ts         # Canvas hexagonal tile & preamble renderer
│   ├── video.ts            # WebM stream recorder
│   ├── decoder.ts          # Optical grid sampler & decoder
│   ├── video_decoder.ts    # 60Hz adaptive FPS & preamble detector
│   ├── i18n.ts             # Korean / English localization
│   └── main.ts             # Application controller & UI events
├── .github/workflows/      # GitHub Pages automated CI/CD
└── vite.config.ts
```

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v20+)
* [Rust](https://rustup.rs/) (stable)
* [wasm-pack](https://rustwasm.github.io/wasm-pack/)

### Development
```bash
# 1. Build Rust WebAssembly core
wasm-pack build crates/octavis_core --target web --out-dir ../../src/wasm

# 2. Install dependencies & launch dev server
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

---

## Deployment (GitHub Pages)

The repository is pre-configured with GitHub Actions (`.github/workflows/deploy.yml`). Simply push to `main` and set **Settings > Pages > Source** to **GitHub Actions**.

Live site: `https://gg582.github.io/octavis/`

---

## License

Released under the [MIT License](LICENSE).
