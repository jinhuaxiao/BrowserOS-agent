diff --git a/third_party/blink/renderer/modules/peerconnection/rtc_ice_candidate.cc b/third_party/blink/renderer/modules/peerconnection/rtc_ice_candidate.cc
index 1b2c3d4e5f6a7..fingerprint123 100644
--- a/third_party/blink/renderer/modules/peerconnection/rtc_ice_candidate.cc
+++ b/third_party/blink/renderer/modules/peerconnection/rtc_ice_candidate.cc
@@ -24,7 +24,9 @@
 
 #include "third_party/blink/renderer/modules/peerconnection/rtc_ice_candidate.h"
 
 #include <utility>
+#include <vector>
 
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "third_party/blink/renderer/bindings/core/v8/script_value.h"
 #include "third_party/blink/renderer/bindings/core/v8/v8_object_builder.h"
@@ -39,4 +43,108 @@
 #include "third_party/blink/renderer/platform/heap/heap.h"
 #include "third_party/blink/renderer/platform/instrumentation/use_counter.h"
 
 namespace blink {
+
+namespace {
+
+std::vector<std::string> SplitBySpaces(const std::string& input) {
+  std::vector<std::string> parts;
+  std::string current;
+  for (char c : input) {
+    if (c == ' ') {
+      if (!current.empty()) {
+        parts.push_back(current);
+        current.clear();
+      }
+    } else {
+      current.push_back(c);
+    }
+  }
+  if (!current.empty())
+    parts.push_back(current);
+  return parts;
+}
+
+std::string JoinBySpaces(const std::vector<std::string>& parts) {
+  std::string joined;
+  for (size_t i = 0; i < parts.size(); ++i) {
+    if (i)
+      joined += " ";
+    joined += parts[i];
+  }
+  return joined;
+}
+
+std::string ExtractCandidateType(const std::vector<std::string>& parts) {
+  for (size_t i = 0; i + 1 < parts.size(); ++i) {
+    if (parts[i] == "typ")
+      return parts[i + 1];
+  }
+  return std::string();
+}
+
+std::string ChooseWebRTCReplacement(const std::vector<std::string>& parts,
+                                    const FingerprintConfig& config) {
+  std::string type = ExtractCandidateType(parts);
+  if (type == "host" && !config.GetWebRTCLocalIp().empty())
+    return config.GetWebRTCLocalIp();
+  if ((type == "srflx" || type == "relay") &&
+      !config.GetWebRTCPublicIp().empty())
+    return config.GetWebRTCPublicIp();
+  if (!config.GetWebRTCPublicIp().empty())
+    return config.GetWebRTCPublicIp();
+  if (!config.GetWebRTCLocalIp().empty())
+    return config.GetWebRTCLocalIp();
+  return std::string();
+}
+
+String RewriteCandidateStringIfNeeded(const String& candidate,
+                                      const FingerprintConfig& config) {
+  if (!config.IsEnabled())
+    return candidate;
+
+  if (config.IsWebRTCDisabled())
+    return String();
+
+  std::string utf8 = candidate.Utf8();
+  if (utf8.empty())
+    return candidate;
+
+  std::vector<std::string> parts = SplitBySpaces(utf8);
+  if (parts.size() < 5)
+    return candidate;
+
+  std::string replacement = ChooseWebRTCReplacement(parts, config);
+  if (replacement.empty())
+    return candidate;
+
+  parts[4] = replacement;
+  return String::FromUTF8(JoinBySpaces(parts));
+}
+
+String OverrideAddressIfNeeded(const String& original,
+                               const String& type,
+                               const FingerprintConfig& config,
+                               bool prefer_local) {
+  if (!config.IsEnabled())
+    return original;
+
+  if (config.IsWebRTCDisabled())
+    return String();
+
+  std::string type_utf8 = type.Utf8();
+  if (type_utf8 == "host" && !config.GetWebRTCLocalIp().empty())
+    return String::FromUTF8(config.GetWebRTCLocalIp());
+  if ((type_utf8 == "srflx" || type_utf8 == "relay") &&
+      !config.GetWebRTCPublicIp().empty())
+    return String::FromUTF8(config.GetWebRTCPublicIp());
+
+  if (prefer_local && !config.GetWebRTCLocalIp().empty())
+    return String::FromUTF8(config.GetWebRTCLocalIp());
+  if (!config.GetWebRTCPublicIp().empty())
+    return String::FromUTF8(config.GetWebRTCPublicIp());
+
+  return original;
+}
+
+}  // namespace
@@ -79,5 +165,6 @@ RTCIceCandidate::RTCIceCandidate(RTCIceCandidatePlatform* platform_candidate)
     : platform_candidate_(platform_candidate) {}
 
 String RTCIceCandidate::candidate() const {
-  return platform_candidate_->Candidate();
+  auto& config = FingerprintConfig::GetInstance();
+  return RewriteCandidateStringIfNeeded(platform_candidate_->Candidate(), config);
 }
@@ -119,6 +206,8 @@ base::Optional<uint32_t> RTCIceCandidate::priority() const {
   return platform_candidate_->Priority();
 }
 
 String RTCIceCandidate::address() const {
-  return platform_candidate_->Address();
+  auto& config = FingerprintConfig::GetInstance();
+  return OverrideAddressIfNeeded(platform_candidate_->Address(),
+                                 platform_candidate_->Type(), config, false);
 }
@@ -139,6 +228,8 @@ base::Optional<String> RTCIceCandidate::tcpType() const {
   return platform_candidate_->TcpType();
 }
 
 String RTCIceCandidate::relatedAddress() const {
-  return platform_candidate_->RelatedAddress();
+  auto& config = FingerprintConfig::GetInstance();
+  return OverrideAddressIfNeeded(platform_candidate_->RelatedAddress(),
+                                 platform_candidate_->Type(), config, true);
 }
@@ -156,6 +247,6 @@ String RTCIceCandidate::usernameFragment() const {
 ScriptValue RTCIceCandidate::toJSONForBinding(ScriptState* script_state) {
   V8ObjectBuilder result(script_state);
-  result.AddString("candidate", platform_candidate_->Candidate());
+  result.AddString("candidate", candidate());
   result.AddString("sdpMid", platform_candidate_->SdpMid());
   if (platform_candidate_->SdpMLineIndex())
     result.AddNumber("sdpMLineIndex", *platform_candidate_->SdpMLineIndex());
