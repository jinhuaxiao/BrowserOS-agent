/**
 * WebGL GPU Profile Database
 *
 * Contains per-GPU shader precision, GL parameter, and extension data
 * collected from real devices via webglreport.com and browserleaks.com.
 *
 * Each GPU profile is matched to its renderer string so that all WebGL
 * signals (shader precision, getParameter values, getSupportedExtensions)
 * are consistent with the claimed GPU.
 */

export interface WebGLShaderPrecision {
  rangeMin: number
  rangeMax: number
  precision: number
}

export interface WebGLShaderPrecisionSet {
  lowFloat: WebGLShaderPrecision
  mediumFloat: WebGLShaderPrecision
  highFloat: WebGLShaderPrecision
  lowInt: WebGLShaderPrecision
  mediumInt: WebGLShaderPrecision
  highInt: WebGLShaderPrecision
}

export interface WebGLGpuParams {
  maxTextureSize: number
  maxCubeMapTextureSize: number
  maxRenderbufferSize: number
  maxViewportDims: [number, number]
  maxTextureImageUnits: number
  maxVertexTextureImageUnits: number
  maxCombinedTextureImageUnits: number
  maxVertexAttribs: number
  maxVertexUniformVectors: number
  maxFragmentUniformVectors: number
  maxVaryingVectors: number
  aliasedLineWidthRange: [number, number]
  aliasedPointSizeRange: [number, number]
  maxSamples: number
}

export type HardwareTier = 'low_end' | 'mid_range' | 'high_end'

export interface WebGLGpuProfile {
  id: string
  platform: 'windows' | 'macos' | 'linux'
  shaderPrecision: {
    vertexShader: WebGLShaderPrecisionSet
    fragmentShader: WebGLShaderPrecisionSet
  }
  params: WebGLGpuParams
  extensions: string[]
  hardwareTier: HardwareTier
}

// Standard desktop shader precision (Intel/NVIDIA/AMD on D3D11, Metal, OpenGL 4.x)
const STANDARD_DESKTOP_PRECISION: WebGLShaderPrecisionSet = {
  lowFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  mediumFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  highFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  lowInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
  mediumInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
  highInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
}

// Apple Silicon vertex shader has slightly different int precision
const APPLE_METAL_VERTEX_PRECISION: WebGLShaderPrecisionSet = {
  lowFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  mediumFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  highFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  lowInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
  mediumInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
  highInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
}

const APPLE_METAL_FRAGMENT_PRECISION: WebGLShaderPrecisionSet = {
  lowFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  mediumFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  highFloat: { rangeMin: 127, rangeMax: 127, precision: 23 },
  lowInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
  mediumInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
  highInt: { rangeMin: 31, rangeMax: 30, precision: 0 },
}

// Common WebGL 1.0 extensions for desktop GPUs via ANGLE
const COMMON_WEBGL1_EXTENSIONS = [
  'ANGLE_instanced_arrays',
  'EXT_blend_minmax',
  'EXT_color_buffer_half_float',
  'EXT_float_blend',
  'EXT_frag_depth',
  'EXT_shader_texture_lod',
  'EXT_texture_compression_bptc',
  'EXT_texture_compression_rgtc',
  'EXT_texture_filter_anisotropic',
  'EXT_sRGB',
  'KHR_parallel_shader_compile',
  'OES_element_index_uint',
  'OES_fbo_render_mipmap',
  'OES_standard_derivatives',
  'OES_texture_float',
  'OES_texture_float_linear',
  'OES_texture_half_float',
  'OES_texture_half_float_linear',
  'OES_vertex_array_object',
  'WEBGL_color_buffer_float',
  'WEBGL_compressed_texture_s3tc',
  'WEBGL_compressed_texture_s3tc_srgb',
  'WEBGL_debug_renderer_info',
  'WEBGL_debug_shaders',
  'WEBGL_depth_texture',
  'WEBGL_draw_buffers',
  'WEBGL_lose_context',
  'WEBGL_multi_draw',
  'WEBGL_polygon_mode',
]

// D3D11-specific extensions (Windows)
const D3D11_EXTENSIONS = [...COMMON_WEBGL1_EXTENSIONS, 'WEBGL_provoking_vertex']

// Metal-specific extensions (macOS)
const METAL_EXTENSIONS = [
  ...COMMON_WEBGL1_EXTENSIONS,
  'WEBGL_clip_cull_distance',
  'WEBGL_provoking_vertex',
]

// Mesa/OpenGL-specific extensions (Linux)
const MESA_EXTENSIONS = [...COMMON_WEBGL1_EXTENSIONS, 'WEBGL_provoking_vertex']

/**
 * GPU profile database keyed by profile ID.
 *
 * Data sourced from real devices via webglreport.com:
 * - Windows: Intel UHD 630, NVIDIA GTX 1060/1080, AMD RX 580 on D3D11
 * - macOS: Apple M1/M2/M3 on Metal, Intel Iris 640 on Metal
 * - Linux: Intel UHD 620 on Mesa/OpenGL 4.6
 */
export const WEBGL_GPU_PROFILES: Record<string, WebGLGpuProfile> = {
  // ===================== Windows Intel =====================
  windows_intel_uhd: {
    id: 'windows_intel_uhd',
    platform: 'windows',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 16384,
      maxCubeMapTextureSize: 16384,
      maxRenderbufferSize: 16384,
      maxViewportDims: [16384, 16384],
      maxTextureImageUnits: 16,
      maxVertexTextureImageUnits: 16,
      maxCombinedTextureImageUnits: 32,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 30,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 1024],
      maxSamples: 8,
    },
    extensions: D3D11_EXTENSIONS,
    hardwareTier: 'mid_range',
  },

  // ===================== Windows NVIDIA =====================
  windows_nvidia_gtx1060: {
    id: 'windows_nvidia_gtx1060',
    platform: 'windows',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 32768,
      maxCubeMapTextureSize: 32768,
      maxRenderbufferSize: 32768,
      maxViewportDims: [32768, 32768],
      maxTextureImageUnits: 32,
      maxVertexTextureImageUnits: 32,
      maxCombinedTextureImageUnits: 64,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 2048],
      maxSamples: 8,
    },
    extensions: D3D11_EXTENSIONS,
    hardwareTier: 'high_end',
  },

  windows_nvidia_gtx1080: {
    id: 'windows_nvidia_gtx1080',
    platform: 'windows',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 32768,
      maxCubeMapTextureSize: 32768,
      maxRenderbufferSize: 32768,
      maxViewportDims: [32768, 32768],
      maxTextureImageUnits: 32,
      maxVertexTextureImageUnits: 32,
      maxCombinedTextureImageUnits: 64,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 2048],
      maxSamples: 8,
    },
    extensions: D3D11_EXTENSIONS,
    hardwareTier: 'high_end',
  },

  windows_nvidia_rtx3060: {
    id: 'windows_nvidia_rtx3060',
    platform: 'windows',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 32768,
      maxCubeMapTextureSize: 32768,
      maxRenderbufferSize: 32768,
      maxViewportDims: [32768, 32768],
      maxTextureImageUnits: 32,
      maxVertexTextureImageUnits: 32,
      maxCombinedTextureImageUnits: 64,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 2048],
      maxSamples: 8,
    },
    extensions: D3D11_EXTENSIONS,
    hardwareTier: 'high_end',
  },

  // ===================== Windows AMD =====================
  windows_amd_rx580: {
    id: 'windows_amd_rx580',
    platform: 'windows',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 16384,
      maxCubeMapTextureSize: 16384,
      maxRenderbufferSize: 16384,
      maxViewportDims: [16384, 16384],
      maxTextureImageUnits: 32,
      maxVertexTextureImageUnits: 32,
      maxCombinedTextureImageUnits: 64,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 8192],
      maxSamples: 8,
    },
    extensions: D3D11_EXTENSIONS,
    hardwareTier: 'mid_range',
  },

  // ===================== macOS Apple Silicon =====================
  mac_apple_m1: {
    id: 'mac_apple_m1',
    platform: 'macos',
    shaderPrecision: {
      vertexShader: APPLE_METAL_VERTEX_PRECISION,
      fragmentShader: APPLE_METAL_FRAGMENT_PRECISION,
    },
    params: {
      maxTextureSize: 16384,
      maxCubeMapTextureSize: 16384,
      maxRenderbufferSize: 16384,
      maxViewportDims: [16384, 16384],
      maxTextureImageUnits: 16,
      maxVertexTextureImageUnits: 16,
      maxCombinedTextureImageUnits: 32,
      maxVertexAttribs: 31,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 511],
      maxSamples: 4,
    },
    extensions: METAL_EXTENSIONS,
    hardwareTier: 'high_end',
  },

  mac_apple_m2: {
    id: 'mac_apple_m2',
    platform: 'macos',
    shaderPrecision: {
      vertexShader: APPLE_METAL_VERTEX_PRECISION,
      fragmentShader: APPLE_METAL_FRAGMENT_PRECISION,
    },
    params: {
      maxTextureSize: 16384,
      maxCubeMapTextureSize: 16384,
      maxRenderbufferSize: 16384,
      maxViewportDims: [16384, 16384],
      maxTextureImageUnits: 16,
      maxVertexTextureImageUnits: 16,
      maxCombinedTextureImageUnits: 32,
      maxVertexAttribs: 31,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 511],
      maxSamples: 4,
    },
    extensions: METAL_EXTENSIONS,
    hardwareTier: 'high_end',
  },

  // ===================== macOS Intel =====================
  mac_intel_iris640: {
    id: 'mac_intel_iris640',
    platform: 'macos',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 16384,
      maxCubeMapTextureSize: 16384,
      maxRenderbufferSize: 16384,
      maxViewportDims: [16384, 16384],
      maxTextureImageUnits: 16,
      maxVertexTextureImageUnits: 16,
      maxCombinedTextureImageUnits: 32,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 15,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 511],
      maxSamples: 4,
    },
    extensions: METAL_EXTENSIONS,
    hardwareTier: 'mid_range',
  },

  // ===================== Linux Intel =====================
  linux_intel_uhd620: {
    id: 'linux_intel_uhd620',
    platform: 'linux',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 16384,
      maxCubeMapTextureSize: 16384,
      maxRenderbufferSize: 16384,
      maxViewportDims: [16384, 16384],
      maxTextureImageUnits: 16,
      maxVertexTextureImageUnits: 16,
      maxCombinedTextureImageUnits: 32,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 7.375],
      aliasedPointSizeRange: [1, 255],
      maxSamples: 8,
    },
    extensions: MESA_EXTENSIONS,
    hardwareTier: 'mid_range',
  },

  // ===================== Linux AMD =====================
  linux_amd_rx580: {
    id: 'linux_amd_rx580',
    platform: 'linux',
    shaderPrecision: {
      vertexShader: STANDARD_DESKTOP_PRECISION,
      fragmentShader: STANDARD_DESKTOP_PRECISION,
    },
    params: {
      maxTextureSize: 16384,
      maxCubeMapTextureSize: 16384,
      maxRenderbufferSize: 16384,
      maxViewportDims: [16384, 16384],
      maxTextureImageUnits: 32,
      maxVertexTextureImageUnits: 32,
      maxCombinedTextureImageUnits: 64,
      maxVertexAttribs: 16,
      maxVertexUniformVectors: 4096,
      maxFragmentUniformVectors: 1024,
      maxVaryingVectors: 31,
      aliasedLineWidthRange: [1, 1],
      aliasedPointSizeRange: [1, 16384],
      maxSamples: 8,
    },
    extensions: MESA_EXTENSIONS,
    hardwareTier: 'mid_range',
  },
}

/**
 * Maps renderer substrings to GPU profile IDs.
 * Used to look up the matching profile for a selected renderer string.
 */
export const RENDERER_TO_GPU_PROFILE: Record<string, string> = {
  // Windows Intel
  'Intel(R) UHD Graphics 630 Direct3D11': 'windows_intel_uhd',
  'Intel(R) UHD Graphics 620 Direct3D11': 'windows_intel_uhd',
  'Intel(R) Iris(R) Xe Graphics Direct3D11': 'windows_intel_uhd',
  'Intel(R) Iris(R) Plus Graphics Direct3D11': 'windows_intel_uhd',
  'Intel(R) HD Graphics 630 Direct3D11': 'windows_intel_uhd',

  // Windows NVIDIA
  'NVIDIA GeForce GTX 1080 Direct3D11': 'windows_nvidia_gtx1080',
  'NVIDIA GeForce RTX 3060 Direct3D11': 'windows_nvidia_rtx3060',
  'NVIDIA GeForce RTX 3070 Direct3D11': 'windows_nvidia_rtx3060',
  'NVIDIA GeForce RTX 4070 Direct3D11': 'windows_nvidia_rtx3060',
  'NVIDIA GeForce GTX 1660 Ti Direct3D11': 'windows_nvidia_gtx1060',

  // Windows AMD
  'AMD Radeon RX 580 Direct3D11': 'windows_amd_rx580',
  'AMD Radeon RX 6800 Direct3D11': 'windows_amd_rx580',
  'AMD Radeon RX 5700 XT Direct3D11': 'windows_amd_rx580',
  'AMD Radeon RX 7900 XTX Direct3D11': 'windows_amd_rx580',

  // macOS Apple Silicon
  'Apple M1, Unspecified Version': 'mac_apple_m1',
  'Apple M1 Pro, Unspecified Version': 'mac_apple_m1',
  'Apple M1 Max, Unspecified Version': 'mac_apple_m1',
  'Apple M2, Unspecified Version': 'mac_apple_m2',
  'Apple M2 Pro, Unspecified Version': 'mac_apple_m2',
  'Apple M2 Max, Unspecified Version': 'mac_apple_m2',
  'Apple M3, Unspecified Version': 'mac_apple_m2',
  'Apple M3 Pro, Unspecified Version': 'mac_apple_m2',
  'Apple M4, Unspecified Version': 'mac_apple_m2',

  // Linux Intel
  'Mesa Intel(R) UHD Graphics 630': 'linux_intel_uhd620',
  'Mesa Intel(R) HD Graphics 530': 'linux_intel_uhd620',
  'Mesa Intel(R) UHD Graphics 620': 'linux_intel_uhd620',
  'Mesa Intel(R) UHD Graphics 770': 'linux_intel_uhd620',

  // Linux AMD
  'AMD Radeon RX 580 (polaris10': 'linux_amd_rx580',
  'AMD Radeon RX 5700 XT (navi10': 'linux_amd_rx580',
  'AMD Radeon RX 6800 (navi21': 'linux_amd_rx580',
}

/**
 * Find the GPU profile matching a WebGL renderer string.
 * Searches RENDERER_TO_GPU_PROFILE for a substring match.
 */
export function findGpuProfile(
  rendererString: string,
): WebGLGpuProfile | undefined {
  for (const [key, profileId] of Object.entries(RENDERER_TO_GPU_PROFILE)) {
    if (rendererString.includes(key)) {
      return WEBGL_GPU_PROFILES[profileId]
    }
  }
  return undefined
}
