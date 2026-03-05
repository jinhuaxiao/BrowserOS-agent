diff --git a/third_party/blink/renderer/modules/donottrack/navigator_do_not_track.cc b/third_party/blink/renderer/modules/donottrack/navigator_do_not_track.cc
index 1234567890abc..fedcba0987654 100644
--- a/third_party/blink/renderer/modules/donottrack/navigator_do_not_track.cc
+++ b/third_party/blink/renderer/modules/donottrack/navigator_do_not_track.cc
@@ -31,6 +31,7 @@
 
 #include "third_party/blink/renderer/modules/donottrack/navigator_do_not_track.h"
 
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "third_party/blink/renderer/core/frame/local_dom_window.h"
 #include "third_party/blink/renderer/core/frame/local_frame.h"
 #include "third_party/blink/renderer/core/frame/local_frame_client.h"
@@ -40,6 +41,11 @@ namespace blink {
 namespace NavigatorDoNotTrack {
 
 String doNotTrack(Navigator& navigator) {
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    // Return null (unset) - the most common default, avoids detection
+    return String();
+  }
   LocalDOMWindow* window = navigator.DomWindow();
   return window ? window->GetFrame()->Client()->DoNotTrackValue() : String();
 }
