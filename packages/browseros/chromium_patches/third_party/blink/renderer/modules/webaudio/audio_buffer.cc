diff --git a/third_party/blink/renderer/modules/webaudio/audio_buffer.cc b/third_party/blink/renderer/modules/webaudio/audio_buffer.cc
index 40a355dec4..750e2bc048 100644
--- a/third_party/blink/renderer/modules/webaudio/audio_buffer.cc
+++ b/third_party/blink/renderer/modules/webaudio/audio_buffer.cc
@@ -40,6 +40,9 @@
 #include "third_party/blink/renderer/platform/bindings/exception_state.h"
 #include "third_party/blink/renderer/platform/wtf/text/strcat.h"
 
+// BrowserOS: Fingerprint config for audio noise
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
+
 namespace blink {
 
 AudioBuffer* AudioBuffer::Create(unsigned number_of_channels,
@@ -220,6 +223,8 @@ NotShared<DOMFloat32Array> AudioBuffer::getChannelData(unsigned channel_index) {
     return NotShared<DOMFloat32Array>(nullptr);
   }
 
+  ApplyFingerprintNoiseIfNeeded();
+
   return NotShared<DOMFloat32Array>(channels_[channel_index].Get());
 }
 
@@ -250,6 +255,8 @@ void AudioBuffer::copyFromChannel(NotShared<DOMFloat32Array> destination,
     return;
   }
 
+  ApplyFingerprintNoiseIfNeeded();
+
   base::span<const float> src = channels_[channel_number].Get()->AsSpan();
   base::span<float> dst = destination->AsSpan();
 
@@ -341,4 +348,55 @@ void SharedAudioBuffer::Zero() {
   }
 }
 
+// BrowserOS: Audio fingerprint noise helpers
+namespace {
+
+uint32_t AudioFingerprintXorShift32(uint32_t value) {
+  value ^= value << 13;
+  value ^= value >> 17;
+  value ^= value << 5;
+  return value;
+}
+
+}  // namespace
+
+void AudioBuffer::ApplyFingerprintNoiseIfNeeded() {
+  if (fingerprint_noise_applied_)
+    return;
+
+  auto& config = blink::FingerprintConfig::GetInstance();
+  if (!config.IsEnabled() || !config.GetAudioNoiseEnabled())
+    return;
+
+  fingerprint_noise_applied_ = true;
+
+  float noise_factor = config.GetAudioNoiseFactor();
+  uint32_t base_seed = config.GetAudioSessionSeed();
+  if (base_seed == 0 || noise_factor <= 0.0f)
+    return;
+
+  for (unsigned ch = 0; ch < channels_.size(); ++ch) {
+    DOMFloat32Array* channel_data = channels_[ch].Get();
+    if (!channel_data)
+      continue;
+
+    float* data = channel_data->Data();
+    unsigned length = channel_data->length();
+    uint32_t seed = base_seed + ch;
+
+    for (unsigned i = 0; i < length; ++i) {
+      float sample = data[i];
+      // Only perturb non-silent samples to avoid detection
+      if (sample == 0.0f)
+        continue;
+      seed = AudioFingerprintXorShift32(seed ^ (i * 2654435761u));
+      // Multiplicative noise: scale the sample by (1 + tiny_delta)
+      float delta = (static_cast<float>(seed) /
+                      static_cast<float>(UINT32_MAX) - 0.5f) *
+                     2.0f * noise_factor;
+      data[i] = sample * (1.0f + delta);
+    }
+  }
+}
+
 }  // namespace blink
