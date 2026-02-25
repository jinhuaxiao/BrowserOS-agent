diff --git a/third_party/blink/renderer/modules/webaudio/audio_buffer.h b/third_party/blink/renderer/modules/webaudio/audio_buffer.h
index 5a6b7c8d9e0f1..fingerprint123 100644
--- a/third_party/blink/renderer/modules/webaudio/audio_buffer.h
+++ b/third_party/blink/renderer/modules/webaudio/audio_buffer.h
@@ -93,6 +93,8 @@ class MODULES_EXPORT AudioBuffer final : public ScriptWrappable {
  private:
   static DOMFloat32Array* CreateFloat32ArrayOrNull(
       uint32_t length,
       InitializationPolicy allocation_policy = kZeroInitialize);
+
+  void ApplyFingerprintNoiseIfNeeded();
 
   bool CreatedSuccessfully(unsigned desired_number_of_channels) const;
@@ -104,6 +106,7 @@ class MODULES_EXPORT AudioBuffer final : public ScriptWrappable {
   uint32_t length_;
 
   HeapVector<Member<DOMFloat32Array>> channels_;
+  bool fingerprint_noise_applied_ = false;
 };
