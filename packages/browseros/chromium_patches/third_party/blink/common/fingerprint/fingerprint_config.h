// Copyright 2024 Nova Seller Authors
// Fingerprint configuration for anti-detection

#ifndef THIRD_PARTY_BLINK_COMMON_FINGERPRINT_FINGERPRINT_CONFIG_H_
#define THIRD_PARTY_BLINK_COMMON_FINGERPRINT_FINGERPRINT_CONFIG_H_

#include <cstdint>
#include <limits>
#include <string>
#include <vector>
#include "base/no_destructor.h"
#include "third_party/blink/public/common/common_export.h"

namespace blink {

struct MediaDeviceConfig {
  std::string kind;
  std::string device_id;
  std::string group_id;
  std::string label;
};

struct MimeTypeConfig {
  std::string type;
  std::string description;
  std::string suffixes;
};

struct PluginConfig {
  std::string name;
  std::string description;
  std::string filename;
  std::vector<MimeTypeConfig> mime_types;
};

struct SpeechVoiceConfig {
  std::string name;
  std::string lang;
  bool local_service = false;
  bool is_default = false;
};

struct WebGLShaderPrecisionValues {
  int range_min = 0;
  int range_max = 0;
  int precision = 0;
};

struct WebGLShaderPrecisionSet {
  WebGLShaderPrecisionValues low_float;
  WebGLShaderPrecisionValues medium_float;
  WebGLShaderPrecisionValues high_float;
  WebGLShaderPrecisionValues low_int;
  WebGLShaderPrecisionValues medium_int;
  WebGLShaderPrecisionValues high_int;
};

// Singleton class to hold fingerprint configuration
// Configuration is loaded from JSON file specified by --fingerprint-config flag
class BLINK_COMMON_EXPORT FingerprintConfig {
 public:
  static FingerprintConfig& GetInstance();

  // Load configuration from JSON file
  bool LoadFromFile(const std::string& path);

  // Load configuration from JSON string
  bool LoadFromJson(const std::string& json);

  // Load configuration from raw content (auto-detect JSON vs key=value)
  bool LoadFromString(const std::string& content);

  // Check if custom fingerprint is enabled
  bool IsEnabled() const { return enabled_; }

  // Check if specific property groups were explicitly configured in JSON
  bool HasScreenOverride() const { return has_screen_; }
  bool HasNavigatorOverride() const { return has_navigator_; }

  // Navigator properties
  std::string GetUserAgent() const { return user_agent_; }
  std::string GetPlatform() const { return platform_; }
  std::string GetLanguage() const { return language_; }
  std::string GetLanguages() const { return languages_; }
  std::string GetAcceptLanguages() const { return accept_languages_; }
  std::string GetVendor() const { return vendor_; }
  unsigned int GetHardwareConcurrency() const { return hardware_concurrency_; }
  float GetDeviceMemory() const { return device_memory_; }
  int GetMaxTouchPoints() const { return max_touch_points_; }
  bool HasMaxTouchPointsOverride() const { return has_max_touch_points_; }

  // Screen properties
  int GetScreenWidth() const { return screen_width_; }
  int GetScreenHeight() const { return screen_height_; }
  int GetScreenAvailWidth() const { return screen_avail_width_; }
  int GetScreenAvailHeight() const { return screen_avail_height_; }
  int GetColorDepth() const { return color_depth_; }
  float GetDevicePixelRatio() const { return device_pixel_ratio_; }

  // WebGL properties
  std::string GetWebGLVendor() const { return webgl_vendor_; }
  std::string GetWebGLRenderer() const { return webgl_renderer_; }
  std::string GetWebGLUnmaskedVendor() const { return webgl_unmasked_vendor_; }
  std::string GetWebGLUnmaskedRenderer() const { return webgl_unmasked_renderer_; }
  const std::string& GetWebGLGLVersion() const { return webgl_gl_version_; }
  const std::string& GetWebGLGLVersion2() const { return webgl_gl_version_2_.empty() ? webgl_gl_version_ : webgl_gl_version_2_; }
  const std::string& GetWebGLShadingLanguageVersion() const { return webgl_shading_language_version_; }
  const std::string& GetWebGLShadingLanguageVersion2() const { return webgl_shading_language_version_2_.empty() ? webgl_shading_language_version_ : webgl_shading_language_version_2_; }

  // Canvas fingerprint noise
  bool GetCanvasNoiseEnabled() const { return canvas_noise_enabled_; }
  float GetCanvasNoiseFactor() const { return canvas_noise_factor_; }
  uint32_t GetCanvasSessionSeed() const { return canvas_session_seed_; }

  // AudioContext fingerprint noise
  bool GetAudioNoiseEnabled() const { return audio_noise_enabled_; }
  float GetAudioNoiseFactor() const { return audio_noise_factor_; }
  uint32_t GetAudioSessionSeed() const { return audio_session_seed_; }

  // WebRTC controls
  bool IsWebRTCDisabled() const { return webrtc_disabled_; }
  std::string GetWebRTCPublicIp() const { return webrtc_public_ip_; }
  std::string GetWebRTCLocalIp() const { return webrtc_local_ip_; }

  // Fonts
  bool IsFontAllowed(const std::string& family, bool is_generic) const;

  // MediaDevices
  const std::vector<MediaDeviceConfig>& GetMediaDevices() const {
    return media_devices_;
  }
  bool HasMediaDevices() const { return !media_devices_.empty(); }

  // Plugins / MimeTypes
  const std::vector<PluginConfig>& GetPlugins() const { return plugins_; }
  bool HasPluginOverride() const { return plugins_override_; }

  // Profile Badge (for multi-profile display in location bar)
  std::string GetProfileId() const { return profile_id_; }
  std::string GetProfileName() const { return profile_name_; }
  std::string GetProfileColor() const { return profile_color_; }
  std::string GetProfileCountry() const { return profile_country_; }
  std::string GetProfileIp() const { return profile_ip_; }
  bool HasProfileBadge() const { return !profile_name_.empty(); }

  // ClientRects noise
  bool GetClientRectsNoiseEnabled() const { return client_rects_noise_enabled_; }
  float GetClientRectsNoiseFactor() const { return client_rects_noise_factor_; }
  uint32_t GetClientRectsSessionSeed() const { return client_rects_session_seed_; }

  // Battery API
  bool GetBatteryEnabled() const { return battery_enabled_; }
  bool GetBatteryCharging() const { return battery_charging_; }
  double GetBatteryChargingTime() const { return battery_charging_time_; }
  double GetBatteryDischargingTime() const { return battery_discharging_time_; }
  double GetBatteryLevel() const { return battery_level_; }

  // Geolocation
  bool GetGeolocationEnabled() const { return geolocation_enabled_; }
  double GetGeolocationLatitude() const { return geolocation_latitude_; }
  double GetGeolocationLongitude() const { return geolocation_longitude_; }
  double GetGeolocationAccuracy() const { return geolocation_accuracy_; }

  // Speech Synthesis
  bool GetSpeechSynthesisEnabled() const { return speech_synthesis_enabled_; }
  const std::vector<SpeechVoiceConfig>& GetSpeechVoices() const { return speech_voices_; }
  bool HasSpeechVoices() const { return !speech_voices_.empty(); }

  // WebGL shader precision override
  bool GetOverrideShaderPrecision() const { return override_shader_precision_; }

  // Per-GPU shader precision data (replaces hardcoded values)
  bool HasWebGLShaderPrecision() const { return has_webgl_shader_precision_; }
  const WebGLShaderPrecisionSet& GetVertexShaderPrecision() const { return vertex_shader_precision_; }
  const WebGLShaderPrecisionSet& GetFragmentShaderPrecision() const { return fragment_shader_precision_; }
  WebGLShaderPrecisionValues GetShaderPrecision(unsigned int shader_type, unsigned int precision_type) const;

  // Per-GPU WebGL parameter overrides
  bool HasWebGLParams() const { return has_webgl_params_; }
  int GetWebGLMaxTextureSize() const { return webgl_max_texture_size_; }
  int GetWebGLMaxCubeMapTextureSize() const { return webgl_max_cube_map_texture_size_; }
  int GetWebGLMaxRenderbufferSize() const { return webgl_max_renderbuffer_size_; }
  int GetWebGLMaxViewportWidth() const { return webgl_max_viewport_width_; }
  int GetWebGLMaxViewportHeight() const { return webgl_max_viewport_height_; }
  int GetWebGLMaxTextureImageUnits() const { return webgl_max_texture_image_units_; }
  int GetWebGLMaxVertexTextureImageUnits() const { return webgl_max_vertex_texture_image_units_; }
  int GetWebGLMaxCombinedTextureImageUnits() const { return webgl_max_combined_texture_image_units_; }
  int GetWebGLMaxVertexAttribs() const { return webgl_max_vertex_attribs_; }
  int GetWebGLMaxVertexUniformVectors() const { return webgl_max_vertex_uniform_vectors_; }
  int GetWebGLMaxFragmentUniformVectors() const { return webgl_max_fragment_uniform_vectors_; }
  int GetWebGLMaxVaryingVectors() const { return webgl_max_varying_vectors_; }
  int GetWebGLMaxSamples() const { return webgl_max_samples_; }
  float GetWebGLAliasedLineWidthRangeMin() const { return webgl_aliased_line_width_range_min_; }
  float GetWebGLAliasedLineWidthRangeMax() const { return webgl_aliased_line_width_range_max_; }
  float GetWebGLAliasedPointSizeRangeMin() const { return webgl_aliased_point_size_range_min_; }
  float GetWebGLAliasedPointSizeRangeMax() const { return webgl_aliased_point_size_range_max_; }

  // Per-GPU WebGL extension list override
  bool HasWebGLExtensionsOverride() const { return has_webgl_extensions_override_; }
  const std::vector<std::string>& GetWebGLExtensions() const { return webgl_extensions_; }

  // WebGPU adapter info
  std::string GetWebGPUVendor() const { return webgpu_vendor_; }
  std::string GetWebGPUArchitecture() const { return webgpu_architecture_; }
  std::string GetWebGPUDevice() const { return webgpu_device_; }
  std::string GetWebGPUDescription() const { return webgpu_description_; }
  bool HasWebGPUOverride() const { return !webgpu_vendor_.empty(); }

  // Port scan protection
  bool GetPortScanProtectionEnabled() const { return port_scan_protection_enabled_; }
  const std::vector<int>& GetPortScanWhitelist() const { return port_scan_whitelist_; }
  bool IsPortWhitelisted(int port) const;

  // TLS profile
  std::string GetTLSProfile() const { return tls_profile_; }

  // Raw JSON content (for passing to renderer processes via command line)
  const std::string& GetRawJson() const { return raw_json_; }

 private:
  friend class base::NoDestructor<FingerprintConfig>;
  bool LoadFromKeyValue(const std::string& content);
  void NormalizeAfterLoad();
  void MaybeLoadFromCommandLine();
  FingerprintConfig();
  ~FingerprintConfig() = default;

  bool enabled_ = false;
  bool load_attempted_ = false;
  bool has_screen_ = false;
  bool has_navigator_ = false;

  // Navigator
  std::string user_agent_;
  std::string platform_;
  std::string language_ = "en-US";
  std::string languages_ = "en-US,en";
  std::string accept_languages_ = "en-US,en;q=0.9";
  std::string vendor_ = "Google Inc.";
  unsigned int hardware_concurrency_ = 8;
  float device_memory_ = 8.0;
  bool has_max_touch_points_ = false;
  int max_touch_points_ = 0;

  // Screen
  int screen_width_ = 1920;
  int screen_height_ = 1080;
  int screen_avail_width_ = 1920;
  int screen_avail_height_ = 1080;
  int color_depth_ = 24;
  float device_pixel_ratio_ = 1.0;

  // WebGL
  std::string webgl_vendor_ = "WebKit";
  std::string webgl_renderer_ = "WebKit WebGL";
  std::string webgl_unmasked_vendor_ = "Google Inc. (Apple)";
  std::string webgl_unmasked_renderer_ = "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)";
  std::string webgl_gl_version_;
  std::string webgl_gl_version_2_;
  std::string webgl_shading_language_version_;
  std::string webgl_shading_language_version_2_;

  // Canvas/Audio noise
  bool canvas_noise_enabled_ = false;
  float canvas_noise_factor_ = 0.0001;
  uint32_t canvas_session_seed_ = 0;
  bool audio_noise_enabled_ = false;
  float audio_noise_factor_ = 0.0001;
  uint32_t audio_session_seed_ = 0;

  // WebRTC
  bool webrtc_disabled_ = false;
  std::string webrtc_public_ip_;
  std::string webrtc_local_ip_;
  // Fonts
  bool block_font_enumeration_ = false;
  std::vector<std::string> enabled_fonts_;
  // MediaDevices
  std::vector<MediaDeviceConfig> media_devices_;
  // Plugins / MimeTypes
  bool plugins_override_ = false;
  std::vector<PluginConfig> plugins_;

  // Profile Badge
  std::string profile_id_;
  std::string profile_name_;
  std::string profile_color_ = "#2196F3";  // Default blue color
  std::string profile_country_;
  std::string profile_ip_;

  // ClientRects noise
  bool client_rects_noise_enabled_ = false;
  float client_rects_noise_factor_ = 0.001;
  uint32_t client_rects_session_seed_ = 0;

  // Battery API
  bool battery_enabled_ = true;
  bool battery_charging_ = true;
  double battery_charging_time_ = 0.0;
  double battery_discharging_time_ = std::numeric_limits<double>::infinity();
  double battery_level_ = 1.0;

  // Geolocation
  bool geolocation_enabled_ = false;
  double geolocation_latitude_ = 0.0;
  double geolocation_longitude_ = 0.0;
  double geolocation_accuracy_ = 50.0;

  // Speech Synthesis
  bool speech_synthesis_enabled_ = false;
  std::vector<SpeechVoiceConfig> speech_voices_;

  // WebGL shader precision override
  bool override_shader_precision_ = true;

  // Per-GPU shader precision data
  bool has_webgl_shader_precision_ = false;
  WebGLShaderPrecisionSet vertex_shader_precision_;
  WebGLShaderPrecisionSet fragment_shader_precision_;

  // Per-GPU WebGL parameter overrides
  bool has_webgl_params_ = false;
  int webgl_max_texture_size_ = 16384;
  int webgl_max_cube_map_texture_size_ = 16384;
  int webgl_max_renderbuffer_size_ = 16384;
  int webgl_max_viewport_width_ = 16384;
  int webgl_max_viewport_height_ = 16384;
  int webgl_max_texture_image_units_ = 16;
  int webgl_max_vertex_texture_image_units_ = 16;
  int webgl_max_combined_texture_image_units_ = 32;
  int webgl_max_vertex_attribs_ = 16;
  int webgl_max_vertex_uniform_vectors_ = 4096;
  int webgl_max_fragment_uniform_vectors_ = 1024;
  int webgl_max_varying_vectors_ = 30;
  int webgl_max_samples_ = 8;
  float webgl_aliased_line_width_range_min_ = 1.0f;
  float webgl_aliased_line_width_range_max_ = 1.0f;
  float webgl_aliased_point_size_range_min_ = 1.0f;
  float webgl_aliased_point_size_range_max_ = 1024.0f;

  // Per-GPU WebGL extension list override
  bool has_webgl_extensions_override_ = false;
  std::vector<std::string> webgl_extensions_;

  // WebGPU adapter info
  std::string webgpu_vendor_;
  std::string webgpu_architecture_;
  std::string webgpu_device_;
  std::string webgpu_description_;

  // Port scan protection
  bool port_scan_protection_enabled_ = false;
  std::vector<int> port_scan_whitelist_;

  // TLS profile
  std::string tls_profile_ = "chrome";

  // Raw JSON content stored after loading
  std::string raw_json_;
};

}  // namespace blink

#endif  // THIRD_PARTY_BLINK_COMMON_FINGERPRINT_FINGERPRINT_CONFIG_H_
