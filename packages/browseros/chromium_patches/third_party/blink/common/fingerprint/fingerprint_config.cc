// Copyright 2024 Nova Seller Authors
// Fingerprint configuration implementation

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wshadow"

#include "third_party/blink/common/fingerprint/fingerprint_config.h"

#include <algorithm>
#include <sstream>

#include "base/command_line.h"
#include "base/environment.h"
#include "base/files/file_util.h"
#include "base/json/json_reader.h"
#include "base/logging.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/values.h"

namespace blink {

namespace {

std::string NormalizeFontName(std::string value) {
  base::TrimWhitespaceASCII(value, base::TRIM_ALL, &value);
  if (value.size() >= 2) {
    const char first = value.front();
    const char last = value.back();
    if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
      value = value.substr(1, value.size() - 2);
      base::TrimWhitespaceASCII(value, base::TRIM_ALL, &value);
    }
  }
  return base::ToLowerASCII(value);
}

void AppendFontsFromString(const std::string& value,
                           std::vector<std::string>* output) {
  std::istringstream stream(value);
  std::string token;
  while (std::getline(stream, token, ',')) {
    output->push_back(token);
  }
}

void AppendFontsFromList(const base::Value::List& list,
                         std::vector<std::string>* output) {
  for (const auto& entry : list) {
    if (!entry.is_string())
      continue;
    output->push_back(entry.GetString());
  }
}

std::string TrimString(std::string value) {
  base::TrimWhitespaceASCII(value, base::TRIM_ALL, &value);
  return value;
}

std::string NormalizeMediaKind(std::string value) {
  value = base::ToLowerASCII(TrimString(value));
  value.erase(std::remove_if(value.begin(), value.end(),
                             [](char c) {
                               return c == '-' || c == '_' || c == ' ';
                             }),
              value.end());
  return value;
}

bool IsSupportedMediaKind(const std::string& value) {
  return value == "audioinput" || value == "audiooutput" ||
         value == "videoinput";
}

void AppendMediaDevicesFromList(
    const base::Value::List& list,
    std::vector<MediaDeviceConfig>* output) {
  for (const auto& entry : list) {
    if (!entry.is_dict())
      continue;
    const base::Value::Dict& dict = entry.GetDict();
    std::string kind;
    if (const std::string* value = dict.FindString("kind")) {
      kind = *value;
    } else if (const std::string* value = dict.FindString("deviceKind")) {
      kind = *value;
    }
    std::string normalized_kind = NormalizeMediaKind(kind);
    if (!IsSupportedMediaKind(normalized_kind))
      continue;

    MediaDeviceConfig device;
    device.kind = normalized_kind;
    if (const std::string* value = dict.FindString("deviceId")) {
      device.device_id = TrimString(*value);
    } else if (const std::string* value = dict.FindString("device_id")) {
      device.device_id = TrimString(*value);
    }
    if (const std::string* value = dict.FindString("groupId")) {
      device.group_id = TrimString(*value);
    } else if (const std::string* value = dict.FindString("group_id")) {
      device.group_id = TrimString(*value);
    }
    if (const std::string* value = dict.FindString("label")) {
      device.label = TrimString(*value);
    }
    output->push_back(device);
  }
}

void AppendMimeTypesFromList(const base::Value::List& list,
                             std::vector<MimeTypeConfig>* output) {
  for (const auto& entry : list) {
    if (!entry.is_dict())
      continue;
    const base::Value::Dict& dict = entry.GetDict();
    std::string type;
    if (const std::string* value = dict.FindString("type")) {
      type = TrimString(*value);
    }
    if (type.empty())
      continue;
    MimeTypeConfig mime;
    mime.type = type;
    if (const std::string* value = dict.FindString("description")) {
      mime.description = TrimString(*value);
    }
    if (const std::string* value = dict.FindString("suffixes")) {
      mime.suffixes = TrimString(*value);
    } else if (const std::string* value = dict.FindString("suffixes_list")) {
      mime.suffixes = TrimString(*value);
    }
    output->push_back(mime);
  }
}

void AppendPluginsFromList(const base::Value::List& list,
                           std::vector<PluginConfig>* output) {
  for (const auto& entry : list) {
    if (!entry.is_dict())
      continue;
    const base::Value::Dict& dict = entry.GetDict();
    std::string name;
    if (const std::string* value = dict.FindString("name")) {
      name = TrimString(*value);
    }
    if (name.empty())
      continue;
    PluginConfig plugin;
    plugin.name = name;
    if (const std::string* value = dict.FindString("description")) {
      plugin.description = TrimString(*value);
    }
    if (const std::string* value = dict.FindString("filename")) {
      plugin.filename = TrimString(*value);
    }
    if (const base::Value::List* mime_types = dict.FindList("mimeTypes")) {
      AppendMimeTypesFromList(*mime_types, &plugin.mime_types);
    } else if (const base::Value::List* mime_types =
                   dict.FindList("mime_types")) {
      AppendMimeTypesFromList(*mime_types, &plugin.mime_types);
    }
    output->push_back(plugin);
  }
}

}  // namespace

FingerprintConfig& FingerprintConfig::GetInstance() {
  static base::NoDestructor<FingerprintConfig> instance;
  instance->MaybeLoadFromCommandLine();
  return *instance;
}

FingerprintConfig::FingerprintConfig() = default;

void FingerprintConfig::MaybeLoadFromCommandLine() {
  if (load_attempted_)
    return;
  load_attempted_ = true;

  const auto* command_line = base::CommandLine::ForCurrentProcess();
  if (!command_line)
    return;

  // Prefer JSON content (used by renderer processes which are sandboxed
  // and cannot read files from disk).
  if (command_line->HasSwitch("fingerprint-config-json")) {
    std::string json(
        command_line->GetSwitchValueNative("fingerprint-config-json"));
    if (!json.empty()) {
      LoadFromJson(json);
      return;
    }
  }

  // Fall back to file path (used by browser process).
  std::string config_path;
  if (command_line->HasSwitch("fingerprint-config")) {
    config_path = command_line->GetSwitchValueASCII("fingerprint-config");
  }
  if (config_path.empty()) {
    std::unique_ptr<base::Environment> env = base::Environment::Create();
    auto env_val = env->GetVar("BROWSEROS_FINGERPRINT_CONFIG");
    if (env_val.has_value()) {
      config_path = env_val.value();
    }
  }
  if (!config_path.empty()) {
    LoadFromFile(config_path);
  }
}

bool FingerprintConfig::LoadFromFile(const std::string& path) {
  std::string content;
  base::FilePath file_path(path);

  if (!base::ReadFileToString(file_path, &content)) {
    LOG(WARNING) << "Failed to read fingerprint config file: " << path;
    return false;
  }

  return LoadFromString(content);
}

bool FingerprintConfig::LoadFromString(const std::string& content) {
  std::string trimmed = content;
  base::TrimWhitespaceASCII(trimmed, base::TRIM_ALL, &trimmed);
  if (trimmed.empty()) {
    LOG(WARNING) << "Fingerprint config content is empty";
    return false;
  }

  const char first_char = trimmed[0];
  if (first_char == '{' || first_char == '[') {
    return LoadFromJson(trimmed);
  }

  return LoadFromKeyValue(trimmed);
}

bool FingerprintConfig::LoadFromJson(const std::string& json) {
  auto result = base::JSONReader::ReadAndReturnValueWithError(json, base::JSON_PARSE_RFC);
  if (!result.has_value()) {
    LOG(WARNING) << "Failed to parse fingerprint config JSON: "
                 << result.error().message;
    return false;
  }

  if (!result->is_dict()) {
    LOG(WARNING) << "Fingerprint config must be a JSON object";
    return false;
  }

  // Cache raw JSON for passing to renderer processes via command line
  raw_json_ = json;

  const base::Value::Dict& dict = result->GetDict();
  const base::Value::Dict* nav = dict.FindDict("navigator");
  const base::Value::Dict& nav_dict = nav ? *nav : dict;

  auto join_languages = [](const base::Value::List& list) -> std::string {
    std::string joined;
    for (const auto& entry : list) {
      if (!entry.is_string())
        continue;
      if (!joined.empty())
        joined += ",";
      joined += entry.GetString();
    }
    return joined;
  };

  // Navigator properties
  if (const std::string* ua = nav_dict.FindString("userAgent")) {
    user_agent_ = *ua;
  } else if (const std::string* ua = nav_dict.FindString("user_agent")) {
    user_agent_ = *ua;
  }
  if (const std::string* platform = nav_dict.FindString("platform")) {
    platform_ = *platform;
  }
  if (const std::string* vendor = nav_dict.FindString("vendor")) {
    vendor_ = *vendor;
  }
  if (const std::string* lang = nav_dict.FindString("language")) {
    language_ = *lang;
  }
  if (const std::string* langs = nav_dict.FindString("languages")) {
    languages_ = *langs;
  } else if (const base::Value::List* langs = nav_dict.FindList("languages")) {
    languages_ = join_languages(*langs);
  }
  if (const std::string* accept = nav_dict.FindString("acceptLanguage")) {
    accept_languages_ = *accept;
  } else if (const std::string* accept = nav_dict.FindString("accept_language")) {
    accept_languages_ = *accept;
  }
  if (auto hc = nav_dict.FindInt("hardwareConcurrency")) {
    hardware_concurrency_ = static_cast<unsigned int>(*hc);
  } else if (auto hc = nav_dict.FindInt("hardware_concurrency")) {
    hardware_concurrency_ = static_cast<unsigned int>(*hc);
  }
  if (auto dm = nav_dict.FindDouble("deviceMemory")) {
    device_memory_ = static_cast<float>(*dm);
  } else if (auto dm = nav_dict.FindDouble("device_memory")) {
    device_memory_ = static_cast<float>(*dm);
  }

  // Screen properties
  if (const base::Value::Dict* screen = dict.FindDict("screen")) {
    if (auto w = screen->FindInt("width")) {
      screen_width_ = *w;
    }
    if (auto h = screen->FindInt("height")) {
      screen_height_ = *h;
    }
    if (auto aw = screen->FindInt("availWidth")) {
      screen_avail_width_ = *aw;
    } else if (auto aw = screen->FindInt("avail_width")) {
      screen_avail_width_ = *aw;
    }
    if (auto ah = screen->FindInt("availHeight")) {
      screen_avail_height_ = *ah;
    } else if (auto ah = screen->FindInt("avail_height")) {
      screen_avail_height_ = *ah;
    }
    if (auto cd = screen->FindInt("colorDepth")) {
      color_depth_ = *cd;
    } else if (auto cd = screen->FindInt("color_depth")) {
      color_depth_ = *cd;
    }
    if (auto dpr = screen->FindDouble("devicePixelRatio")) {
      device_pixel_ratio_ = static_cast<float>(*dpr);
    } else if (auto dpr = screen->FindDouble("device_pixel_ratio")) {
      device_pixel_ratio_ = static_cast<float>(*dpr);
    }
  }

  // WebGL properties
  if (const base::Value::Dict* webgl = dict.FindDict("webgl")) {
    if (const std::string* vendor = webgl->FindString("vendor")) {
      webgl_vendor_ = *vendor;
    } else if (const std::string* vendor = webgl->FindString("webgl_vendor")) {
      webgl_vendor_ = *vendor;
    }
    if (const std::string* renderer = webgl->FindString("renderer")) {
      webgl_renderer_ = *renderer;
    } else if (const std::string* renderer = webgl->FindString("webgl_renderer")) {
      webgl_renderer_ = *renderer;
    }
    if (const std::string* uvendor = webgl->FindString("unmaskedVendor")) {
      webgl_unmasked_vendor_ = *uvendor;
    } else if (const std::string* uvendor = webgl->FindString("unmasked_vendor")) {
      webgl_unmasked_vendor_ = *uvendor;
    }
    if (const std::string* urenderer = webgl->FindString("unmaskedRenderer")) {
      webgl_unmasked_renderer_ = *urenderer;
    } else if (const std::string* urenderer = webgl->FindString("unmasked_renderer")) {
      webgl_unmasked_renderer_ = *urenderer;
    }
    if (const std::string* glver = webgl->FindString("glVersion")) {
      webgl_gl_version_ = *glver;
    } else if (const std::string* glver_alt = webgl->FindString("gl_version")) {
      webgl_gl_version_ = *glver_alt;
    }
    if (const std::string* slver = webgl->FindString("shadingLanguageVersion")) {
      webgl_shading_language_version_ = *slver;
    } else if (const std::string* slver_alt = webgl->FindString("shading_language_version")) {
      webgl_shading_language_version_ = *slver_alt;
    }
  }

  // Canvas noise
  if (const base::Value::Dict* canvas = dict.FindDict("canvas")) {
    if (auto enabled = canvas->FindBool("noiseEnabled")) {
      canvas_noise_enabled_ = *enabled;
    } else if (auto enabled = canvas->FindBool("noise_enabled")) {
      canvas_noise_enabled_ = *enabled;
    }
    if (auto level = canvas->FindDouble("noiseLevel")) {
      canvas_noise_factor_ = static_cast<float>(*level);
    } else if (auto factor = canvas->FindDouble("noiseFactor")) {
      canvas_noise_factor_ = static_cast<float>(*factor);
    } else if (auto factor = canvas->FindDouble("noise_level")) {
      canvas_noise_factor_ = static_cast<float>(*factor);
    }
    if (auto seed = canvas->FindInt("noiseSeed")) {
      canvas_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = canvas->FindInt("sessionSeed")) {
      canvas_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = canvas->FindInt("session_seed")) {
      canvas_session_seed_ = static_cast<uint32_t>(*seed);
    }
  }

  // Audio noise
  if (const base::Value::Dict* audio = dict.FindDict("audio")) {
    if (auto enabled = audio->FindBool("noiseEnabled")) {
      audio_noise_enabled_ = *enabled;
    } else if (auto enabled = audio->FindBool("noise_enabled")) {
      audio_noise_enabled_ = *enabled;
    }
    if (auto level = audio->FindDouble("noiseLevel")) {
      audio_noise_factor_ = static_cast<float>(*level);
    } else if (auto factor = audio->FindDouble("noiseFactor")) {
      audio_noise_factor_ = static_cast<float>(*factor);
    } else if (auto factor = audio->FindDouble("noise_level")) {
      audio_noise_factor_ = static_cast<float>(*factor);
    }
    if (auto seed = audio->FindInt("noiseSeed")) {
      audio_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = audio->FindInt("sessionSeed")) {
      audio_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = audio->FindInt("session_seed")) {
      audio_session_seed_ = static_cast<uint32_t>(*seed);
    }
  }

  // WebRTC
  if (const base::Value::Dict* webrtc = dict.FindDict("webrtc")) {
    if (auto disabled = webrtc->FindBool("disableWebRTC")) {
      webrtc_disabled_ = *disabled;
    } else if (auto disabled = webrtc->FindBool("disabled")) {
      webrtc_disabled_ = *disabled;
    } else if (auto disabled = webrtc->FindBool("webrtc_disabled")) {
      webrtc_disabled_ = *disabled;
    }
    if (const std::string* ip = webrtc->FindString("publicIp")) {
      webrtc_public_ip_ = *ip;
    } else if (const std::string* ip = webrtc->FindString("public_ip")) {
      webrtc_public_ip_ = *ip;
    }
    if (const std::string* ip = webrtc->FindString("localIp")) {
      webrtc_local_ip_ = *ip;
    } else if (const std::string* ip = webrtc->FindString("local_ip")) {
      webrtc_local_ip_ = *ip;
    }
  }

  // Fonts
  if (const base::Value::Dict* fonts = dict.FindDict("fonts")) {
    if (auto block = fonts->FindBool("blockFontEnumeration")) {
      block_font_enumeration_ = *block;
    } else if (auto block = fonts->FindBool("block_font_enumeration")) {
      block_font_enumeration_ = *block;
    }
    if (const base::Value::List* list = fonts->FindList("enabledFonts")) {
      enabled_fonts_.clear();
      AppendFontsFromList(*list, &enabled_fonts_);
    } else if (const std::string* list = fonts->FindString("enabledFonts")) {
      enabled_fonts_.clear();
      AppendFontsFromString(*list, &enabled_fonts_);
    } else if (const base::Value::List* list =
                   fonts->FindList("enabled_fonts")) {
      enabled_fonts_.clear();
      AppendFontsFromList(*list, &enabled_fonts_);
    } else if (const std::string* list = fonts->FindString("enabled_fonts")) {
      enabled_fonts_.clear();
      AppendFontsFromString(*list, &enabled_fonts_);
    }
  }

  // MediaDevices
  if (const base::Value::Dict* media = dict.FindDict("mediaDevices")) {
    if (const base::Value::List* list = media->FindList("devices")) {
      media_devices_.clear();
      AppendMediaDevicesFromList(*list, &media_devices_);
    }
  } else if (const base::Value::Dict* media =
                 dict.FindDict("media_devices")) {
    if (const base::Value::List* list = media->FindList("devices")) {
      media_devices_.clear();
      AppendMediaDevicesFromList(*list, &media_devices_);
    }
  }

  // Plugins / MimeTypes
  if (const base::Value::Dict* plugins = dict.FindDict("plugins")) {
    plugins_override_ = true;
    if (const base::Value::List* list = plugins->FindList("items")) {
      plugins_.clear();
      AppendPluginsFromList(*list, &plugins_);
    } else if (const base::Value::List* list =
                   plugins->FindList("plugins")) {
      plugins_.clear();
      AppendPluginsFromList(*list, &plugins_);
    }
  }

  // Profile Badge
  if (const base::Value::Dict* profile = dict.FindDict("profile")) {
    if (const std::string* id = profile->FindString("id")) {
      profile_id_ = TrimString(*id);
    } else if (const std::string* id = profile->FindString("profileId")) {
      profile_id_ = TrimString(*id);
    } else if (const std::string* id = profile->FindString("profile_id")) {
      profile_id_ = TrimString(*id);
    }
    if (const std::string* name = profile->FindString("name")) {
      profile_name_ = TrimString(*name);
    } else if (const std::string* name = profile->FindString("profileName")) {
      profile_name_ = TrimString(*name);
    } else if (const std::string* name = profile->FindString("profile_name")) {
      profile_name_ = TrimString(*name);
    }
    if (const std::string* color = profile->FindString("color")) {
      profile_color_ = TrimString(*color);
    } else if (const std::string* color = profile->FindString("profileColor")) {
      profile_color_ = TrimString(*color);
    } else if (const std::string* color = profile->FindString("profile_color")) {
      profile_color_ = TrimString(*color);
    }
  }
  // Also support top-level profile fields
  if (const std::string* id = dict.FindString("profile_id")) {
    profile_id_ = TrimString(*id);
  } else if (const std::string* id = dict.FindString("profileId")) {
    profile_id_ = TrimString(*id);
  }
  if (const std::string* name = dict.FindString("profile_name")) {
    profile_name_ = TrimString(*name);
  } else if (const std::string* name = dict.FindString("profileName")) {
    profile_name_ = TrimString(*name);
  }
  if (const std::string* color = dict.FindString("profile_color")) {
    profile_color_ = TrimString(*color);
  } else if (const std::string* color = dict.FindString("profileColor")) {
    profile_color_ = TrimString(*color);
  }

  // ClientRects noise
  if (const base::Value::Dict* client_rects = dict.FindDict("clientRects")) {
    if (auto enabled = client_rects->FindBool("noiseEnabled")) {
      client_rects_noise_enabled_ = *enabled;
    } else if (auto enabled = client_rects->FindBool("noise_enabled")) {
      client_rects_noise_enabled_ = *enabled;
    }
    if (auto factor = client_rects->FindDouble("noiseFactor")) {
      client_rects_noise_factor_ = static_cast<float>(*factor);
    } else if (auto factor = client_rects->FindDouble("noise_factor")) {
      client_rects_noise_factor_ = static_cast<float>(*factor);
    }
    if (auto seed = client_rects->FindInt("noiseSeed")) {
      client_rects_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = client_rects->FindInt("sessionSeed")) {
      client_rects_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = client_rects->FindInt("session_seed")) {
      client_rects_session_seed_ = static_cast<uint32_t>(*seed);
    }
  } else if (const base::Value::Dict* client_rects = dict.FindDict("client_rects")) {
    if (auto enabled = client_rects->FindBool("noiseEnabled")) {
      client_rects_noise_enabled_ = *enabled;
    } else if (auto enabled = client_rects->FindBool("noise_enabled")) {
      client_rects_noise_enabled_ = *enabled;
    }
    if (auto factor = client_rects->FindDouble("noiseFactor")) {
      client_rects_noise_factor_ = static_cast<float>(*factor);
    } else if (auto factor = client_rects->FindDouble("noise_factor")) {
      client_rects_noise_factor_ = static_cast<float>(*factor);
    }
    if (auto seed = client_rects->FindInt("noiseSeed")) {
      client_rects_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = client_rects->FindInt("sessionSeed")) {
      client_rects_session_seed_ = static_cast<uint32_t>(*seed);
    } else if (auto seed = client_rects->FindInt("session_seed")) {
      client_rects_session_seed_ = static_cast<uint32_t>(*seed);
    }
  }

  // Battery API
  if (const base::Value::Dict* battery = dict.FindDict("battery")) {
    if (auto enabled = battery->FindBool("enabled")) {
      battery_enabled_ = *enabled;
    }
    if (auto charging = battery->FindBool("charging")) {
      battery_charging_ = *charging;
    }
    if (auto charging_time = battery->FindDouble("chargingTime")) {
      battery_charging_time_ = *charging_time;
    } else if (auto charging_time = battery->FindDouble("charging_time")) {
      battery_charging_time_ = *charging_time;
    }
    if (auto discharging_time = battery->FindDouble("dischargingTime")) {
      battery_discharging_time_ = *discharging_time;
    } else if (auto discharging_time = battery->FindDouble("discharging_time")) {
      battery_discharging_time_ = *discharging_time;
    }
    if (auto level = battery->FindDouble("level")) {
      battery_level_ = *level;
    }
  }

  // Geolocation
  if (const base::Value::Dict* geo = dict.FindDict("geolocation")) {
    if (auto enabled = geo->FindBool("enabled")) {
      geolocation_enabled_ = *enabled;
    }
    if (auto lat = geo->FindDouble("latitude")) {
      geolocation_latitude_ = *lat;
    }
    if (auto lng = geo->FindDouble("longitude")) {
      geolocation_longitude_ = *lng;
    }
    if (auto acc = geo->FindDouble("accuracy")) {
      geolocation_accuracy_ = *acc;
    }
  }

  // Speech Synthesis
  if (const base::Value::Dict* speech = dict.FindDict("speechSynthesis")) {
    if (auto enabled = speech->FindBool("enabled")) {
      speech_synthesis_enabled_ = *enabled;
    }
    if (const base::Value::List* voices = speech->FindList("voices")) {
      speech_voices_.clear();
      for (const auto& entry : *voices) {
        if (!entry.is_dict())
          continue;
        const base::Value::Dict& voice_dict = entry.GetDict();
        SpeechVoiceConfig voice;
        if (const std::string* name = voice_dict.FindString("name")) {
          voice.name = TrimString(*name);
        }
        if (const std::string* lang = voice_dict.FindString("lang")) {
          voice.lang = TrimString(*lang);
        }
        if (auto local = voice_dict.FindBool("localService")) {
          voice.local_service = *local;
        } else if (auto local = voice_dict.FindBool("local_service")) {
          voice.local_service = *local;
        }
        if (auto def = voice_dict.FindBool("default")) {
          voice.is_default = *def;
        } else if (auto def = voice_dict.FindBool("isDefault")) {
          voice.is_default = *def;
        } else if (auto def = voice_dict.FindBool("is_default")) {
          voice.is_default = *def;
        }
        speech_voices_.push_back(voice);
      }
    }
  } else if (const base::Value::Dict* speech = dict.FindDict("speech_synthesis")) {
    if (auto enabled = speech->FindBool("enabled")) {
      speech_synthesis_enabled_ = *enabled;
    }
    if (const base::Value::List* voices = speech->FindList("voices")) {
      speech_voices_.clear();
      for (const auto& entry : *voices) {
        if (!entry.is_dict())
          continue;
        const base::Value::Dict& voice_dict = entry.GetDict();
        SpeechVoiceConfig voice;
        if (const std::string* name = voice_dict.FindString("name")) {
          voice.name = TrimString(*name);
        }
        if (const std::string* lang = voice_dict.FindString("lang")) {
          voice.lang = TrimString(*lang);
        }
        if (auto local = voice_dict.FindBool("localService")) {
          voice.local_service = *local;
        } else if (auto local = voice_dict.FindBool("local_service")) {
          voice.local_service = *local;
        }
        if (auto def = voice_dict.FindBool("default")) {
          voice.is_default = *def;
        } else if (auto def = voice_dict.FindBool("isDefault")) {
          voice.is_default = *def;
        } else if (auto def = voice_dict.FindBool("is_default")) {
          voice.is_default = *def;
        }
        speech_voices_.push_back(voice);
      }
    }
  }

  // WebGPU adapter info
  if (const base::Value::Dict* webgpu = dict.FindDict("webgpu")) {
    if (const std::string* v = webgpu->FindString("vendor")) {
      webgpu_vendor_ = *v;
    }
    if (const std::string* v = webgpu->FindString("architecture")) {
      webgpu_architecture_ = *v;
    }
    if (const std::string* v = webgpu->FindString("device")) {
      webgpu_device_ = *v;
    }
    if (const std::string* v = webgpu->FindString("description")) {
      webgpu_description_ = *v;
    }
  }

  // Port scan protection
  if (auto v = dict.FindBool("portScanProtection")) {
    port_scan_protection_enabled_ = *v;
  } else if (auto v = dict.FindBool("port_scan_protection")) {
    port_scan_protection_enabled_ = *v;
  }

  // Port scan whitelist
  if (const base::Value::List* list = dict.FindList("portScanWhitelist")) {
    for (const auto& val : *list) {
      if (val.is_int()) {
        port_scan_whitelist_.push_back(val.GetInt());
      }
    }
  } else if (const base::Value::List* list = dict.FindList("port_scan_whitelist")) {
    for (const auto& val : *list) {
      if (val.is_int()) {
        port_scan_whitelist_.push_back(val.GetInt());
      }
    }
  }

  // TLS profile
  if (const base::Value::Dict* tls = dict.FindDict("tls")) {
    if (const std::string* profile = tls->FindString("profile")) {
      tls_profile_ = *profile;
    }
  }

  NormalizeAfterLoad();
  enabled_ = true;
  LOG(INFO) << "Fingerprint config loaded successfully";
  return true;
}

bool FingerprintConfig::LoadFromKeyValue(const std::string& content) {
  std::istringstream stream(content);
  std::string line;

  auto parse_bool = [](const std::string& value) -> bool {
    std::string lowered = base::ToLowerASCII(value);
    return lowered == "true" || lowered == "1" || lowered == "yes";
  };

  while (std::getline(stream, line)) {
    base::TrimWhitespaceASCII(line, base::TRIM_ALL, &line);
    if (line.empty() || line[0] == '#' || line[0] == ';')
      continue;
    size_t eq = line.find('=');
    if (eq == std::string::npos)
      continue;

    std::string key = line.substr(0, eq);
    std::string value = line.substr(eq + 1);
    base::TrimWhitespaceASCII(key, base::TRIM_ALL, &key);
    base::TrimWhitespaceASCII(value, base::TRIM_ALL, &value);
    if (key.empty())
      continue;

    if (key == "user_agent" || key == "userAgent") {
      user_agent_ = value;
    } else if (key == "platform") {
      platform_ = value;
    } else if (key == "vendor") {
      vendor_ = value;
    } else if (key == "language") {
      language_ = value;
    } else if (key == "languages") {
      languages_ = value;
    } else if (key == "accept_language" || key == "accept_languages" ||
               key == "acceptLanguage") {
      accept_languages_ = value;
    } else if (key == "hardware_concurrency") {
      int parsed = 0;
      if (base::StringToInt(value, &parsed))
        hardware_concurrency_ = static_cast<unsigned int>(parsed);
    } else if (key == "device_memory") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        device_memory_ = static_cast<float>(parsed);
    } else if (key == "screen_width") {
      int parsed = 0;
      if (base::StringToInt(value, &parsed))
        screen_width_ = parsed;
    } else if (key == "screen_height") {
      int parsed = 0;
      if (base::StringToInt(value, &parsed))
        screen_height_ = parsed;
    } else if (key == "screen_avail_width") {
      int parsed = 0;
      if (base::StringToInt(value, &parsed))
        screen_avail_width_ = parsed;
    } else if (key == "screen_avail_height") {
      int parsed = 0;
      if (base::StringToInt(value, &parsed))
        screen_avail_height_ = parsed;
    } else if (key == "screen_color_depth") {
      int parsed = 0;
      if (base::StringToInt(value, &parsed))
        color_depth_ = parsed;
    } else if (key == "device_pixel_ratio") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        device_pixel_ratio_ = static_cast<float>(parsed);
    } else if (key == "webgl_vendor") {
      webgl_vendor_ = value;
    } else if (key == "webgl_renderer") {
      webgl_renderer_ = value;
    } else if (key == "webgl_unmasked_vendor") {
      webgl_unmasked_vendor_ = value;
    } else if (key == "webgl_unmasked_renderer") {
      webgl_unmasked_renderer_ = value;
    } else if (key == "webgl_gl_version") {
      webgl_gl_version_ = value;
    } else if (key == "webgl_shading_language_version") {
      webgl_shading_language_version_ = value;
    } else if (key == "canvas_noise_enabled") {
      canvas_noise_enabled_ = parse_bool(value);
    } else if (key == "canvas_noise_level" || key == "canvas_noise_factor") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        canvas_noise_factor_ = static_cast<float>(parsed);
    } else if (key == "canvas_session_seed") {
      uint32_t parsed = 0;
      if (base::StringToUint(value, &parsed))
        canvas_session_seed_ = parsed;
    } else if (key == "audio_noise_enabled") {
      audio_noise_enabled_ = parse_bool(value);
    } else if (key == "audio_noise_level" || key == "audio_noise_factor") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        audio_noise_factor_ = static_cast<float>(parsed);
    } else if (key == "audio_session_seed") {
      uint32_t parsed = 0;
      if (base::StringToUint(value, &parsed))
        audio_session_seed_ = parsed;
    } else if (key == "webrtc_disabled" || key == "webrtc_disable") {
      webrtc_disabled_ = parse_bool(value);
    } else if (key == "webrtc_public_ip") {
      webrtc_public_ip_ = value;
    } else if (key == "webrtc_local_ip") {
      webrtc_local_ip_ = value;
    } else if (key == "block_font_enumeration") {
      block_font_enumeration_ = parse_bool(value);
    } else if (key == "fonts_enabled" || key == "enabled_fonts") {
      enabled_fonts_.clear();
      AppendFontsFromString(value, &enabled_fonts_);
    } else if (key == "profile_id" || key == "profileId") {
      profile_id_ = value;
    } else if (key == "profile_name" || key == "profileName") {
      profile_name_ = value;
    } else if (key == "profile_color" || key == "profileColor") {
      profile_color_ = value;
    } else if (key == "client_rects_noise_enabled") {
      client_rects_noise_enabled_ = parse_bool(value);
    } else if (key == "client_rects_noise_factor") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        client_rects_noise_factor_ = static_cast<float>(parsed);
    } else if (key == "client_rects_session_seed") {
      uint32_t parsed = 0;
      if (base::StringToUint(value, &parsed))
        client_rects_session_seed_ = parsed;
    } else if (key == "battery_enabled") {
      battery_enabled_ = parse_bool(value);
    } else if (key == "battery_charging") {
      battery_charging_ = parse_bool(value);
    } else if (key == "battery_level") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        battery_level_ = parsed;
    } else if (key == "geolocation_enabled") {
      geolocation_enabled_ = parse_bool(value);
    } else if (key == "geolocation_latitude") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        geolocation_latitude_ = parsed;
    } else if (key == "geolocation_longitude") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        geolocation_longitude_ = parsed;
    } else if (key == "geolocation_accuracy") {
      double parsed = 0.0;
      if (base::StringToDouble(value, &parsed))
        geolocation_accuracy_ = parsed;
    } else if (key == "tls_profile") {
      tls_profile_ = value;
    }
  }

  NormalizeAfterLoad();
  enabled_ = true;
  LOG(INFO) << "Fingerprint config loaded successfully";
  return true;
}

void FingerprintConfig::NormalizeAfterLoad() {
  if (languages_.empty() && !language_.empty())
    languages_ = language_;

  if (!languages_.empty()) {
    std::istringstream lang_stream(languages_);
    std::string token;
    std::string cleaned;
    while (std::getline(lang_stream, token, ',')) {
      base::TrimWhitespaceASCII(token, base::TRIM_ALL, &token);
      size_t semicolon = token.find(';');
      if (semicolon != std::string::npos)
        token = token.substr(0, semicolon);
      base::TrimWhitespaceASCII(token, base::TRIM_ALL, &token);
      if (token.empty())
        continue;
      if (!cleaned.empty())
        cleaned += ",";
      cleaned += token;
    }
    if (!cleaned.empty())
      languages_ = cleaned;
  }

  if (language_.empty() && !languages_.empty()) {
    std::string first_language = languages_;
    size_t comma = first_language.find(',');
    if (comma != std::string::npos)
      first_language = first_language.substr(0, comma);
    base::TrimWhitespaceASCII(first_language, base::TRIM_ALL, &first_language);
    if (!first_language.empty())
      language_ = first_language;
  }

  if (accept_languages_.empty() && !languages_.empty()) {
    accept_languages_ = languages_;
  } else if (!accept_languages_.empty()) {
    std::istringstream accept_stream(accept_languages_);
    std::string token;
    std::string cleaned;
    while (std::getline(accept_stream, token, ',')) {
      base::TrimWhitespaceASCII(token, base::TRIM_ALL, &token);
      size_t semicolon = token.find(';');
      if (semicolon != std::string::npos)
        token = token.substr(0, semicolon);
      base::TrimWhitespaceASCII(token, base::TRIM_ALL, &token);
      if (token.empty())
        continue;
      if (!cleaned.empty())
        cleaned += ",";
      cleaned += token;
    }
    if (!cleaned.empty())
      accept_languages_ = cleaned;
  }

  if (!enabled_fonts_.empty()) {
    std::vector<std::string> cleaned_fonts;
    for (const auto& font : enabled_fonts_) {
      std::string normalized = NormalizeFontName(font);
      if (normalized.empty())
        continue;
      if (std::find(cleaned_fonts.begin(), cleaned_fonts.end(), normalized) !=
          cleaned_fonts.end())
        continue;
      cleaned_fonts.push_back(normalized);
    }
    enabled_fonts_.swap(cleaned_fonts);
  }

  if (!media_devices_.empty()) {
    std::vector<MediaDeviceConfig> cleaned_devices;
    for (auto device : media_devices_) {
      device.kind = NormalizeMediaKind(device.kind);
      if (!IsSupportedMediaKind(device.kind))
        continue;
      device.device_id = TrimString(device.device_id);
      device.group_id = TrimString(device.group_id);
      device.label = TrimString(device.label);
      cleaned_devices.push_back(device);
    }
    media_devices_.swap(cleaned_devices);
  }

  if (!plugins_.empty()) {
    std::vector<PluginConfig> cleaned_plugins;
    for (auto plugin : plugins_) {
      plugin.name = TrimString(plugin.name);
      if (plugin.name.empty())
        continue;
      plugin.description = TrimString(plugin.description);
      plugin.filename = TrimString(plugin.filename);
      std::vector<MimeTypeConfig> cleaned_mimes;
      for (auto mime : plugin.mime_types) {
        mime.type = TrimString(mime.type);
        if (mime.type.empty())
          continue;
        mime.description = TrimString(mime.description);
        mime.suffixes = TrimString(mime.suffixes);
        cleaned_mimes.push_back(mime);
      }
      plugin.mime_types.swap(cleaned_mimes);
      cleaned_plugins.push_back(plugin);
    }
    plugins_.swap(cleaned_plugins);
  }

  if (audio_session_seed_ == 0)
    audio_session_seed_ = canvas_session_seed_;

  if (client_rects_session_seed_ == 0)
    client_rects_session_seed_ = canvas_session_seed_;
}

bool FingerprintConfig::IsFontAllowed(const std::string& family,
                                      bool is_generic) const {
  if (!enabled_ || !block_font_enumeration_)
    return true;
  if (is_generic)
    return true;

  std::string normalized = NormalizeFontName(family);
  if (normalized.empty())
    return false;
  if (enabled_fonts_.empty())
    return false;

  return std::find(enabled_fonts_.begin(), enabled_fonts_.end(), normalized) !=
         enabled_fonts_.end();
}

bool FingerprintConfig::IsPortWhitelisted(int port) const {
  return std::find(port_scan_whitelist_.begin(), port_scan_whitelist_.end(),
                   port) != port_scan_whitelist_.end();
}

#pragma clang diagnostic pop

}  // namespace blink
