diff --git a/third_party/blink/renderer/modules/webaudio/audio_buffer.h b/third_party/blink/renderer/modules/webaudio/audio_buffer.h
index 2e798e3e5b..0857e5559a 100644
--- a/third_party/blink/renderer/modules/webaudio/audio_buffer.h
+++ b/third_party/blink/renderer/modules/webaudio/audio_buffer.h
@@ -115,6 +115,9 @@ class MODULES_EXPORT AudioBuffer final : public ScriptWrappable {
 
   std::unique_ptr<SharedAudioBuffer> CreateSharedAudioBuffer();
 
+  void ApplyFingerprintNoiseIfNeeded();
+  void ResetFingerprintNoiseFlag() { fingerprint_noise_applied_ = false; }
+
  private:
   static DOMFloat32Array* CreateFloat32ArrayOrNull(
       uint32_t length,
@@ -127,6 +130,7 @@ class MODULES_EXPORT AudioBuffer final : public ScriptWrappable {
   uint32_t length_;
 
   HeapVector<Member<DOMFloat32Array>> channels_;
+  bool fingerprint_noise_applied_ = false;
 };
 
 // Shared data that audio threads can hold onto.
