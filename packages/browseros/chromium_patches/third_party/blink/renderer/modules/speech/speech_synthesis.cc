diff --git a/third_party/blink/renderer/modules/speech/speech_synthesis.cc b/third_party/blink/renderer/modules/speech/speech_synthesis.cc
index 1234567890abc..fedcba0987654 100644
--- a/third_party/blink/renderer/modules/speech/speech_synthesis.cc
+++ b/third_party/blink/renderer/modules/speech/speech_synthesis.cc
@@ -6,6 +6,7 @@

 #include <algorithm>

+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "build/build_config.h"
 #include "third_party/blink/public/common/thread_safe_browser_interface_broker_proxy.h"
 #include "third_party/blink/public/platform/platform.h"
@@ -29,6 +30,36 @@ SpeechSynthesis* SpeechSynthesis::Create(ExecutionContext* context) {
   return MakeGarbageCollected<SpeechSynthesis>(context);
 }

+namespace {
+
+// Build a spoofed voice list from FingerprintConfig
+HeapVector<Member<SpeechSynthesisVoice>> BuildSpoofedVoices() {
+  HeapVector<Member<SpeechSynthesisVoice>> voices;
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  const auto& voice_configs = config.GetSpeechVoices();
+
+  for (const auto& vc : voice_configs) {
+    auto mojom_voice = mojom::blink::SpeechSynthesisVoice::New();
+    mojom_voice->voice_uri = String::FromUTF8(vc.name);
+    mojom_voice->name = String::FromUTF8(vc.name);
+    mojom_voice->lang = String::FromUTF8(vc.lang);
+    mojom_voice->is_local_service = vc.local_service;
+    mojom_voice->is_default = vc.is_default;
+    voices.push_back(
+        MakeGarbageCollected<SpeechSynthesisVoice>(std::move(mojom_voice)));
+  }
+
+  return voices;
+}
+
+}  // namespace
+
 const HeapVector<Member<SpeechSynthesisVoice>>& SpeechSynthesis::getVoices() {
+  // Nova Seller: Return configured voice list if available
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetSpeechSynthesisEnabled() &&
+      config.HasSpeechVoices()) {
+    if (voice_list_.empty()) {
+      voice_list_ = BuildSpoofedVoices();
+    }
+    return voice_list_;
+  }
+
   if (voice_list_needs_update_) {
     voice_list_needs_update_ = false;
     // Only return voices that are in the allow list, if the
