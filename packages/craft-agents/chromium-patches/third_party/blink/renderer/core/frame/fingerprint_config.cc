// Copyright 2024 Nova Seller. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "third_party/blink/renderer/core/frame/fingerprint_config.h"

#include <cstdlib>
#include <fstream>
#include <sstream>

#include "base/command_line.h"
#include "base/logging.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_split.h"
#include "base/strings/string_util.h"

namespace blink {

namespace {

// Command line switch for fingerprint config file path.
const char kFingerprintConfigSwitch[] = "fingerprint-config";

// Environment variables for config file path.
const char kNovaSellerEnvVar[] = "NOVA_SELLER_FINGERPRINT_CONFIG";
const char kBrowserOSEnvVar[] = "BROWSEROS_FINGERPRINT_CONFIG";

}  // namespace

// static
FingerprintConfig* FingerprintConfig::GetInstance() {
  static FingerprintConfig* instance = nullptr;
  if (!instance) {
    instance = new FingerprintConfig();
  }
  return instance;
}

FingerprintConfig::FingerprintConfig() {
  std::string config_path = GetConfigFilePath();
  if (!config_path.empty()) {
    is_loaded_ = LoadFromFile(config_path);
    if (is_loaded_) {
      LOG(INFO) << "[FingerprintConfig] Loaded config from: " << config_path;
      if (!profile_name.empty()) {
        LOG(INFO) << "[FingerprintConfig] Profile: " << profile_name;
      }
    } else {
      LOG(WARNING) << "[FingerprintConfig] Failed to load config from: "
                   << config_path;
    }
  }
}

FingerprintConfig::~FingerprintConfig() = default;

void FingerprintConfig::Reload() {
  // Reset all values
  *this = FingerprintConfig();

  std::string config_path = GetConfigFilePath();
  if (!config_path.empty()) {
    is_loaded_ = LoadFromFile(config_path);
  }
}

bool FingerprintConfig::LoadFromFile(const std::string& path) {
  std::ifstream file(path);
  if (!file.is_open()) {
    return false;
  }

  std::string line;
  while (std::getline(file, line)) {
    // Skip empty lines and comments
    if (line.empty() || line[0] == '#') {
      continue;
    }
    ParseLine(line);
  }

  return true;
}

void FingerprintConfig::ParseLine(const std::string& line) {
  size_t pos = line.find('=');
  if (pos == std::string::npos) {
    return;
  }

  std::string key = line.substr(0, pos);
  std::string value = line.substr(pos + 1);

  // Trim whitespace
  base::TrimWhitespaceASCII(key, base::TRIM_ALL, &key);
  base::TrimWhitespaceASCII(value, base::TRIM_ALL, &value);

  // Profile identification
  if (key == "profile_id") {
    profile_id = value;
  } else if (key == "profile_name") {
    profile_name = value;
  } else if (key == "profile_color") {
    profile_color = value;
  }
  // Navigator properties
  else if (key == "user_agent") {
    user_agent = value;
  } else if (key == "hardware_concurrency") {
    base::StringToInt(value, &hardware_concurrency);
  } else if (key == "device_memory") {
    base::StringToDouble(value, &device_memory);
  } else if (key == "platform") {
    platform = value;
  } else if (key == "vendor") {
    vendor = value;
  } else if (key == "language") {
    language = value;
  } else if (key == "languages") {
    languages = ParseCommaSeparated(value);
  } else if (key == "accept_language") {
    accept_language = value;
  }
  // Screen properties
  else if (key == "screen_width") {
    base::StringToInt(value, &screen_width);
  } else if (key == "screen_height") {
    base::StringToInt(value, &screen_height);
  } else if (key == "screen_avail_width") {
    base::StringToInt(value, &screen_avail_width);
  } else if (key == "screen_avail_height") {
    base::StringToInt(value, &screen_avail_height);
  } else if (key == "screen_color_depth") {
    base::StringToInt(value, &screen_color_depth);
  } else if (key == "screen_pixel_depth") {
    base::StringToInt(value, &screen_pixel_depth);
  } else if (key == "device_pixel_ratio") {
    base::StringToDouble(value, &device_pixel_ratio);
  }
  // WebGL properties
  else if (key == "webgl_vendor") {
    webgl_vendor = value;
  } else if (key == "webgl_renderer") {
    webgl_renderer = value;
  } else if (key == "webgl_unmasked_vendor") {
    webgl_unmasked_vendor = value;
  } else if (key == "webgl_unmasked_renderer") {
    webgl_unmasked_renderer = value;
  }
  // Canvas noise
  else if (key == "canvas_noise_enabled") {
    canvas_noise_enabled = (value == "true" || value == "1");
  } else if (key == "canvas_noise_level") {
    base::StringToDouble(value, &canvas_noise_level);
  } else if (key == "canvas_session_seed") {
    base::StringToUint(value, &canvas_session_seed);
  }
  // Audio noise
  else if (key == "audio_noise_enabled") {
    audio_noise_enabled = (value == "true" || value == "1");
  } else if (key == "audio_noise_level") {
    base::StringToDouble(value, &audio_noise_level);
  } else if (key == "audio_session_seed") {
    base::StringToUint(value, &audio_session_seed);
  }
  // WebRTC
  else if (key == "webrtc_disabled") {
    webrtc_disabled = (value == "true" || value == "1");
  } else if (key == "webrtc_public_ip") {
    webrtc_public_ip = value;
  } else if (key == "webrtc_local_ip") {
    webrtc_local_ip = value;
  }
  // Fonts
  else if (key == "block_font_enumeration") {
    block_font_enumeration = (value == "true" || value == "1");
  } else if (key == "fonts_enabled") {
    fonts_enabled = ParseCommaSeparated(value);
  }
}

// static
std::vector<std::string> FingerprintConfig::ParseCommaSeparated(
    const std::string& value) {
  return base::SplitString(value, ",", base::TRIM_WHITESPACE,
                           base::SPLIT_WANT_NONEMPTY);
}

// static
std::string FingerprintConfig::GetConfigFilePath() {
  // Priority 1: Command line argument
  const base::CommandLine* command_line =
      base::CommandLine::ForCurrentProcess();
  if (command_line->HasSwitch(kFingerprintConfigSwitch)) {
    return command_line->GetSwitchValueASCII(kFingerprintConfigSwitch);
  }

  // Priority 2: Nova Seller environment variable
  const char* nova_seller_path = std::getenv(kNovaSellerEnvVar);
  if (nova_seller_path && nova_seller_path[0] != '\0') {
    return nova_seller_path;
  }

  // Priority 3: BrowserOS environment variable (legacy)
  const char* browseros_path = std::getenv(kBrowserOSEnvVar);
  if (browseros_path && browseros_path[0] != '\0') {
    return browseros_path;
  }

  return std::string();
}

}  // namespace blink
