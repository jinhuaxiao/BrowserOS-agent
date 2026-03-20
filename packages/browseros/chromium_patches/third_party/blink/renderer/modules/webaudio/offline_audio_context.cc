diff --git a/third_party/blink/renderer/modules/webaudio/offline_audio_context.cc b/third_party/blink/renderer/modules/webaudio/offline_audio_context.cc
index 6b51eee83a..2839c367b2 100644
--- a/third_party/blink/renderer/modules/webaudio/offline_audio_context.cc
+++ b/third_party/blink/renderer/modules/webaudio/offline_audio_context.cc
@@ -411,6 +411,12 @@ void OfflineAudioContext::FireCompletionEvent() {
       return;
     }
 
+    // BrowserOS: Apply fingerprint noise to rendered audio data.
+    // Reset the flag since the audio thread may have triggered getChannelData
+    // during rendering, which would have set it prematurely on empty data.
+    rendered_buffer->ResetFingerprintNoiseFlag();
+    rendered_buffer->ApplyFingerprintNoiseIfNeeded();
+
     // Call the offline rendering completion event listener and resolve the
     // promise too.
     DispatchEvent(*OfflineAudioCompletionEvent::Create(rendered_buffer));
