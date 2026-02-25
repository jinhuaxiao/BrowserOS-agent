// Copyright 2024 Nova Seller. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef THIRD_PARTY_BLINK_RENDERER_CORE_FRAME_FINGERPRINT_CONFIG_H_
#define THIRD_PARTY_BLINK_RENDERER_CORE_FRAME_FINGERPRINT_CONFIG_H_

#include <string>
#include <vector>

#include "third_party/blink/renderer/core/core_export.h"

namespace blink {

// FingerprintConfig holds browser fingerprint configuration loaded from
// an external config file. This enables kernel-level fingerprint spoofing
// for anti-detection purposes in e-commerce multi-account management.
//
// Config file format (key=value):
//   profile_id=abc123
//   profile_name=Store A
//   profile_color=#2196F3
//   user_agent=Mozilla/5.0 ...
//   hardware_concurrency=8
//   ...
//
// The config file path is specified via:
//   1. Command line: --fingerprint-config=/path/to/config
//   2. Environment variable: NOVA_SELLER_FINGERPRINT_CONFIG
//   3. Environment variable: BROWSEROS_FINGERPRINT_CONFIG (legacy)
//
class CORE_EXPORT FingerprintConfig {
 public:
  // Returns the singleton instance. Creates and loads config on first call.
  static FingerprintConfig* GetInstance();

  // Reloads configuration from the config file.
  void Reload();

  // Returns true if a valid config has been loaded.
  bool IsLoaded() const { return is_loaded_; }

  // Profile identification (for UI display)
  std::string profile_id;
  std::string profile_name;
  std::string profile_color;  // Hex format: #RRGGBB

  // Navigator properties
  std::string user_agent;
  int hardware_concurrency = 0;
  double device_memory = 0;
  std::string platform;
  std::string vendor;
  std::string language;
  std::vector<std::string> languages;
  std::string accept_language;

  // Screen properties
  int screen_width = 0;
  int screen_height = 0;
  int screen_avail_width = 0;
  int screen_avail_height = 0;
  int screen_color_depth = 24;
  int screen_pixel_depth = 24;
  double device_pixel_ratio = 1.0;

  // WebGL properties
  std::string webgl_vendor;
  std::string webgl_renderer;
  std::string webgl_unmasked_vendor;
  std::string webgl_unmasked_renderer;

  // Canvas fingerprint noise
  bool canvas_noise_enabled = false;
  double canvas_noise_level = 0.0;
  uint32_t canvas_session_seed = 0;

  // Audio fingerprint noise
  bool audio_noise_enabled = false;
  double audio_noise_level = 0.0;
  uint32_t audio_session_seed = 0;

  // WebRTC configuration
  bool webrtc_disabled = false;
  std::string webrtc_public_ip;
  std::string webrtc_local_ip;

  // Font enumeration
  bool block_font_enumeration = false;
  std::vector<std::string> fonts_enabled;

 private:
  FingerprintConfig();
  ~FingerprintConfig();

  // Loads config from the specified file path.
  bool LoadFromFile(const std::string& path);

  // Parses a key=value line.
  void ParseLine(const std::string& line);

  // Parses comma-separated values into a vector.
  static std::vector<std::string> ParseCommaSeparated(const std::string& value);

  // Gets the config file path from command line or environment.
  static std::string GetConfigFilePath();

  bool is_loaded_ = false;

  // Disallow copy and assign.
  FingerprintConfig(const FingerprintConfig&) = delete;
  FingerprintConfig& operator=(const FingerprintConfig&) = delete;
};

}  // namespace blink

#endif  // THIRD_PARTY_BLINK_RENDERER_CORE_FRAME_FINGERPRINT_CONFIG_H_
