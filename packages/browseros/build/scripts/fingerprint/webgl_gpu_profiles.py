"""
WebGL GPU Profile Database (Python)

Mirror of the TypeScript version at:
  packages/craft-agents/packages/shared/src/browser-profiles/webgl-gpu-profiles.ts

Contains per-GPU shader precision, GL parameter, and extension data
collected from real devices via webglreport.com and browserleaks.com.
"""

from typing import Any, Dict, List

# Standard desktop shader precision (Intel/NVIDIA/AMD on D3D11, Metal, OpenGL 4.x)
STANDARD_DESKTOP_PRECISION = {
    "lowFloat": {"rangeMin": 127, "rangeMax": 127, "precision": 23},
    "mediumFloat": {"rangeMin": 127, "rangeMax": 127, "precision": 23},
    "highFloat": {"rangeMin": 127, "rangeMax": 127, "precision": 23},
    "lowInt": {"rangeMin": 31, "rangeMax": 30, "precision": 0},
    "mediumInt": {"rangeMin": 31, "rangeMax": 30, "precision": 0},
    "highInt": {"rangeMin": 31, "rangeMax": 30, "precision": 0},
}

# Common WebGL 1.0 extensions for desktop GPUs via ANGLE
COMMON_WEBGL1_EXTENSIONS = [
    "ANGLE_instanced_arrays",
    "EXT_blend_minmax",
    "EXT_color_buffer_half_float",
    "EXT_float_blend",
    "EXT_frag_depth",
    "EXT_shader_texture_lod",
    "EXT_texture_compression_bptc",
    "EXT_texture_compression_rgtc",
    "EXT_texture_filter_anisotropic",
    "EXT_sRGB",
    "KHR_parallel_shader_compile",
    "OES_element_index_uint",
    "OES_fbo_render_mipmap",
    "OES_standard_derivatives",
    "OES_texture_float",
    "OES_texture_float_linear",
    "OES_texture_half_float",
    "OES_texture_half_float_linear",
    "OES_vertex_array_object",
    "WEBGL_color_buffer_float",
    "WEBGL_compressed_texture_s3tc",
    "WEBGL_compressed_texture_s3tc_srgb",
    "WEBGL_debug_renderer_info",
    "WEBGL_debug_shaders",
    "WEBGL_depth_texture",
    "WEBGL_draw_buffers",
    "WEBGL_lose_context",
    "WEBGL_multi_draw",
    "WEBGL_polygon_mode",
]

D3D11_EXTENSIONS = COMMON_WEBGL1_EXTENSIONS + ["WEBGL_provoking_vertex"]
METAL_EXTENSIONS = COMMON_WEBGL1_EXTENSIONS + [
    "WEBGL_clip_cull_distance",
    "WEBGL_provoking_vertex",
]
MESA_EXTENSIONS = COMMON_WEBGL1_EXTENSIONS + ["WEBGL_provoking_vertex"]


WEBGL_GPU_PROFILES: Dict[str, Dict[str, Any]] = {
    "windows_intel_uhd": {
        "platform": "windows",
        "shaderPrecision": {
            "vertexShader": STANDARD_DESKTOP_PRECISION,
            "fragmentShader": STANDARD_DESKTOP_PRECISION,
        },
        "params": {
            "maxTextureSize": 16384,
            "maxCubeMapTextureSize": 16384,
            "maxRenderbufferSize": 16384,
            "maxViewportDims": [16384, 16384],
            "maxTextureImageUnits": 16,
            "maxVertexTextureImageUnits": 16,
            "maxCombinedTextureImageUnits": 32,
            "maxVertexAttribs": 16,
            "maxVertexUniformVectors": 4096,
            "maxFragmentUniformVectors": 1024,
            "maxVaryingVectors": 30,
            "aliasedLineWidthRange": [1, 1],
            "aliasedPointSizeRange": [1, 1024],
            "maxSamples": 8,
        },
        "extensions": D3D11_EXTENSIONS,
    },
    "windows_nvidia_gtx1060": {
        "platform": "windows",
        "shaderPrecision": {
            "vertexShader": STANDARD_DESKTOP_PRECISION,
            "fragmentShader": STANDARD_DESKTOP_PRECISION,
        },
        "params": {
            "maxTextureSize": 32768,
            "maxCubeMapTextureSize": 32768,
            "maxRenderbufferSize": 32768,
            "maxViewportDims": [32768, 32768],
            "maxTextureImageUnits": 32,
            "maxVertexTextureImageUnits": 32,
            "maxCombinedTextureImageUnits": 64,
            "maxVertexAttribs": 16,
            "maxVertexUniformVectors": 4096,
            "maxFragmentUniformVectors": 1024,
            "maxVaryingVectors": 31,
            "aliasedLineWidthRange": [1, 1],
            "aliasedPointSizeRange": [1, 2048],
            "maxSamples": 8,
        },
        "extensions": D3D11_EXTENSIONS,
    },
    "windows_amd_rx580": {
        "platform": "windows",
        "shaderPrecision": {
            "vertexShader": STANDARD_DESKTOP_PRECISION,
            "fragmentShader": STANDARD_DESKTOP_PRECISION,
        },
        "params": {
            "maxTextureSize": 16384,
            "maxCubeMapTextureSize": 16384,
            "maxRenderbufferSize": 16384,
            "maxViewportDims": [16384, 16384],
            "maxTextureImageUnits": 32,
            "maxVertexTextureImageUnits": 32,
            "maxCombinedTextureImageUnits": 64,
            "maxVertexAttribs": 16,
            "maxVertexUniformVectors": 4096,
            "maxFragmentUniformVectors": 1024,
            "maxVaryingVectors": 31,
            "aliasedLineWidthRange": [1, 1],
            "aliasedPointSizeRange": [1, 8192],
            "maxSamples": 8,
        },
        "extensions": D3D11_EXTENSIONS,
    },
    "mac_apple_m1": {
        "platform": "macos",
        "shaderPrecision": {
            "vertexShader": STANDARD_DESKTOP_PRECISION,
            "fragmentShader": STANDARD_DESKTOP_PRECISION,
        },
        "params": {
            "maxTextureSize": 16384,
            "maxCubeMapTextureSize": 16384,
            "maxRenderbufferSize": 16384,
            "maxViewportDims": [16384, 16384],
            "maxTextureImageUnits": 16,
            "maxVertexTextureImageUnits": 16,
            "maxCombinedTextureImageUnits": 32,
            "maxVertexAttribs": 31,
            "maxVertexUniformVectors": 4096,
            "maxFragmentUniformVectors": 1024,
            "maxVaryingVectors": 31,
            "aliasedLineWidthRange": [1, 1],
            "aliasedPointSizeRange": [1, 511],
            "maxSamples": 4,
        },
        "extensions": METAL_EXTENSIONS,
    },
    "mac_intel_iris640": {
        "platform": "macos",
        "shaderPrecision": {
            "vertexShader": STANDARD_DESKTOP_PRECISION,
            "fragmentShader": STANDARD_DESKTOP_PRECISION,
        },
        "params": {
            "maxTextureSize": 16384,
            "maxCubeMapTextureSize": 16384,
            "maxRenderbufferSize": 16384,
            "maxViewportDims": [16384, 16384],
            "maxTextureImageUnits": 16,
            "maxVertexTextureImageUnits": 16,
            "maxCombinedTextureImageUnits": 32,
            "maxVertexAttribs": 16,
            "maxVertexUniformVectors": 4096,
            "maxFragmentUniformVectors": 1024,
            "maxVaryingVectors": 15,
            "aliasedLineWidthRange": [1, 1],
            "aliasedPointSizeRange": [1, 511],
            "maxSamples": 4,
        },
        "extensions": METAL_EXTENSIONS,
    },
    "linux_intel_uhd620": {
        "platform": "linux",
        "shaderPrecision": {
            "vertexShader": STANDARD_DESKTOP_PRECISION,
            "fragmentShader": STANDARD_DESKTOP_PRECISION,
        },
        "params": {
            "maxTextureSize": 16384,
            "maxCubeMapTextureSize": 16384,
            "maxRenderbufferSize": 16384,
            "maxViewportDims": [16384, 16384],
            "maxTextureImageUnits": 16,
            "maxVertexTextureImageUnits": 16,
            "maxCombinedTextureImageUnits": 32,
            "maxVertexAttribs": 16,
            "maxVertexUniformVectors": 4096,
            "maxFragmentUniformVectors": 1024,
            "maxVaryingVectors": 31,
            "aliasedLineWidthRange": [1, 7.375],
            "aliasedPointSizeRange": [1, 255],
            "maxSamples": 8,
        },
        "extensions": MESA_EXTENSIONS,
    },
}


# Maps WEBGL_CONFIGS keys to GPU profile IDs
WEBGL_CONFIG_TO_GPU_PROFILE: Dict[str, str] = {
    "windows_intel": "windows_intel_uhd",
    "windows_nvidia": "windows_nvidia_gtx1060",
    "windows_amd": "windows_amd_rx580",
    "mac_apple": "mac_apple_m1",
    "mac_intel": "mac_intel_iris640",
    "linux_intel": "linux_intel_uhd620",
}


def get_gpu_profile(webgl_config_key: str) -> Dict[str, Any]:
    """Look up the GPU profile for a WEBGL_CONFIGS key."""
    profile_id = WEBGL_CONFIG_TO_GPU_PROFILE.get(webgl_config_key)
    if profile_id:
        return WEBGL_GPU_PROFILES.get(profile_id, {})
    return {}
