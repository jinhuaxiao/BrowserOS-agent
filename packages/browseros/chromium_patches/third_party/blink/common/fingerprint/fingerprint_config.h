diff --git a/third_party/blink/common/fingerprint/fingerprint_config.h b/third_party/blink/common/fingerprint/fingerprint_config.h
new file mode 100644
index 0000000000000..1234567890abc
--- /dev/null
+++ b/third_party/blink/common/fingerprint/fingerprint_config.h
@@ -0,0 +1,89 @@
+// Copyright 2024 BrowserOS Authors
+// Fingerprint configuration for anti-detection
+
+#ifndef THIRD_PARTY_BLINK_COMMON_FINGERPRINT_FINGERPRINT_CONFIG_H_
+#define THIRD_PARTY_BLINK_COMMON_FINGERPRINT_FINGERPRINT_CONFIG_H_
+
+#include <cstdint>
+#include <string>
+#include <vector>
+#include "base/no_destructor.h"
+
+namespace blink {
+
+struct MediaDeviceConfig {
+  std::string kind;
+  std::string device_id;
+  std::string group_id;
+  std::string label;
+};
+
+struct MimeTypeConfig {
+  std::string type;
+  std::string description;
+  std::string suffixes;
+};
+
+struct PluginConfig {
+  std::string name;
+  std::string description;
+  std::string filename;
+  std::vector<MimeTypeConfig> mime_types;
+};
+
+// Singleton class to hold fingerprint configuration
+// Configuration is loaded from JSON file specified by --fingerprint-config flag
+class FingerprintConfig {
+ public:
+  static FingerprintConfig& GetInstance();
+
+  // Load configuration from JSON file
+  bool LoadFromFile(const std::string& path);
+
+  // Load configuration from JSON string
+  bool LoadFromJson(const std::string& json);
+
+  // Load configuration from raw content (auto-detect JSON vs key=value)
+  bool LoadFromString(const std::string& content);
+
+  // Check if custom fingerprint is enabled
+  bool IsEnabled() const { return enabled_; }
+
+  // Navigator properties
+  std::string GetUserAgent() const { return user_agent_; }
+  std::string GetPlatform() const { return platform_; }
+  std::string GetLanguage() const { return language_; }
+  std::string GetLanguages() const { return languages_; }
+  std::string GetAcceptLanguages() const { return accept_languages_; }
+  std::string GetVendor() const { return vendor_; }
+  unsigned int GetHardwareConcurrency() const { return hardware_concurrency_; }
+  float GetDeviceMemory() const { return device_memory_; }
+
+  // Screen properties
+  int GetScreenWidth() const { return screen_width_; }
+  int GetScreenHeight() const { return screen_height_; }
+  int GetScreenAvailWidth() const { return screen_avail_width_; }
+  int GetScreenAvailHeight() const { return screen_avail_height_; }
+  int GetColorDepth() const { return color_depth_; }
+  float GetDevicePixelRatio() const { return device_pixel_ratio_; }
+
+  // WebGL properties
+  std::string GetWebGLVendor() const { return webgl_vendor_; }
+  std::string GetWebGLRenderer() const { return webgl_renderer_; }
+  std::string GetWebGLUnmaskedVendor() const { return webgl_unmasked_vendor_; }
+  std::string GetWebGLUnmaskedRenderer() const { return webgl_unmasked_renderer_; }
+
+  // Canvas fingerprint noise
+  bool GetCanvasNoiseEnabled() const { return canvas_noise_enabled_; }
+  float GetCanvasNoiseFactor() const { return canvas_noise_factor_; }
+  uint32_t GetCanvasSessionSeed() const { return canvas_session_seed_; }
+
+  // AudioContext fingerprint noise
+  bool GetAudioNoiseEnabled() const { return audio_noise_enabled_; }
+  float GetAudioNoiseFactor() const { return audio_noise_factor_; }
+  uint32_t GetAudioSessionSeed() const { return audio_session_seed_; }
+
+  // WebRTC controls
+  bool IsWebRTCDisabled() const { return webrtc_disabled_; }
+  std::string GetWebRTCPublicIp() const { return webrtc_public_ip_; }
+  std::string GetWebRTCLocalIp() const { return webrtc_local_ip_; }
+
+  // Fonts
+  bool IsFontAllowed(const std::string& family, bool is_generic) const;
+
+  // MediaDevices
+  const std::vector<MediaDeviceConfig>& GetMediaDevices() const {
+    return media_devices_;
+  }
+  bool HasMediaDevices() const { return !media_devices_.empty(); }
+
+  // Plugins / MimeTypes
+  const std::vector<PluginConfig>& GetPlugins() const { return plugins_; }
+  bool HasPluginOverride() const { return plugins_override_; }
+
+  // Profile Badge (for multi-profile display in location bar)
+  std::string GetProfileId() const { return profile_id_; }
+  std::string GetProfileName() const { return profile_name_; }
+  std::string GetProfileColor() const { return profile_color_; }
+  bool HasProfileBadge() const { return !profile_name_.empty(); }
+
+ private:
+  friend class base::NoDestructor<FingerprintConfig>;
+  bool LoadFromKeyValue(const std::string& content);
+  void NormalizeAfterLoad();
+  FingerprintConfig();
+  ~FingerprintConfig() = default;
+
+  bool enabled_ = false;
+
+  // Navigator
+  std::string user_agent_;
+  std::string platform_;
+  std::string language_ = "en-US";
+  std::string languages_ = "en-US,en";
+  std::string accept_languages_ = "en-US,en;q=0.9";
+  std::string vendor_ = "Google Inc.";
+  unsigned int hardware_concurrency_ = 8;
+  float device_memory_ = 8.0;
+
+  // Screen
+  int screen_width_ = 1920;
+  int screen_height_ = 1080;
+  int screen_avail_width_ = 1920;
+  int screen_avail_height_ = 1080;
+  int color_depth_ = 24;
+  float device_pixel_ratio_ = 1.0;
+
+  // WebGL
+  std::string webgl_vendor_ = "WebKit";
+  std::string webgl_renderer_ = "WebKit WebGL";
+  std::string webgl_unmasked_vendor_ = "Google Inc. (Apple)";
+  std::string webgl_unmasked_renderer_ = "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)";
+
+  // Canvas/Audio noise
+  bool canvas_noise_enabled_ = false;
+  float canvas_noise_factor_ = 0.0001;
+  uint32_t canvas_session_seed_ = 0;
+  bool audio_noise_enabled_ = false;
+  float audio_noise_factor_ = 0.0001;
+  uint32_t audio_session_seed_ = 0;
+
+  // WebRTC
+  bool webrtc_disabled_ = false;
+  std::string webrtc_public_ip_;
+  std::string webrtc_local_ip_;
+  // Fonts
+  bool block_font_enumeration_ = false;
+  std::vector<std::string> enabled_fonts_;
+  // MediaDevices
+  std::vector<MediaDeviceConfig> media_devices_;
+  // Plugins / MimeTypes
+  bool plugins_override_ = false;
+  std::vector<PluginConfig> plugins_;
+
+  // Profile Badge
+  std::string profile_id_;
+  std::string profile_name_;
+  std::string profile_color_ = "#2196F3";  // Default blue color
+};
+
+}  // namespace blink
+
+#endif  // THIRD_PARTY_BLINK_COMMON_FINGERPRINT_FINGERPRINT_CONFIG_H_
