diff --git a/third_party/blink/renderer/modules/webaudio/audio_buffer.h b/third_party/blink/renderer/modules/webaudio/audio_buffer.h
index 2e798e3e5b..d2d67919b9 100644
--- a/third_party/blink/renderer/modules/webaudio/audio_buffer.h
+++ b/third_party/blink/renderer/modules/webaudio/audio_buffer.h
@@ -121,12 +121,15 @@ class MODULES_EXPORT AudioBuffer final : public ScriptWrappable {
       InitializationPolicy allocation_policy =
           InitializationPolicy::kZeroInitialize);
 
+  void ApplyFingerprintNoiseIfNeeded();
+
   bool CreatedSuccessfully(unsigned desired_number_of_channels) const;
 
   float sample_rate_;
   uint32_t length_;
 
   HeapVector<Member<DOMFloat32Array>> channels_;
+  bool fingerprint_noise_applied_ = false;
 };
 
 // Shared data that audio threads can hold onto.
