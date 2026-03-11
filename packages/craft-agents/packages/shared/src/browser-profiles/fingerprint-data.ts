/**
 * Fingerprint Data Pools
 *
 * Realistic fingerprint data for generating convincing browser fingerprints.
 */

/**
 * Common User Agents (Chrome on Windows, macOS, Linux)
 *
 * NOTE: These are fallback values used when automatic browser version detection fails.
 * The preferred method is to dynamically generate User Agent strings matching the
 * actual installed browser version using detectBrowserVersion() and generateUserAgent().
 *
 * IMPORTANT: Use REAL Chrome version numbers from actual releases to avoid fingerprint detection.
 * Versions like "142.0.0.0" are detectable - use real build numbers like "142.0.7444.135"
 * Source: https://chromiumdash.appspot.com/releases
 */
export const USER_AGENTS = [
  // Windows Chrome 142.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.135 Safari/537.36',
    platform: 'Win32',
    appVersion:
      '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.135 Safari/537.36',
  },
  // Windows Chrome 141.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7278.98 Safari/537.36',
    platform: 'Win32',
    appVersion:
      '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7278.98 Safari/537.36',
  },
  // Windows Chrome 140.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7243.122 Safari/537.36',
    platform: 'Win32',
    appVersion:
      '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7243.122 Safari/537.36',
  },
  // macOS Chrome 142.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.135 Safari/537.36',
    platform: 'MacIntel',
    appVersion:
      '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.135 Safari/537.36',
  },
  // macOS Chrome 141.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7278.98 Safari/537.36',
    platform: 'MacIntel',
    appVersion:
      '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7278.98 Safari/537.36',
  },
  // macOS Chrome 140.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7243.122 Safari/537.36',
    platform: 'MacIntel',
    appVersion:
      '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7243.122 Safari/537.36',
  },
  // Linux Chrome 142.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.135 Safari/537.36',
    platform: 'Linux x86_64',
    appVersion:
      '5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.135 Safari/537.36',
  },
  // Linux Chrome 141.x (real stable version)
  {
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7278.98 Safari/537.36',
    platform: 'Linux x86_64',
    appVersion:
      '5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7278.98 Safari/537.36',
  },
]

/**
 * WebGL data grouped by platform for OS/GPU consistency.
 *
 * - Windows: ANGLE renderers with Direct3D11 backend
 * - macOS: ANGLE renderers with Metal backend (Apple GPUs only)
 * - Linux: Mesa/Gallium renderers or llvmpipe software rendering
 *
 * Selecting from the correct platform pool prevents BrowserScan-style detectors
 * from flagging OS/GPU mismatches (e.g. Apple GPU on Windows).
 */
export const WEBGL_DATA_BY_PLATFORM: Record<
  string,
  {
    vendors: string[]
    renderers: Record<string, string[]>
  }
> = {
  windows: {
    vendors: [
      'Google Inc. (Intel)',
      'Google Inc. (NVIDIA)',
      'Google Inc. (AMD)',
    ],
    renderers: {
      'Google Inc. (Intel)': [
        'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (Intel, Intel(R) Iris(R) Plus Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (Intel, Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ],
      'Google Inc. (NVIDIA)': [
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (AMD, AMD Radeon RX 6800 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (AMD, AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ],
    },
  },
  macos: {
    vendors: ['Google Inc. (Apple)'],
    renderers: {
      'Google Inc. (Apple)': [
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)',
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)',
      ],
    },
  },
  linux: {
    // Chrome 113+ defaults to ANGLE on Linux. The vendor/renderer strings are
    // ANGLE-wrapped, not raw Mesa strings. Detection sites flag raw Mesa format.
    vendors: ['Google Inc. (Intel)', 'Google Inc. (AMD)'],
    renderers: {
      'Google Inc. (Intel)': [
        'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
        'ANGLE (Intel, Mesa Intel(R) HD Graphics 530 (SKL GT2), OpenGL 4.6)',
        'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)',
        'ANGLE (Intel, Mesa Intel(R) UHD Graphics 770 (ADL-S GT1), OpenGL 4.6)',
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD, AMD Radeon RX 580 (polaris10, LLVM 15.0.6, DRM 3.49, 6.1.0-1-amd64), OpenGL 4.6)',
        'ANGLE (AMD, AMD Radeon RX 5700 XT (navi10, LLVM 15.0.6, DRM 3.49, 6.1.0-1-amd64), OpenGL 4.6)',
        'ANGLE (AMD, AMD Radeon RX 6800 (navi21, LLVM 15.0.6, DRM 3.49, 6.1.0-1-amd64), OpenGL 4.6)',
      ],
    },
  },
}

/**
 * WebGPU adapter info data by platform.
 *
 * Maps WebGL vendor/renderer selections to matching WebGPU adapter info,
 * ensuring GPU fingerprint consistency across APIs.
 *
 * - vendor: GPU manufacturer (e.g. "intel", "nvidia", "apple")
 * - architecture: GPU architecture family
 * - device: Device ID hex string (matches real hardware IDs)
 * - description: Human-readable GPU model name
 */
export const WEBGPU_DATA_BY_PLATFORM: Record<
  string,
  Array<{
    webglVendorPrefix: string
    vendor: string
    architecture: string
    devices: Array<{ device: string; description: string }>
  }>
> = {
  windows: [
    {
      webglVendorPrefix: 'Google Inc. (Intel)',
      vendor: 'intel',
      architecture: 'gen-12lp',
      devices: [
        { device: '0x9a49', description: 'Intel(R) Iris(R) Xe Graphics' },
        { device: '0x3e92', description: 'Intel(R) UHD Graphics 630' },
        { device: '0x5917', description: 'Intel(R) UHD Graphics 620' },
        { device: '0x3ea0', description: 'Intel(R) Iris(R) Plus Graphics' },
        { device: '0x5912', description: 'Intel(R) HD Graphics 630' },
      ],
    },
    {
      webglVendorPrefix: 'Google Inc. (NVIDIA)',
      vendor: 'nvidia',
      architecture: 'turing',
      devices: [
        { device: '0x1b80', description: 'NVIDIA GeForce GTX 1080' },
        { device: '0x2504', description: 'NVIDIA GeForce RTX 3060' },
        { device: '0x2484', description: 'NVIDIA GeForce RTX 3070' },
        { device: '0x2786', description: 'NVIDIA GeForce RTX 4070' },
        { device: '0x2182', description: 'NVIDIA GeForce GTX 1660 Ti' },
      ],
    },
    {
      webglVendorPrefix: 'Google Inc. (AMD)',
      vendor: 'amd',
      architecture: 'gcn-5',
      devices: [
        { device: '0x67df', description: 'AMD Radeon RX 580' },
        { device: '0x73bf', description: 'AMD Radeon RX 6800' },
        { device: '0x731f', description: 'AMD Radeon RX 5700 XT' },
        { device: '0x744c', description: 'AMD Radeon RX 7900 XTX' },
      ],
    },
  ],
  macos: [
    {
      webglVendorPrefix: 'Google Inc. (Apple)',
      vendor: 'apple',
      architecture: 'common-3',
      devices: [
        { device: '0x0000', description: 'Apple M1' },
        { device: '0x0000', description: 'Apple M1 Pro' },
        { device: '0x0000', description: 'Apple M1 Max' },
        { device: '0x0000', description: 'Apple M2' },
        { device: '0x0000', description: 'Apple M2 Pro' },
        { device: '0x0000', description: 'Apple M2 Max' },
        { device: '0x0000', description: 'Apple M3' },
        { device: '0x0000', description: 'Apple M3 Pro' },
        { device: '0x0000', description: 'Apple M4' },
      ],
    },
  ],
  linux: [
    {
      webglVendorPrefix: 'Google Inc. (Intel)',
      vendor: 'intel',
      architecture: 'gen-12lp',
      devices: [
        { device: '0x3e92', description: 'Mesa Intel(R) UHD Graphics 630' },
        { device: '0x1912', description: 'Mesa Intel(R) HD Graphics 530' },
        { device: '0x5917', description: 'Mesa Intel(R) UHD Graphics 620' },
        { device: '0x4680', description: 'Mesa Intel(R) UHD Graphics 770' },
      ],
    },
    {
      webglVendorPrefix: 'Google Inc. (AMD)',
      vendor: 'amd',
      architecture: 'gcn-5',
      devices: [
        { device: '0x67df', description: 'AMD Radeon RX 580' },
        { device: '0x731f', description: 'AMD Radeon RX 5700 XT' },
        { device: '0x73bf', description: 'AMD Radeon RX 6800' },
      ],
    },
  ],
}

/**
 * Mobile device profiles for mobile emulation
 * Based on real device specifications for convincing mobile fingerprints
 */
export const MOBILE_DEVICE_PROFILES = [
  {
    name: 'Samsung Galaxy S24',
    uaFragment: 'Linux; Android 14; SM-S921B',
    screen: { width: 412, height: 915, availHeight: 873 },
    dpr: 2.625,
    maxTouchPoints: 5,
    platform: 'Linux armv81',
  },
  {
    name: 'Samsung Galaxy S23',
    uaFragment: 'Linux; Android 13; SM-S911B',
    screen: { width: 393, height: 851, availHeight: 809 },
    dpr: 2.625,
    maxTouchPoints: 5,
    platform: 'Linux armv81',
  },
  {
    name: 'Google Pixel 8',
    uaFragment: 'Linux; Android 14; Pixel 8',
    screen: { width: 412, height: 915, availHeight: 873 },
    dpr: 2.625,
    maxTouchPoints: 5,
    platform: 'Linux armv81',
  },
  {
    name: 'Google Pixel 7',
    uaFragment: 'Linux; Android 13; Pixel 7',
    screen: { width: 412, height: 915, availHeight: 873 },
    dpr: 2.625,
    maxTouchPoints: 5,
    platform: 'Linux armv81',
  },
  {
    name: 'iPhone 15 Pro',
    uaFragment: 'iPhone; CPU iPhone OS 17_4 like Mac OS X',
    screen: { width: 393, height: 852, availHeight: 814 },
    dpr: 3,
    maxTouchPoints: 5,
    platform: 'iPhone',
  },
  {
    name: 'iPhone 15',
    uaFragment: 'iPhone; CPU iPhone OS 17_4 like Mac OS X',
    screen: { width: 390, height: 844, availHeight: 806 },
    dpr: 3,
    maxTouchPoints: 5,
    platform: 'iPhone',
  },
  {
    name: 'iPhone 14',
    uaFragment: 'iPhone; CPU iPhone OS 16_6 like Mac OS X',
    screen: { width: 390, height: 844, availHeight: 806 },
    dpr: 3,
    maxTouchPoints: 5,
    platform: 'iPhone',
  },
  {
    name: 'Xiaomi 14',
    uaFragment: 'Linux; Android 14; 23127PN0CC',
    screen: { width: 393, height: 873, availHeight: 831 },
    dpr: 2.75,
    maxTouchPoints: 5,
    platform: 'Linux armv81',
  },
  {
    name: 'OnePlus 12',
    uaFragment: 'Linux; Android 14; CPH2573',
    screen: { width: 412, height: 915, availHeight: 873 },
    dpr: 3.5,
    maxTouchPoints: 5,
    platform: 'Linux armv81',
  },
]

/**
 * Common screen resolutions
 */
export const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080, availHeight: 1040 },
  { width: 1920, height: 1080, availHeight: 1050 },
  { width: 1366, height: 768, availHeight: 728 },
  { width: 1536, height: 864, availHeight: 824 },
  { width: 2560, height: 1440, availHeight: 1400 },
  { width: 1440, height: 900, availHeight: 860 },
  { width: 1680, height: 1050, availHeight: 1010 },
  { width: 1280, height: 720, availHeight: 680 },
  { width: 1600, height: 900, availHeight: 860 },
  { width: 2560, height: 1080, availHeight: 1040 },
]

/**
 * Common timezones with their UTC offsets in minutes
 */
export const TIMEZONES = [
  { name: 'America/New_York', offset: -300 },
  { name: 'America/Chicago', offset: -360 },
  { name: 'America/Denver', offset: -420 },
  { name: 'America/Los_Angeles', offset: -480 },
  { name: 'America/Phoenix', offset: -420 },
  { name: 'America/Toronto', offset: -300 },
  { name: 'Europe/London', offset: 0 },
  { name: 'Europe/Paris', offset: 60 },
  { name: 'Europe/Berlin', offset: 60 },
  { name: 'Europe/Moscow', offset: 180 },
  { name: 'Asia/Tokyo', offset: 540 },
  { name: 'Asia/Shanghai', offset: 480 },
  { name: 'Asia/Singapore', offset: 480 },
  { name: 'Asia/Hong_Kong', offset: 480 },
  { name: 'Asia/Seoul', offset: 540 },
  { name: 'Australia/Sydney', offset: 660 },
  { name: 'Pacific/Auckland', offset: 780 },
]

/**
 * Language configurations
 */
export const LANGUAGES = [
  { language: 'en-US', languages: ['en-US', 'en'] },
  { language: 'en-GB', languages: ['en-GB', 'en'] },
  { language: 'zh-CN', languages: ['zh-CN', 'zh', 'en-US', 'en'] },
  { language: 'zh-TW', languages: ['zh-TW', 'zh', 'en-US', 'en'] },
  { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en-US', 'en'] },
  { language: 'ko-KR', languages: ['ko-KR', 'ko', 'en-US', 'en'] },
  { language: 'de-DE', languages: ['de-DE', 'de', 'en-US', 'en'] },
  { language: 'fr-FR', languages: ['fr-FR', 'fr', 'en-US', 'en'] },
  { language: 'es-ES', languages: ['es-ES', 'es', 'en-US', 'en'] },
  { language: 'pt-BR', languages: ['pt-BR', 'pt', 'en-US', 'en'] },
]

/**
 * Common fonts for font fingerprinting
 */
export const FONTS: Record<string, string[]> = {
  windows: [
    // Core system fonts (Windows 10/11)
    'Arial',
    'Arial Black',
    'Arial Narrow',
    'Bahnschrift',
    'Calibri',
    'Calibri Light',
    'Cambria',
    'Cambria Math',
    'Candara',
    'Candara Light',
    'Comic Sans MS',
    'Consolas',
    'Constantia',
    'Corbel',
    'Corbel Light',
    'Courier',
    'Courier New',
    'Ebrima',
    'Franklin Gothic Medium',
    'Gabriola',
    'Gadugi',
    'Georgia',
    'HoloLens MDL2 Assets',
    'Helvetica',
    'Impact',
    'Ink Free',
    'Javanese Text',
    'Leelawadee UI',
    'Leelawadee UI Semilight',
    'Lucida Console',
    'Lucida Sans Unicode',
    'Malgun Gothic',
    'Malgun Gothic Semilight',
    'Marlett',
    'Microsoft Himalaya',
    'Microsoft JhengHei',
    'Microsoft JhengHei Light',
    'Microsoft JhengHei UI',
    'Microsoft JhengHei UI Light',
    'Microsoft New Tai Lue',
    'Microsoft PhagsPa',
    'Microsoft Sans Serif',
    'Microsoft Tai Le',
    'Microsoft YaHei',
    'Microsoft YaHei Light',
    'Microsoft YaHei UI',
    'Microsoft YaHei UI Light',
    'Microsoft Yi Baiti',
    'MingLiU-ExtB',
    'MingLiU_HKSCS-ExtB',
    'Mongolian Baiti',
    'MS Gothic',
    'MS PGothic',
    'MS UI Gothic',
    'MV Boli',
    'Myanmar Text',
    'Nirmala UI',
    'Nirmala UI Semilight',
    'Noto Sans',
    'Noto Serif',
    'Noto Color Emoji',
    'Palatino Linotype',
    'PMingLiU-ExtB',
    'Roboto',
    'Open Sans',
    'Inter',
    'Segoe Fluent Icons',
    'Segoe MDL2 Assets',
    'Segoe Print',
    'Segoe Script',
    'Segoe UI',
    'Segoe UI Black',
    'Segoe UI Emoji',
    'Segoe UI Historic',
    'Segoe UI Light',
    'Segoe UI Semibold',
    'Segoe UI Semilight',
    'Segoe UI Symbol',
    'Segoe UI Variable',
    'SimSun',
    'SimSun-ExtB',
    'Sitka Banner',
    'Sitka Display',
    'Sitka Heading',
    'Sitka Small',
    'Sitka Subheading',
    'Sitka Text',
    'Sylfaen',
    'Symbol',
    'Tahoma',
    'Times',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
    'Webdings',
    'Wingdings',
    'Wingdings 2',
    'Wingdings 3',
    'Yu Gothic',
    'Yu Gothic Light',
    'Yu Gothic Medium',
    'Yu Gothic UI',
    'Yu Gothic UI Light',
    'Yu Gothic UI Regular',
    'Yu Gothic UI Semibold',
    'Yu Gothic UI Semilight',
    // Common installed fonts (Office, browsers, popular apps)
    'Book Antiqua',
    'Bookman Old Style',
    'Century',
    'Century Gothic',
    'Century Schoolbook',
    'Copperplate Gothic Bold',
    'Copperplate Gothic Light',
    'Garamond',
    'Gill Sans MT',
    'Goudy Old Style',
    'Haettenschweiler',
    'Lucida Bright',
    'Lucida Calligraphy',
    'Lucida Fax',
    'Lucida Handwriting',
    'Lucida Sans',
    'Lucida Sans Typewriter',
    'Maiandra GD',
    'MS Reference Sans Serif',
    'MS Reference Specialty',
    'MT Extra',
    'OCR A Extended',
    'Perpetua',
    'Perpetua Titling MT',
    'Rockwell',
    'Rockwell Condensed',
    'Rockwell Extra Bold',
    'Script MT Bold',
    'Tw Cen MT',
    'Tw Cen MT Condensed',
    // Google/Web fonts commonly installed
    'Lato',
    'Montserrat',
    'Oswald',
    'Poppins',
    'Raleway',
    'Source Code Pro',
    'Source Sans Pro',
    'Source Serif Pro',
    'Ubuntu',
    'Fira Code',
    'Fira Sans',
    'PT Sans',
    'PT Serif',
    'PT Mono',
    'Merriweather',
    'Playfair Display',
    'Nunito',
    'Nunito Sans',
    'Work Sans',
    'Quicksand',
    'Barlow',
    'Rubik',
    'Karla',
    'Inconsolata',
    'JetBrains Mono',
    'Cascadia Code',
    'Cascadia Mono',
    // CJK fonts (common on Windows)
    'DengXian',
    'DengXian Light',
    'FangSong',
    'KaiTi',
    'NSimSun',
    'STCaiyun',
    'STFangsong',
    'STHupo',
    'STKaiti',
    'STLiti',
    'STSong',
    'STXihei',
    'STXinwei',
    'STXingkai',
    'STZhongsong',
    'YouYuan',
    'LiSu',
    'Meiryo',
    'Meiryo UI',
    'MS Mincho',
    'MS PMincho',
    'BatangChe',
    'Dotum',
    'DotumChe',
    'Gulim',
    'GulimChe',
    'Gungsuh',
    'GungsuhChe',
  ],
  macos: [
    // Core system fonts (macOS 13+)
    'American Typewriter',
    'Andale Mono',
    'Apple Braille',
    'Apple Color Emoji',
    'Apple SD Gothic Neo',
    'Apple Symbols',
    'Arial',
    'Arial Black',
    'Arial Hebrew',
    'Arial Narrow',
    'Arial Rounded MT Bold',
    'Arial Unicode MS',
    'Avenir',
    'Avenir Next',
    'Avenir Next Condensed',
    'Baskerville',
    'Big Caslon',
    'Bodoni 72',
    'Bodoni 72 Oldstyle',
    'Bodoni 72 Smallcaps',
    'Bodoni Ornaments',
    'Bradley Hand',
    'Brush Script MT',
    'Chalkboard',
    'Chalkboard SE',
    'Chalkduster',
    'Charter',
    'Cochin',
    'Comic Sans MS',
    'Copperplate',
    'Corsiva Hebrew',
    'Courier',
    'Courier New',
    'Damascus',
    'DecoType Naskh',
    'Devanagari MT',
    'Didot',
    'DIN Alternate',
    'DIN Condensed',
    'Euphemia UCAS',
    'Futura',
    'Galvji',
    'Geneva',
    'Georgia',
    'Gill Sans',
    'Grantha Sangam MN',
    'Helvetica',
    'Helvetica Neue',
    'Herculanum',
    'Hiragino Kaku Gothic ProN',
    'Hiragino Maru Gothic ProN',
    'Hiragino Mincho ProN',
    'Hiragino Sans',
    'Hiragino Sans GB',
    'Hoefler Text',
    'Impact',
    'InaiMathi',
    'Iowan Old Style',
    'Kailasa',
    'Kannada Sangam MN',
    'Kefa',
    'Khmer Sangam MN',
    'Kohinoor Bangla',
    'Kohinoor Devanagari',
    'Kohinoor Gujarati',
    'Kohinoor Telugu',
    'Lao Sangam MN',
    'Lucida Grande',
    'Luminari',
    'Malayalam Sangam MN',
    'Marker Felt',
    'Menlo',
    'Microsoft Sans Serif',
    'Monaco',
    'Mukta Mahee',
    'Muna',
    'Myanmar Sangam MN',
    'Nadeem',
    'New Peninim MT',
    'Noteworthy',
    'Noto Sans',
    'Noto Sans Kannada',
    'Noto Serif',
    'Noto Serif Myanmar',
    'Noto Color Emoji',
    'Optima',
    'Oriya Sangam MN',
    'Palatino',
    'Papyrus',
    'Party LET',
    'Phosphate',
    'PingFang HK',
    'PingFang SC',
    'PingFang TC',
    'Plantagenet Cherokee',
    'PT Mono',
    'PT Sans',
    'PT Sans Caption',
    'PT Sans Narrow',
    'PT Serif',
    'PT Serif Caption',
    'Raanana',
    'Rockwell',
    'Savoye LET',
    'SF Mono',
    'SF Pro Display',
    'SF Pro Rounded',
    'SF Pro Text',
    'Shree Devanagari 714',
    'SignPainter',
    'Silom',
    'Sinhala Sangam MN',
    'Skia',
    'Snell Roundhand',
    'Songti SC',
    'Songti TC',
    'STIXGeneral',
    'STIXIntegralsD',
    'STIXIntegralsSm',
    'STIXIntegralsUp',
    'STIXIntegralsUpD',
    'STIXIntegralsUpSm',
    'STIXNonUnicode',
    'STIXSizeFiveSym',
    'STIXSizeFourSym',
    'STIXSizeOneSym',
    'STIXSizeThreeSym',
    'STIXSizeTwoSym',
    'STIXVariants',
    'Sukhumvit Set',
    'Symbol',
    'Tahoma',
    'Tamil Sangam MN',
    'Telugu Sangam MN',
    'Thonburi',
    'Times',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
    'Waseem',
    'Webdings',
    'Wingdings',
    'Wingdings 2',
    'Wingdings 3',
    'Zapf Dingbats',
    'Zapfino',
    // Common installed fonts
    'Roboto',
    'Open Sans',
    'Inter',
    'Lato',
    'Montserrat',
    'Source Code Pro',
    'Source Sans Pro',
    'Fira Code',
    'JetBrains Mono',
    '-apple-system',
    'BlinkMacSystemFont',
    'system-ui',
  ],
  linux: [
    'Arial',
    'Cantarell',
    'Century Schoolbook L',
    'Courier',
    'Courier 10 Pitch',
    'Courier New',
    'DejaVu Sans',
    'DejaVu Sans Condensed',
    'DejaVu Sans Mono',
    'DejaVu Serif',
    'DejaVu Serif Condensed',
    'Droid Sans',
    'Droid Sans Mono',
    'Droid Serif',
    'FreeMono',
    'FreeSans',
    'FreeSerif',
    'Georgia',
    'Helvetica',
    'Liberation Mono',
    'Liberation Sans',
    'Liberation Sans Narrow',
    'Liberation Serif',
    'Nimbus Mono L',
    'Nimbus Mono PS',
    'Nimbus Roman',
    'Nimbus Roman No9 L',
    'Nimbus Sans',
    'Nimbus Sans L',
    'Nimbus Sans Narrow',
    'Noto Color Emoji',
    'Noto Mono',
    'Noto Sans',
    'Noto Sans Arabic',
    'Noto Sans CJK JP',
    'Noto Sans CJK KR',
    'Noto Sans CJK SC',
    'Noto Sans CJK TC',
    'Noto Sans Devanagari',
    'Noto Sans Display',
    'Noto Sans Mono',
    'Noto Sans Thai',
    'Noto Serif',
    'Noto Serif CJK JP',
    'Noto Serif CJK SC',
    'Noto Serif Display',
    'Roboto',
    'Roboto Condensed',
    'Roboto Mono',
    'Roboto Slab',
    'Times New Roman',
    'Ubuntu',
    'Ubuntu Condensed',
    'Ubuntu Light',
    'Ubuntu Mono',
    'Open Sans',
    'Inter',
    'Lato',
    'Fira Code',
    'Fira Mono',
    'Fira Sans',
    'Source Code Pro',
    'Source Sans Pro',
    'Source Serif Pro',
    'PT Sans',
    'PT Serif',
    'PT Mono',
    'Droid Sans Fallback',
    'WenQuanYi Micro Hei',
    'WenQuanYi Zen Hei',
    'WenQuanYi Zen Hei Mono',
    'AR PL UMing CN',
    'AR PL UKai CN',
    'Takao Gothic',
    'Takao Mincho',
    'VL Gothic',
    'IPAGothic',
    'IPAMincho',
    'IPAPGothic',
    'IPAPMincho',
    'Baekmuk Dotum',
    'Baekmuk Gulim',
    'UnDotum',
    'UnBatang',
  ],
}

export const MEDIA_DEVICES: Record<
  string,
  { kind: 'audioinput' | 'audiooutput' | 'videoinput'; label: string }[]
> = {
  windows: [
    { kind: 'audioinput', label: 'Microphone (Realtek(R) Audio)' },
    { kind: 'audiooutput', label: 'Speakers (Realtek(R) Audio)' },
    { kind: 'videoinput', label: 'Integrated Camera' },
  ],
  macos: [
    { kind: 'audioinput', label: 'Built-in Microphone' },
    { kind: 'audiooutput', label: 'Built-in Output' },
    { kind: 'videoinput', label: 'FaceTime HD Camera' },
  ],
  linux: [
    { kind: 'audioinput', label: 'Built-in Audio Analog Stereo' },
    { kind: 'audiooutput', label: 'Built-in Audio Analog Stereo' },
    { kind: 'videoinput', label: 'Integrated Webcam' },
  ],
}

export const DEFAULT_PLUGINS = [
  {
    name: 'PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      {
        type: 'application/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
      {
        type: 'text/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
    ],
  },
  {
    name: 'Chrome PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      {
        type: 'application/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
      {
        type: 'text/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
    ],
  },
  {
    name: 'Chromium PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      {
        type: 'application/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
      {
        type: 'text/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
    ],
  },
  {
    name: 'Microsoft Edge PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      {
        type: 'application/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
      {
        type: 'text/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
    ],
  },
  {
    name: 'WebKit built-in PDF',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      {
        type: 'application/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
      {
        type: 'text/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
      },
    ],
  },
]

export const DEFAULT_FONTS: Record<string, string[]> = {
  windows: [
    'Arial',
    'Calibri',
    'Cambria',
    'Courier New',
    'Georgia',
    'Segoe UI',
    'Segoe UI Emoji',
    'Tahoma',
    'Times New Roman',
    'Verdana',
  ],
  macos: [
    'Helvetica',
    'Helvetica Neue',
    'Times',
    'Courier',
    'Menlo',
    'Lucida Grande',
    'Verdana',
    'Arial',
    'Apple Color Emoji',
  ],
  linux: [
    'DejaVu Sans',
    'DejaVu Serif',
    'DejaVu Sans Mono',
    'Liberation Sans',
    'Liberation Serif',
    'Liberation Mono',
    'Ubuntu',
    'Noto Sans',
    'Noto Serif',
    'Noto Color Emoji',
  ],
}

/**
 * City coordinates for geolocation spoofing
 * Mapped to TIMEZONES for consistency
 */
export const CITY_COORDINATES: Array<{
  city: string
  country: string
  latitude: number
  longitude: number
  timezone: string
}> = [
  {
    city: 'New York',
    country: 'US',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
  },
  {
    city: 'Chicago',
    country: 'US',
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: 'America/Chicago',
  },
  {
    city: 'Denver',
    country: 'US',
    latitude: 39.7392,
    longitude: -104.9903,
    timezone: 'America/Denver',
  },
  {
    city: 'Los Angeles',
    country: 'US',
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: 'America/Los_Angeles',
  },
  {
    city: 'Phoenix',
    country: 'US',
    latitude: 33.4484,
    longitude: -112.074,
    timezone: 'America/Phoenix',
  },
  {
    city: 'Toronto',
    country: 'CA',
    latitude: 43.6532,
    longitude: -79.3832,
    timezone: 'America/Toronto',
  },
  {
    city: 'London',
    country: 'GB',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
  },
  {
    city: 'Paris',
    country: 'FR',
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: 'Europe/Paris',
  },
  {
    city: 'Berlin',
    country: 'DE',
    latitude: 52.52,
    longitude: 13.405,
    timezone: 'Europe/Berlin',
  },
  {
    city: 'Moscow',
    country: 'RU',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow',
  },
  {
    city: 'Tokyo',
    country: 'JP',
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: 'Asia/Tokyo',
  },
  {
    city: 'Shanghai',
    country: 'CN',
    latitude: 31.2304,
    longitude: 121.4737,
    timezone: 'Asia/Shanghai',
  },
  {
    city: 'Singapore',
    country: 'SG',
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: 'Asia/Singapore',
  },
  {
    city: 'Hong Kong',
    country: 'HK',
    latitude: 22.3193,
    longitude: 114.1694,
    timezone: 'Asia/Hong_Kong',
  },
  {
    city: 'Seoul',
    country: 'KR',
    latitude: 37.5665,
    longitude: 126.978,
    timezone: 'Asia/Seoul',
  },
  {
    city: 'Sydney',
    country: 'AU',
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: 'Australia/Sydney',
  },
  {
    city: 'Auckland',
    country: 'NZ',
    latitude: -36.8485,
    longitude: 174.7633,
    timezone: 'Pacific/Auckland',
  },
  {
    city: 'São Paulo',
    country: 'BR',
    latitude: -23.5505,
    longitude: -46.6333,
    timezone: 'America/Sao_Paulo',
  },
  {
    city: 'Mumbai',
    country: 'IN',
    latitude: 19.076,
    longitude: 72.8777,
    timezone: 'Asia/Kolkata',
  },
  {
    city: 'Dubai',
    country: 'AE',
    latitude: 25.2048,
    longitude: 55.2708,
    timezone: 'Asia/Dubai',
  },
]

/**
 * Speech synthesis voices by platform
 * Based on real browser voice lists per OS
 */
export const SPEECH_VOICES_BY_PLATFORM: Record<
  string,
  Array<{ name: string; lang: string; localService: boolean }>
> = {
  windows: [
    {
      name: 'Microsoft David - English (United States)',
      lang: 'en-US',
      localService: true,
    },
    {
      name: 'Microsoft Zira - English (United States)',
      lang: 'en-US',
      localService: true,
    },
    {
      name: 'Microsoft Mark - English (United States)',
      lang: 'en-US',
      localService: true,
    },
    { name: 'Google US English', lang: 'en-US', localService: false },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false },
    { name: 'Google UK English Male', lang: 'en-GB', localService: false },
    { name: 'Google Deutsch', lang: 'de-DE', localService: false },
    { name: 'Google español', lang: 'es-ES', localService: false },
    { name: 'Google français', lang: 'fr-FR', localService: false },
    { name: 'Google 日本語', lang: 'ja-JP', localService: false },
    { name: 'Google 한국의', lang: 'ko-KR', localService: false },
    { name: 'Google 普通话（中国大陆）', lang: 'zh-CN', localService: false },
  ],
  macos: [
    { name: 'Samantha', lang: 'en-US', localService: true },
    { name: 'Alex', lang: 'en-US', localService: true },
    { name: 'Victoria', lang: 'en-US', localService: true },
    { name: 'Daniel', lang: 'en-GB', localService: true },
    { name: 'Karen', lang: 'en-AU', localService: true },
    { name: 'Thomas', lang: 'fr-FR', localService: true },
    { name: 'Anna', lang: 'de-DE', localService: true },
    { name: 'Google US English', lang: 'en-US', localService: false },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false },
    { name: 'Google 日本語', lang: 'ja-JP', localService: false },
    { name: 'Google 普通话（中国大陆）', lang: 'zh-CN', localService: false },
  ],
  linux: [
    { name: 'Google US English', lang: 'en-US', localService: false },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false },
    { name: 'Google UK English Male', lang: 'en-GB', localService: false },
    { name: 'Google Deutsch', lang: 'de-DE', localService: false },
    { name: 'Google español', lang: 'es-ES', localService: false },
    { name: 'Google français', lang: 'fr-FR', localService: false },
    { name: 'Google 日本語', lang: 'ja-JP', localService: false },
    { name: 'Google 普通话（中国大陆）', lang: 'zh-CN', localService: false },
  ],
}

/**
 * Hardware concurrency options (CPU core counts)
 */
export const HARDWARE_CONCURRENCY = [2, 4, 6, 8, 12, 16]

/**
 * Device memory options (in GB)
 */
export const DEVICE_MEMORY = [2, 4, 8, 16, 32]

/**
 * Country code to language mapping
 * Used for automatic language selection based on proxy geolocation
 */
export const COUNTRY_LANGUAGES: Record<
  string,
  { language: string; languages: string[] }
> = {
  // North America
  US: { language: 'en-US', languages: ['en-US', 'en'] },
  CA: { language: 'en-CA', languages: ['en-CA', 'en', 'fr-CA', 'fr'] },
  MX: { language: 'es-MX', languages: ['es-MX', 'es', 'en-US', 'en'] },

  // Europe
  GB: { language: 'en-GB', languages: ['en-GB', 'en'] },
  DE: { language: 'de-DE', languages: ['de-DE', 'de', 'en-US', 'en'] },
  FR: { language: 'fr-FR', languages: ['fr-FR', 'fr', 'en-US', 'en'] },
  ES: { language: 'es-ES', languages: ['es-ES', 'es', 'en-US', 'en'] },
  IT: { language: 'it-IT', languages: ['it-IT', 'it', 'en-US', 'en'] },
  PT: { language: 'pt-PT', languages: ['pt-PT', 'pt', 'en-US', 'en'] },
  NL: { language: 'nl-NL', languages: ['nl-NL', 'nl', 'en-US', 'en'] },
  BE: {
    language: 'nl-BE',
    languages: ['nl-BE', 'nl', 'fr-BE', 'fr', 'en-US', 'en'],
  },
  AT: { language: 'de-AT', languages: ['de-AT', 'de', 'en-US', 'en'] },
  CH: {
    language: 'de-CH',
    languages: ['de-CH', 'de', 'fr-CH', 'fr', 'it-CH', 'it', 'en-US', 'en'],
  },
  PL: { language: 'pl-PL', languages: ['pl-PL', 'pl', 'en-US', 'en'] },
  SE: { language: 'sv-SE', languages: ['sv-SE', 'sv', 'en-US', 'en'] },
  NO: { language: 'nb-NO', languages: ['nb-NO', 'no', 'en-US', 'en'] },
  DK: { language: 'da-DK', languages: ['da-DK', 'da', 'en-US', 'en'] },
  FI: { language: 'fi-FI', languages: ['fi-FI', 'fi', 'en-US', 'en'] },
  IE: { language: 'en-IE', languages: ['en-IE', 'en', 'ga-IE'] },
  RU: { language: 'ru-RU', languages: ['ru-RU', 'ru', 'en-US', 'en'] },
  UA: {
    language: 'uk-UA',
    languages: ['uk-UA', 'uk', 'ru-RU', 'ru', 'en-US', 'en'],
  },
  CZ: { language: 'cs-CZ', languages: ['cs-CZ', 'cs', 'en-US', 'en'] },
  HU: { language: 'hu-HU', languages: ['hu-HU', 'hu', 'en-US', 'en'] },
  RO: { language: 'ro-RO', languages: ['ro-RO', 'ro', 'en-US', 'en'] },
  GR: { language: 'el-GR', languages: ['el-GR', 'el', 'en-US', 'en'] },
  TR: { language: 'tr-TR', languages: ['tr-TR', 'tr', 'en-US', 'en'] },

  // Asia
  CN: { language: 'zh-CN', languages: ['zh-CN', 'zh', 'en-US', 'en'] },
  TW: { language: 'zh-TW', languages: ['zh-TW', 'zh', 'en-US', 'en'] },
  HK: { language: 'zh-HK', languages: ['zh-HK', 'zh', 'en-HK', 'en'] },
  JP: { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en-US', 'en'] },
  KR: { language: 'ko-KR', languages: ['ko-KR', 'ko', 'en-US', 'en'] },
  SG: { language: 'en-SG', languages: ['en-SG', 'en', 'zh-SG', 'zh', 'ms-SG'] },
  MY: {
    language: 'ms-MY',
    languages: ['ms-MY', 'ms', 'en-MY', 'en', 'zh-MY', 'zh'],
  },
  TH: { language: 'th-TH', languages: ['th-TH', 'th', 'en-US', 'en'] },
  VN: { language: 'vi-VN', languages: ['vi-VN', 'vi', 'en-US', 'en'] },
  ID: { language: 'id-ID', languages: ['id-ID', 'id', 'en-US', 'en'] },
  PH: { language: 'en-PH', languages: ['en-PH', 'en', 'tl-PH'] },
  IN: { language: 'hi-IN', languages: ['hi-IN', 'hi', 'en-IN', 'en'] },
  PK: { language: 'ur-PK', languages: ['ur-PK', 'ur', 'en-PK', 'en'] },
  BD: { language: 'bn-BD', languages: ['bn-BD', 'bn', 'en-US', 'en'] },
  IL: { language: 'he-IL', languages: ['he-IL', 'he', 'en-US', 'en'] },
  AE: { language: 'ar-AE', languages: ['ar-AE', 'ar', 'en-AE', 'en'] },
  SA: { language: 'ar-SA', languages: ['ar-SA', 'ar', 'en-US', 'en'] },

  // South America
  BR: { language: 'pt-BR', languages: ['pt-BR', 'pt', 'en-US', 'en'] },
  AR: { language: 'es-AR', languages: ['es-AR', 'es', 'en-US', 'en'] },
  CL: { language: 'es-CL', languages: ['es-CL', 'es', 'en-US', 'en'] },
  CO: { language: 'es-CO', languages: ['es-CO', 'es', 'en-US', 'en'] },
  PE: { language: 'es-PE', languages: ['es-PE', 'es', 'en-US', 'en'] },

  // Oceania
  AU: { language: 'en-AU', languages: ['en-AU', 'en'] },
  NZ: { language: 'en-NZ', languages: ['en-NZ', 'en'] },

  // Africa
  ZA: { language: 'en-ZA', languages: ['en-ZA', 'en', 'af-ZA', 'af'] },
  EG: { language: 'ar-EG', languages: ['ar-EG', 'ar', 'en-US', 'en'] },
  NG: { language: 'en-NG', languages: ['en-NG', 'en'] },
  KE: { language: 'en-KE', languages: ['en-KE', 'en', 'sw-KE', 'sw'] },
}
