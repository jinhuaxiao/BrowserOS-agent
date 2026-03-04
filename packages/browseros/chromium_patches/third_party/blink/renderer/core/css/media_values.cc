diff --git a/third_party/blink/renderer/core/css/media_values.cc b/third_party/blink/renderer/core/css/media_values.cc
index abc123456..fingerprint123 100644
--- a/third_party/blink/renderer/core/css/media_values.cc
+++ b/third_party/blink/renderer/core/css/media_values.cc
@@ -32,6 +32,7 @@
 #include "third_party/blink/renderer/platform/network/network_state_notifier.h"
 #include "third_party/blink/renderer/platform/widget/frame_widget.h"
 #include "ui/base/mojom/window_show_state.mojom-blink.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "ui/display/screen_info.h"

 namespace blink {
@@ -167,6 +168,12 @@ int MediaValues::CalculateDeviceWidth(LocalFrame* frame) {
   DCHECK(frame && frame->View() && frame->GetSettings() && frame->GetPage());

+  // BrowserOS: Return custom device width for CSS media queries
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetScreenWidth() > 0) {
+    return config.GetScreenWidth();
+  }
+
   if (frame->DomWindow() &&
       frame->DomWindow()->screen()->ShouldReduceScreenSize()) {
     return CalculateViewportWidth(frame);
@@ -185,6 +192,12 @@ int MediaValues::CalculateDeviceHeight(LocalFrame* frame) {
   DCHECK(frame && frame->View() && frame->GetSettings() && frame->GetPage());

+  // BrowserOS: Return custom device height for CSS media queries
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetScreenHeight() > 0) {
+    return config.GetScreenHeight();
+  }
+
   if (frame->DomWindow() &&
       frame->DomWindow()->screen()->ShouldReduceScreenSize()) {
     return CalculateViewportHeight(frame);
