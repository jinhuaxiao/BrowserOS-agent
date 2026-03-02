/*
 *  Copyright (C) 2000 Harri Porten (porten@kde.org)
 *  Copyright (c) 2000 Daniel Molkentin (molkentin@kde.org)
 *  Copyright (c) 2000 Stefan Schimanski (schimmi@kde.org)
 *  Copyright (C) 2003, 2004, 2005, 2006 Apple Computer, Inc.
 *  Copyright (C) 2008 Nokia Corporation and/or its subsidiary(-ies)
 *
 *  This library is free software; you can redistribute it and/or
 *  modify it under the terms of the GNU Lesser General Public
 *  License as published by the Free Software Foundation; either
 *  version 2 of the License, or (at your option) any later version.
 *
 *  This library is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public
 *  License along with this library; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 *  MA 02110-1301, USA
 */

#include "third_party/blink/renderer/core/frame/navigator.h"

#include <cctype>
#include <climits>
#include "third_party/blink/public/common/user_agent/user_agent_metadata.h"
#include "third_party/blink/renderer/bindings/core/v8/script_controller.h"
#include "third_party/blink/renderer/core/dom/document.h"
#include "third_party/blink/renderer/core/execution_context/navigator_base.h"
#include "third_party/blink/renderer/core/frame/local_dom_window.h"
#include "third_party/blink/renderer/core/frame/local_frame.h"
#include "third_party/blink/renderer/core/frame/settings.h"
#include "third_party/blink/renderer/core/inspector/console_message.h"
#include "third_party/blink/renderer/core/loader/frame_loader.h"
#include "third_party/blink/renderer/core/page/chrome_client.h"
#include "third_party/blink/renderer/core/page/page.h"
#include "third_party/blink/renderer/core/probe/core_probes.h"
#include "third_party/blink/common/fingerprint/fingerprint_config.h"
#include "third_party/blink/renderer/platform/instrumentation/memory_pressure_listener.h"
#include "third_party/blink/renderer/platform/language.h"

namespace blink {

namespace {

std::string ToLowerASCII(const std::string& input) {
  std::string out = input;
  for (char& c : out)
    c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return out;
}

std::string ExtractTokenAfter(const std::string& ua, const std::string& token) {
  size_t pos = ua.find(token);
  if (pos == std::string::npos)
    return std::string();
  pos += token.size();
  size_t end = ua.find_first_of(" ;) ", pos);
  if (end == std::string::npos)
    end = ua.size();
  return ua.substr(pos, end - pos);
}

std::string ExtractChromeFullVersion(const std::string& ua) {
  std::string version = ExtractTokenAfter(ua, "Chrome/");
  if (version.empty())
    version = ExtractTokenAfter(ua, "Chromium/");
  if (version.empty())
    version = ExtractTokenAfter(ua, "BrowserOS/");
  return version;
}

std::string ExtractMajorVersion(const std::string& version) {
  size_t dot = version.find('.');
  if (dot == std::string::npos)
    return version;
  return version.substr(0, dot);
}

std::string FilterVersionString(const std::string& raw) {
  std::string filtered;
  for (char c : raw) {
    if ((c >= '0' && c <= '9') || c == '.' || c == '_')
      filtered.push_back(c);
    else
      break;
  }
  for (char& c : filtered) {
    if (c == '_')
      c = '.';
  }
  return filtered;
}

std::string NormalizeVersionThreeParts(const std::string& raw) {
  std::string version = FilterVersionString(raw);
  if (version.empty())
    return version;

  size_t first = version.find('.');
  if (first == std::string::npos)
    return version + ".0.0";
  size_t second = version.find('.', first + 1);
  if (second == std::string::npos)
    return version + ".0";
  size_t third = version.find('.', second + 1);
  if (third != std::string::npos)
    version = version.substr(0, third);
  return version;
}

std::string NormalizePlatform(const std::string& platform,
                              const std::string& ua) {
  if (!platform.empty()) {
    if (platform.find("Win") != std::string::npos)
      return "Windows";
    if (platform.find("Mac") != std::string::npos)
      return "macOS";
    if (platform.find("Linux") != std::string::npos)
      return "Linux";
    if (platform.find("Android") != std::string::npos)
      return "Android";
  }

  if (ua.find("Windows NT") != std::string::npos)
    return "Windows";
  if (ua.find("Mac OS X") != std::string::npos)
    return "macOS";
  if (ua.find("Android") != std::string::npos)
    return "Android";
  if (ua.find("Linux") != std::string::npos)
    return "Linux";
  return std::string();
}

std::string ExtractPlatformVersion(const std::string& ua,
                                   const std::string& platform) {
  if (platform == "Windows") {
    std::string version = ExtractTokenAfter(ua, "Windows NT ");
    return NormalizeVersionThreeParts(version);
  }

  if (platform == "macOS") {
    std::string version = ExtractTokenAfter(ua, "Mac OS X ");
    return NormalizeVersionThreeParts(version);
  }

  if (platform == "Android") {
    std::string version = ExtractTokenAfter(ua, "Android ");
    return NormalizeVersionThreeParts(version);
  }

  return std::string();
}

std::string DetectArchitecture(const std::string& ua) {
  std::string lower = ToLowerASCII(ua);
  if (lower.find("arm64") != std::string::npos ||
      lower.find("aarch64") != std::string::npos) {
    return "arm";
  }
  if (lower.find("x86_64") != std::string::npos ||
      lower.find("amd64") != std::string::npos ||
      lower.find("win64") != std::string::npos ||
      lower.find("x64") != std::string::npos ||
      lower.find("i686") != std::string::npos ||
      lower.find("i386") != std::string::npos) {
    return "x86";
  }
  return std::string();
}

std::string DetectBitness(const std::string& ua) {
  std::string lower = ToLowerASCII(ua);
  if (lower.find("arm64") != std::string::npos ||
      lower.find("aarch64") != std::string::npos ||
      lower.find("x86_64") != std::string::npos ||
      lower.find("amd64") != std::string::npos ||
      lower.find("win64") != std::string::npos ||
      lower.find("x64") != std::string::npos) {
    return "64";
  }
  if (lower.find("i686") != std::string::npos ||
      lower.find("i386") != std::string::npos) {
    return "32";
  }
  return std::string();
}

bool DetectWow64(const std::string& ua) {
  std::string lower = ToLowerASCII(ua);
  return lower.find("wow64") != std::string::npos;
}

bool IsMobileUA(const std::string& ua) {
  std::string lower = ToLowerASCII(ua);
  return lower.find("mobile") != std::string::npos ||
         lower.find("android") != std::string::npos ||
         lower.find("iphone") != std::string::npos;
}

int SimpleAtoi(const std::string& s) {
  int result = 0;
  for (char c : s) {
    if (c >= '0' && c <= '9') {
      int digit = c - '0';
      if (result > (INT_MAX - digit) / 10) {
        return 99;  // safe fallback on overflow
      }
      result = result * 10 + digit;
    } else {
      break;
    }
  }
  return result;
}

UserAgentBrandVersion GenerateGreasedBrandVersion(int seed,
                                                   bool full_version) {
  const char* greasey_chars[] = {" ", "(", ":", "-", ".", "/",
                                 ")", ";", "=", "?", "_"};
  const char* greased_versions[] = {"8", "99", "24"};
  std::string brand = std::string("Not") + greasey_chars[seed % 11] + "A" +
                      greasey_chars[(seed + 1) % 11] + "Brand";
  std::string version = greased_versions[seed % 3];
  if (full_version)
    version += ".0.0.0";
  return {brand, version};
}

UserAgentBrandList ShuffleBrands(UserAgentBrandList list, int seed) {
  if (list.size() != 3)
    return list;
  static const int perms[6][3] = {{0, 1, 2}, {0, 2, 1}, {1, 0, 2},
                                   {1, 2, 0}, {2, 0, 1}, {2, 1, 0}};
  int idx = seed % 6;
  UserAgentBrandList shuffled(3);
  for (int i = 0; i < 3; i++) {
    shuffled[perms[idx][i]] = list[i];
  }
  return shuffled;
}

UserAgentMetadata BuildUserAgentMetadataFromConfig(
    const FingerprintConfig& config) {
  UserAgentMetadata metadata;

  std::string ua = config.GetUserAgent();
  std::string full_version = ExtractChromeFullVersion(ua);
  std::string major_version = ExtractMajorVersion(full_version);
  if (major_version.empty())
    major_version = "99";

  int seed = SimpleAtoi(major_version);

  metadata.brand_version_list = ShuffleBrands(
      {GenerateGreasedBrandVersion(seed, false),
       {"Chromium", major_version},
       {"Google Chrome", major_version}},
      seed);

  if (full_version.empty())
    full_version = major_version + ".0.0.0";
  metadata.full_version = full_version;
  metadata.brand_full_version_list = ShuffleBrands(
      {GenerateGreasedBrandVersion(seed, true),
       {"Chromium", full_version},
       {"Google Chrome", full_version}},
      seed);
  metadata.platform = NormalizePlatform(config.GetPlatform(), ua);
  metadata.platform_version = ExtractPlatformVersion(ua, metadata.platform);
  metadata.architecture = DetectArchitecture(ua);
  metadata.bitness = DetectBitness(ua);
  metadata.wow64 = DetectWow64(ua);
  metadata.model = std::string();
  metadata.mobile = IsMobileUA(ua);
  metadata.form_factors = {metadata.mobile ? kMobileFormFactor
                                           : kDesktopFormFactor};
  return metadata;
}

}  // namespace

Navigator::Navigator(ExecutionContext* context) : NavigatorBase(context) {}

String Navigator::productSub() const {
  return "20030107";
}

String Navigator::vendor() const {
  // BrowserOS: Return custom vendor if fingerprint config is enabled
  auto& config = FingerprintConfig::GetInstance();
  if (config.IsEnabled() && !config.GetVendor().empty()) {
    return String::FromUTF8(config.GetVendor());
  }

  // Do not change without good cause. History:
  // https://code.google.com/p/chromium/issues/detail?id=276813
  // https://www.w3.org/Bugs/Public/show_bug.cgi?id=27786
  // https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/QrgyulnqvmE
  return "Google Inc.";
}

String Navigator::vendorSub() const {
  return "";
}

String Navigator::platform() const {
  // TODO(955620): Consider changing devtools overrides to only allow overriding
  // the platform with a frozen platform to distinguish between
  // mobile and desktop when ReduceUserAgent is enabled.

  // BrowserOS: Return custom platform if fingerprint config is enabled
  auto& config = FingerprintConfig::GetInstance();
  if (config.IsEnabled() && !config.GetPlatform().empty()) {
    return String::FromUTF8(config.GetPlatform());
  }

  if (!DomWindow())
    return NavigatorBase::platform();
  const String& platform_override =
      DomWindow()->GetFrame()->GetSettings()->GetNavigatorPlatformOverride();
  return platform_override.empty() ? NavigatorBase::platform()
                                   : platform_override;
}

String Navigator::userAgent() const {
  // BrowserOS: Return custom userAgent if fingerprint config is enabled
  auto& config = FingerprintConfig::GetInstance();
  if (config.IsEnabled() && !config.GetUserAgent().empty()) {
    return String::FromUTF8(config.GetUserAgent());
  }

  // If the frame is already detached it no longer has a meaningful useragent.
  if (!DomWindow() || !DomWindow()->GetFrame() ||
      !DomWindow()->GetFrame()->GetPage())
    return String();

  return DomWindow()->UserAgent();
}

UserAgentMetadata Navigator::GetUserAgentMetadata() const {
  // If the frame is already detached it no longer has a meaningful useragent.
  if (!DomWindow() || !DomWindow()->GetFrame() ||
      !DomWindow()->GetFrame()->GetPage())
    return blink::UserAgentMetadata();

  auto& config = FingerprintConfig::GetInstance();
  if (config.IsEnabled() && !config.GetUserAgent().empty()) {
    return BuildUserAgentMetadataFromConfig(config);
  }

  std::optional<UserAgentMetadata> maybe_ua_metadata =
      DomWindow()->GetFrame()->Loader().UserAgentMetadata();
  return maybe_ua_metadata.value_or(blink::UserAgentMetadata());
}

bool Navigator::cookieEnabled() const {
  if (!DomWindow())
    return false;

  if (DomWindow()->GetStorageKey().IsThirdPartyContext()) {
    DomWindow()->CountUse(WebFeature::kNavigatorCookieEnabledThirdParty);
  }

  Settings* settings = DomWindow()->GetFrame()->GetSettings();
  bool cookie_enabled = settings && settings->GetCookieEnabled();

#if !BUILDFLAG(IS_ANDROID)
  // We don't want to print this message for WebView, and the utility is much
  // lower for all Android platforms anyway, so it seems reasonable to skip.
  if (cookie_enabled && DomWindow()->Url().IsLocalFile()) {
    DomWindow()->AddConsoleMessage(
        MakeGarbageCollected<ConsoleMessage>(
            mojom::blink::ConsoleMessageSource::kJavaScript,
            mojom::blink::ConsoleMessageLevel::kWarning,
            "While navigator.cookieEnabled does return true for this file:// "
            "URL, this is done for web compatability reasons. Cookies will not "
            "actually be stored for file:// URLs. If you want this to change "
            "please leave feedback on crbug.com/378604901."),
        /*discard_duplicates=*/true);
  }
#endif

  return cookie_enabled;
}

bool Navigator::webdriver() const {
  // BrowserOS: Always return false to avoid detection
  return false;
}

String Navigator::GetAcceptLanguages() {
  // BrowserOS: Return custom Accept-Language if fingerprint config is enabled
  auto& config = FingerprintConfig::GetInstance();
  if (config.IsEnabled() && !config.GetAcceptLanguages().empty()) {
    return String::FromUTF8(config.GetAcceptLanguages());
  }

  if (!DomWindow())
    return DefaultLanguage();

  return DomWindow()
      ->GetFrame()
      ->GetPage()
      ->GetChromeClient()
      .AcceptLanguages();
}

void Navigator::Trace(Visitor* visitor) const {
  NavigatorBase::Trace(visitor);
  Supplementable<Navigator>::Trace(visitor);
}

}  // namespace blink
