export type Lang = 'en' | 'ko' | 'zh';

export const translations = {
  en: {
    title: 'OctaVis & OctaZip (v1.1)',
    subtitle: '60-Cell Hexagonal Grid (10,621 Cells) Optical Codec & Dense Text Serialization',
    badge: '🛡️ Air-Gapped / Zero-Telemetry: All cryptographic, compression, and decoding operations run strictly inside browser WebAssembly sandbox.',
    tab_octavis: 'OctaVis (Optical Image/Video)',
    tab_octazip: 'OctaZip (Text Armor Serialization)',
    
    // OctaVis Encoder
    enc_title: 'Encoder',
    enc_file_label: 'Select File to Transmit',
    enc_text_label: 'Or Enter Text Directly',
    enc_pass_label: 'Secret Passphrase (ChaCha20 Encryption & Chameleon Preamble)',
    enc_pass_placeholder: 'Leave blank for plaintext, or enter to enable ChaCha20-Poly1305 & polymorphic preamble',
    enc_mode_static: 'Static Image (PNG)',
    enc_mode_video: 'Video Stream (WebM)',
    enc_camouflage: 'Camouflage Graphic Mode (Game/Radar UI Style)',
    btn_encode: 'Generate Encode',
    btn_download_png: 'Download PNG Image',
    btn_download_webm: 'Download WebM Video',
    
    // OctaVis Decoder
    dec_title: 'Decoder',
    dec_method1_label: 'Method 1: Direct Image / Video File Upload',
    dec_method1_hint: 'Drop .png, .webp, or .webm video files directly without camera capture.',
    dec_divider: 'OR',
    dec_method2_label: 'Method 2: Real-time Camera Scanner',
    btn_cam_toggle: 'Start / Stop Webcam Scanner',
    dec_pass_label: 'Decryption Passphrase',
    dec_pass_placeholder: 'Required if stream was encrypted or uses custom preamble',
    dec_recovered_label: 'Recovered Payload (In-Memory Only)',
    btn_download_file: 'Download Recovered File',
    btn_wipe_mem: 'Wipe Memory (Zeroize)',

    // OctaZip Tab
    zip_enc_title: 'OctaZip Text Armor Encoder',
    zip_enc_hint: 'Dense lossless text serialization for SNS, chat comments, and text-only channels',
    zip_btn_encode: 'Generate Text Armor',
    zip_btn_copy: 'Copy to Clipboard',
    zip_dec_title: 'OctaZip Text Armor Decoder',
    zip_dec_label: 'Paste Received OctaZip Text Armor',
    zip_btn_decode: 'Decode Text Armor (WASM)',
  },
  ko: {
    title: 'OctaVis & OctaZip (v1.1)',
    subtitle: '60셀 육각 격자(10,621칸) 광학 미디어 & 고밀도 텍스트 직렬화 코덱',
    badge: '🛡️ Air-Gapped / Zero-Telemetry: 모든 암호화, 압축, 해독은 브라우저 WebAssembly 격리 샌드박스 내부에서만 실행됩니다.',
    tab_octavis: 'OctaVis (광학 이미지/비디오)',
    tab_octazip: 'OctaZip (텍스트 아머 직렬화)',
    
    // OctaVis Encoder
    enc_title: '인코더 (Encoder)',
    enc_file_label: '전송할 파일 선택',
    enc_text_label: '또는 텍스트 직접 입력',
    enc_pass_label: '비밀 키 / 패스프레이즈 (ChaCha20 암호화 & 카멜레온 프리앰블)',
    enc_pass_placeholder: '비우면 평문/기본색, 입력 시 ChaCha20-Poly1305 암호화 & 프리앰블 가변화',
    enc_mode_static: '정적 이미지 (PNG)',
    enc_mode_video: '비디오 스트림 (WebM)',
    enc_camouflage: '위장형 그래픽 모드 (게임/레이더 UI 위장)',
    btn_encode: '인코드 생성',
    btn_download_png: 'PNG 이미지 다운로드',
    btn_download_webm: 'WebM 비디오 다운로드',
    
    // OctaVis Decoder
    dec_title: '디코더 (Decoder)',
    dec_method1_label: '방법 1: 정적 이미지 / 비디오 파일 첨부 (직접 수신)',
    dec_method1_hint: '카메라 촬영 없이 .png, .webp 또는 .webm 비디오 파일을 직접 넣어 즉시 복원합니다.',
    dec_divider: '또는',
    dec_method2_label: '방법 2: 실시간 카메라 스캔',
    btn_cam_toggle: '웹캠 스캐너 시작 / 정지',
    dec_pass_label: '복호화 비밀 키 / 패스프레이즈',
    dec_pass_placeholder: '암호화 또는 가변 프리앰블 적용 시 필수 입력',
    dec_recovered_label: '복원된 데이터 (오프라인 메모리 내 유지)',
    btn_download_file: '복원 파일 다운로드',
    btn_wipe_mem: '메모리 즉시 파기 (Wipe)',

    // OctaZip Tab
    zip_enc_title: 'OctaZip 텍스트 아머 인코더',
    zip_enc_hint: 'SNS, 메신저 댓글, 이메일 본문 등 텍스트 채널을 위한 고밀도 무손실 직렬화 규격',
    zip_btn_encode: '텍스트 아머 생성',
    zip_btn_copy: '클립보드에 복사',
    zip_dec_title: 'OctaZip 텍스트 아머 디코더',
    zip_dec_label: '수신한 OctaZip 텍스트 아머 붙여넣기',
    zip_btn_decode: '텍스트 아머 복원 (WASM 해독)',
  },
  zh: {
    title: 'OctaVis & OctaZip (v1.1)',
    subtitle: '60格正六边形网格（10,621格）光学介质与高密度文本序列化编解码器',
    badge: '🛡️ 气隙隔离 / 零数据遥测 (Air-Gapped / Zero-Telemetry)：所有加密、压缩与解码运算均在浏览器 WebAssembly 沙箱内完全离线执行。',
    tab_octavis: 'OctaVis (光学图像/视频)',
    tab_octazip: 'OctaZip (文本装甲序列化)',
    
    // OctaVis Encoder
    enc_title: '编码器 (Encoder)',
    enc_file_label: '选择要传输的文件',
    enc_text_label: '或直接输入文本',
    enc_pass_label: '密码 / 密钥 (ChaCha20 加密与变色龙前导码)',
    enc_pass_placeholder: '留空表示明文/默认色，输入密码启用 ChaCha20-Poly1305 加密与前导码多态化',
    enc_mode_static: '静态图片 (PNG)',
    enc_mode_video: '视频流 (WebM)',
    enc_camouflage: '伪装图形模式 (游戏/雷达 UI 风格)',
    btn_encode: '生成编码',
    btn_download_png: '下载 PNG 图片',
    btn_download_webm: '下载 WebM 视频',
    
    // OctaVis Decoder
    dec_title: '解码器 (Decoder)',
    dec_method1_label: '方式 1：直接上传图片 / 视频文件（免拍摄）',
    dec_method1_hint: '无需摄像头拍摄，直接上传 .png、.webp 或 .webm 视频文件即可瞬间恢复。',
    dec_divider: '或',
    dec_method2_label: '方式 2：实时摄像头扫描',
    btn_cam_toggle: '开启 / 停止摄像头扫描',
    dec_pass_label: '解密密码 / 密钥',
    dec_pass_placeholder: '如流已加密或使用自定义前导码，则为必填项',
    dec_recovered_label: '恢复的数据 (仅保留在本地内存)',
    btn_download_file: '下载恢复的文件',
    btn_wipe_mem: '立即粉碎内存 (Zeroize)',

    // OctaZip Tab
    zip_enc_title: 'OctaZip 文本装甲编码器',
    zip_enc_hint: '专为社交媒体、聊天评论、电子邮件正文等纯文本渠道设计的高密度无损序列化规范',
    zip_btn_encode: '生成文本装甲',
    zip_btn_copy: '复制到剪贴板',
    zip_dec_title: 'OctaZip 文本装甲解码器',
    zip_dec_label: '粘贴收到的 OctaZip 文本装甲',
    zip_btn_decode: '还原文本装甲 (WASM 解码)',
  }
};
