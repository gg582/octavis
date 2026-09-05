export type Lang = 'en' | 'ko' | 'zh';

export const translations = {
  en: {
    title: 'OctaVis & OctaZip (v1.1)',
    subtitle: 'Hexagonal Grid Optical Media (.png/.webm) & Binary Package Archiver (.octazip)',
    badge: '🛡️ Air-Gapped / Zero-Telemetry: All encoding and decoding operations run strictly inside local WebAssembly sandbox.',
    tab_octavis: 'OctaVis (Optical .png / .webm)',
    tab_octazip: 'OctaZip (Binary .octazip)',
    
    // OctaVis Encoder
    enc_title: 'OctaVis Encoder',
    enc_file_label: 'Input File to Encode',
    enc_text_label: 'Or Enter Text Directly',
    enc_pass_label: 'Secret Passphrase (ChaCha20 Encryption & Chameleon Preamble)',
    enc_pass_placeholder: 'Leave blank for plaintext, or enter to encrypt & randomize preamble',
    enc_mode_static: 'Static Image (PNG)',
    enc_mode_video: 'Video Stream (WebM)',
    enc_camouflage: 'Camouflage Graphic Mode (Game/Radar UI Style)',
    btn_encode: 'Encode & Download File',
    
    // OctaVis Decoder
    dec_title: 'OctaVis Decoder',
    dec_method1_label: 'Upload Optical Media File (.png / .webm)',
    dec_method1_hint: 'Upload your .png image or .webm video stream to decode and download original file instantly via WASM.',
    dec_divider: 'OR',
    dec_method2_label: 'Real-time Camera Scanner',
    btn_cam_toggle: 'Start / Stop Camera Scanner',
    dec_pass_label: 'Decryption Passphrase',
    dec_pass_placeholder: 'Required if stream was encrypted or uses custom preamble',
    btn_wipe_mem: 'Wipe Memory (Zeroize)',

    // OctaZip Tab
    zip_enc_title: 'OctaZip Package Encoder',
    zip_enc_hint: 'Directly converts any input file/text into a compact .octazip archive and downloads it immediately.',
    zip_btn_encode: 'Convert to .octazip & Download',
    zip_dec_title: 'OctaZip Package Decoder',
    zip_dec_label: 'Upload .octazip File to Restore',
    zip_dec_hint: 'Upload your .octazip archive to unpack and automatically download the original file via WASM.',
    zip_btn_decode: 'Decode .octazip & Download Original',
  },
  ko: {
    title: 'OctaVis & OctaZip (v1.1)',
    subtitle: '60셀 육각 격자 광학 미디어(.png/.webm) & 바이너리 패키지 아카이버(.octazip)',
    badge: '🛡️ Air-Gapped / Zero-Telemetry: 모든 변환, 암호화 및 복구는 브라우저 내부 WebAssembly 샌드박스에서 완벽히 오프라인으로 실행됩니다.',
    tab_octavis: 'OctaVis (광학 .png / .webm)',
    tab_octazip: 'OctaZip (바이너리 .octazip)',
    
    // OctaVis Encoder
    enc_title: 'OctaVis 인코더',
    enc_file_label: '변환할 파일 선택',
    enc_text_label: '또는 텍스트 직접 입력',
    enc_pass_label: '비밀 키 / 패스프레이즈 (ChaCha20 암호화 & 카멜레온 프리앰블)',
    enc_pass_placeholder: '비우면 평문/기본색, 입력 시 ChaCha20-Poly1305 암호화 & 프리앰블 가변화',
    enc_mode_static: '정적 이미지 (PNG)',
    enc_mode_video: '비디오 스트림 (WebM)',
    enc_camouflage: '위장형 그래픽 모드 (게임/레이더 UI 위장)',
    btn_encode: '변환 및 파일 다운로드',
    
    // OctaVis Decoder
    dec_title: 'OctaVis 디코더',
    dec_method1_label: '광학 미디어 파일 업로드 (.png / .webm)',
    dec_method1_hint: '생성된 .png 이미지나 .webm 영상을 올리면 WASM이 즉시 원본 파일로 복원하여 다운로드합니다.',
    dec_divider: '또는',
    dec_method2_label: '실시간 카메라 스캐너',
    btn_cam_toggle: '카메라 스캐너 시작 / 정지',
    dec_pass_label: '복호화 비밀 키 / 패스프레이즈',
    dec_pass_placeholder: '암호화 또는 가변 프리앰블 적용 시 필수 입력',
    btn_wipe_mem: '메모리 즉시 파기 (Wipe)',

    // OctaZip Tab
    zip_enc_title: 'OctaZip 패키지 인코더',
    zip_enc_hint: '입력 파일이나 텍스트를 고속 압축/암호화하여 즉시 *.octazip 파일로 변환하여 다운로드합니다.',
    zip_btn_encode: '.octazip으로 변환 및 다운로드',
    zip_dec_title: 'OctaZip 패키지 디코더',
    zip_dec_label: '복구할 .octazip 파일 업로드',
    zip_dec_hint: '수신한 *.octazip 파일을 올리면 WASM이 압축과 암호를 해제하여 원본 파일로 즉시 다운로드합니다.',
    zip_btn_decode: '.octazip 복구 및 원본 파일 다운로드',
  },
  zh: {
    title: 'OctaVis & OctaZip (v1.1)',
    subtitle: '六边形网格光学介质（.png/.webm）与二进制包归档器（.octazip）',
    badge: '🛡️ 气隙隔离 / 零数据遥测：所有转换、加密与还原操作均在本地 WebAssembly 沙箱内离线执行。',
    tab_octavis: 'OctaVis (光学 .png / .webm)',
    tab_octazip: 'OctaZip (二进制 .octazip)',
    
    // OctaVis Encoder
    enc_title: 'OctaVis 编码器',
    enc_file_label: '选择要转换的文件',
    enc_text_label: '或直接输入文本',
    enc_pass_label: '密码 / 密钥 (ChaCha20 加密与变色龙前导码)',
    enc_pass_placeholder: '留空表示明文/默认色，输入密码启用加密与前导码多态化',
    enc_mode_static: '静态图片 (PNG)',
    enc_mode_video: '视频流 (WebM)',
    enc_camouflage: '伪装图形模式 (游戏/雷达 UI 风格)',
    btn_encode: '转换并下载文件',
    
    // OctaVis Decoder
    dec_title: 'OctaVis 解码器',
    dec_method1_label: '上传光学介质文件 (.png / .webm)',
    dec_method1_hint: '上传生成的 .png 图片或 .webm 视频，WASM 将立即还原并自动下载原始文件。',
    dec_divider: '或',
    dec_method2_label: '实时摄像头扫描',
    btn_cam_toggle: '开启 / 停止摄像头扫描',
    dec_pass_label: '解密密码 / 密钥',
    dec_pass_placeholder: '如流已加密或使用自定义前导码，则为必填项',
    btn_wipe_mem: '立即粉碎内存 (Zeroize)',

    // OctaZip Tab
    zip_enc_title: 'OctaZip 打包编码器',
    zip_enc_hint: '将输入文件或文本快速压缩加密，直接转换为 *.octazip 文件并下载。',
    zip_btn_encode: '转换为 .octazip 并下载',
    zip_dec_title: 'OctaZip 还原解码器',
    zip_dec_label: '上传要还原的 .octazip 文件',
    zip_dec_hint: '上传 *.octazip 归档文件，WASM 将解压并解密，直接下载还原的原始文件。',
    zip_btn_decode: '解码 .octazip 并下载原始文件',
  }
};
