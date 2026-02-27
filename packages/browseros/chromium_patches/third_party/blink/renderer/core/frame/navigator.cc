diff --git a/third_party/blink/renderer/core/frame/navigator.cc b/third_party/blink/renderer/core/frame/navigator.cc
index 1a73d4a8f0..e8dc83768d 100644
--- a/third_party/blink/renderer/core/frame/navigator.cc
+++ b/third_party/blink/renderer/core/frame/navigator.cc
@@ -23,6 +23,7 @@
 
 #include "third_party/blink/renderer/core/frame/navigator.h"
 
+#include <cctype>
 #include "third_party/blink/public/common/user_agent/user_agent_metadata.h"
 #include "third_party/blink/renderer/bindings/core/v8/script_controller.h"
 #include "third_party/blink/renderer/core/dom/document.h"
@@ -35,11 +36,208 @@
 #include "third_party/blink/renderer/core/page/chrome_client.h"
 #include "third_party/blink/renderer/core/page/page.h"
 #include "third_party/blink/renderer/core/probe/core_probes.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "third_party/blink/renderer/platform/instrumentation/memory_pressure_listener.h"
 #include "third_party/blink/renderer/platform/language.h"
 
 namespace blink {
 
+namespace {
+
+std::string ToLowerASCII(const std::string& input) {
+  std::string out = input;
+  for (char& c : out)
+    c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
+  return out;
+}
+
+std::string ExtractTokenAfter(const std::string& ua, const std::string& token) {
+  size_t pos = ua.find(token);
+  if (pos == std::string::npos)
+    return std::string();
+  pos += token.size();
+  size_t end = ua.find_first_of(" ;) ", pos);
+  if (end == std::string::npos)
+    end = ua.size();
+  return ua.substr(pos, end - pos);
+}
+
+std::string ExtractChromeFullVersion(const std::string& ua) {
+  std::string version = ExtractTokenAfter(ua, "Chrome/");
+  if (version.empty())
+    version = ExtractTokenAfter(ua, "Chromium/");
+  if (version.empty())
+    version = ExtractTokenAfter(ua, "BrowserOS/");
+  return version;
+}
+
+std::string ExtractMajorVersion(const std::string& version) {
+  size_t dot = version.find('.');
+  if (dot == std::string::npos)
+    return version;
+  return version.substr(0, dot);
+}
+
+std::string FilterVersionString(const std::string& raw) {
+  std::string filtered;
+  for (char c : raw) {
+    if ((c >= '0' && c <= '9') || c == '.' || c == '_')
+      filtered.push_back(c);
+    else
+      break;
+  }
+  for (char& c : filtered) {
+    if (c == '_')
+      c = '.';
+  }
+  return filtered;
+}
+
+std::string NormalizeVersionThreeParts(const std::string& raw) {
+  std::string version = FilterVersionString(raw);
+  if (version.empty())
+    return version;
+
+  size_t first = version.find('.');
+  if (first == std::string::npos)
+    return version + ".0.0";
+  size_t second = version.find('.', first + 1);
+  if (second == std::string::npos)
+    return version + ".0";
+  size_t third = version.find('.', second + 1);
+  if (third != std::string::npos)
+    version = version.substr(0, third);
+  return version;
+}
+
+std::string NormalizePlatform(const std::string& platform,
+                              const std::string& ua) {
+  if (!platform.empty()) {
+    if (platform.find("Win") != std::string::npos)
+      return "Windows";
+    if (platform.find("Mac") != std::string::npos)
+      return "macOS";
+    if (platform.find("Linux") != std::string::npos)
+      return "Linux";
+    if (platform.find("Android") != std::string::npos)
+      return "Android";
+  }
+
+  if (ua.find("Windows NT") != std::string::npos)
+    return "Windows";
+  if (ua.find("Mac OS X") != std::string::npos)
+    return "macOS";
+  if (ua.find("Android") != std::string::npos)
+    return "Android";
+  if (ua.find("Linux") != std::string::npos)
+    return "Linux";
+  return std::string();
+}
+
+std::string ExtractPlatformVersion(const std::string& ua,
+                                   const std::string& platform) {
+  if (platform == "Windows") {
+    std::string version = ExtractTokenAfter(ua, "Windows NT ");
+    return NormalizeVersionThreeParts(version);
+  }
+
+  if (platform == "macOS") {
+    std::string version = ExtractTokenAfter(ua, "Mac OS X ");
+    return NormalizeVersionThreeParts(version);
+  }
+
+  if (platform == "Android") {
+    std::string version = ExtractTokenAfter(ua, "Android ");
+    return NormalizeVersionThreeParts(version);
+  }
+
+  return std::string();
+}
+
+std::string DetectArchitecture(const std::string& ua) {
+  std::string lower = ToLowerASCII(ua);
+  if (lower.find("arm64") != std::string::npos ||
+      lower.find("aarch64") != std::string::npos) {
+    return "arm";
+  }
+  if (lower.find("x86_64") != std::string::npos ||
+      lower.find("amd64") != std::string::npos ||
+      lower.find("win64") != std::string::npos ||
+      lower.find("x64") != std::string::npos ||
+      lower.find("i686") != std::string::npos ||
+      lower.find("i386") != std::string::npos) {
+    return "x86";
+  }
+  return std::string();
+}
+
+std::string DetectBitness(const std::string& ua) {
+  std::string lower = ToLowerASCII(ua);
+  if (lower.find("arm64") != std::string::npos ||
+      lower.find("aarch64") != std::string::npos ||
+      lower.find("x86_64") != std::string::npos ||
+      lower.find("amd64") != std::string::npos ||
+      lower.find("win64") != std::string::npos ||
+      lower.find("x64") != std::string::npos) {
+    return "64";
+  }
+  if (lower.find("i686") != std::string::npos ||
+      lower.find("i386") != std::string::npos) {
+    return "32";
+  }
+  return std::string();
+}
+
+bool DetectWow64(const std::string& ua) {
+  std::string lower = ToLowerASCII(ua);
+  return lower.find("wow64") != std::string::npos;
+}
+
+bool IsMobileUA(const std::string& ua) {
+  std::string lower = ToLowerASCII(ua);
+  return lower.find("mobile") != std::string::npos ||
+         lower.find("android") != std::string::npos ||
+         lower.find("iphone") != std::string::npos;
+}
+
+UserAgentMetadata BuildUserAgentMetadataFromConfig(
+    const FingerprintConfig& config) {
+  UserAgentMetadata metadata;
+
+  std::string ua = config.GetUserAgent();
+  std::string full_version = ExtractChromeFullVersion(ua);
+  std::string major_version = ExtractMajorVersion(full_version);
+  if (major_version.empty())
+    major_version = "99";
+
+  metadata.brand_version_list = {
+      {"Not.A/Brand", "99"},
+      {"Chromium", major_version},
+      {"Google Chrome", major_version},
+  };
+
+  if (full_version.empty())
+    full_version = major_version + ".0.0.0";
+  metadata.full_version = full_version;
+  metadata.brand_full_version_list = {
+      {"Not.A/Brand", "99.0.0.0"},
+      {"Chromium", full_version},
+      {"Google Chrome", full_version},
+  };
+  metadata.platform = NormalizePlatform(config.GetPlatform(), ua);
+  metadata.platform_version = ExtractPlatformVersion(ua, metadata.platform);
+  metadata.architecture = DetectArchitecture(ua);
+  metadata.bitness = DetectBitness(ua);
+  metadata.wow64 = DetectWow64(ua);
+  metadata.model = std::string();
+  metadata.mobile = IsMobileUA(ua);
+  metadata.form_factors = {metadata.mobile ? kMobileFormFactor
+                                           : kDesktopFormFactor};
+  return metadata;
+}
+
+}  // namespace
+
 Navigator::Navigator(ExecutionContext* context) : NavigatorBase(context) {}
 
 String Navigator::productSub() const {
@@ -47,6 +245,12 @@ String Navigator::productSub() const {
 }
 
 String Navigator::vendor() const {
+  // BrowserOS: Return custom vendor if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && !config.GetVendor().empty()) {
+    return String::FromUTF8(config.GetVendor());
+  }
+
   // Do not change without good cause. History:
   // https://code.google.com/p/chromium/issues/detail?id=276813
   // https://www.w3.org/Bugs/Public/show_bug.cgi?id=27786
@@ -62,6 +266,13 @@ String Navigator::platform() const {
   // TODO(955620): Consider changing devtools overrides to only allow overriding
   // the platform with a frozen platform to distinguish between
   // mobile and desktop when ReduceUserAgent is enabled.
+
+  // BrowserOS: Return custom platform if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && !config.GetPlatform().empty()) {
+    return String::FromUTF8(config.GetPlatform());
+  }
+
   if (!DomWindow())
     return NavigatorBase::platform();
   const String& platform_override =
@@ -70,6 +281,37 @@ String Navigator::platform() const {
                                    : platform_override;
 }
 
+String Navigator::userAgent() const {
+  // BrowserOS: Return custom userAgent if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && !config.GetUserAgent().empty()) {
+    return String::FromUTF8(config.GetUserAgent());
+  }
+
+  // If the frame is already detached it no longer has a meaningful useragent.
+  if (!DomWindow() || !DomWindow()->GetFrame() ||
+      !DomWindow()->GetFrame()->GetPage())
+    return String();
+
+  return DomWindow()->UserAgent();
+}
+
+UserAgentMetadata Navigator::GetUserAgentMetadata() const {
+  // If the frame is already detached it no longer has a meaningful useragent.
+  if (!DomWindow() || !DomWindow()->GetFrame() ||
+      !DomWindow()->GetFrame()->GetPage())
+    return blink::UserAgentMetadata();
+
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && !config.GetUserAgent().empty()) {
+    return BuildUserAgentMetadataFromConfig(config);
+  }
+
+  std::optional<UserAgentMetadata> maybe_ua_metadata =
+      DomWindow()->GetFrame()->Loader().UserAgentMetadata();
+  return maybe_ua_metadata.value_or(blink::UserAgentMetadata());
+}
+
 bool Navigator::cookieEnabled() const {
   if (!DomWindow())
     return false;
@@ -101,15 +343,17 @@ bool Navigator::cookieEnabled() const {
 }
 
 bool Navigator::webdriver() const {
-  if (RuntimeEnabledFeatures::AutomationControlledEnabled())
-    return true;
-
-  bool automation_enabled = false;
-  probe::ApplyAutomationOverride(GetExecutionContext(), automation_enabled);
-  return automation_enabled;
+  // BrowserOS: Always return false to avoid detection
+  return false;
 }
 
 String Navigator::GetAcceptLanguages() {
+  // BrowserOS: Return custom Accept-Language if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && !config.GetAcceptLanguages().empty()) {
+    return String::FromUTF8(config.GetAcceptLanguages());
+  }
+
   if (!DomWindow())
     return DefaultLanguage();
 
