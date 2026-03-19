diff --git a/third_party/blink/renderer/core/css/media_values.cc b/third_party/blink/renderer/core/css/media_values.cc
index 0d60244742..2bc9fab1e8 100644
--- a/third_party/blink/renderer/core/css/media_values.cc
+++ b/third_party/blink/renderer/core/css/media_values.cc
@@ -29,6 +29,7 @@
 #include "third_party/blink/renderer/platform/network/network_state_notifier.h"
 #include "third_party/blink/renderer/platform/widget/frame_widget.h"
 #include "ui/base/mojom/window_show_state.mojom-blink.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "ui/display/screen_info.h"
 
 namespace blink {
@@ -164,6 +165,13 @@ double MediaValues::CalculateDynamicViewportHeight(LocalFrame* frame) {
 
 int MediaValues::CalculateDeviceWidth(LocalFrame* frame) {
   DCHECK(frame && frame->View() && frame->GetSettings() && frame->GetPage());
+
+  // BrowserOS: Return custom device width for CSS media queries
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return config.GetScreenWidth();
+  }
+
   const display::ScreenInfo& screen_info =
       frame->GetPage()->GetChromeClient().GetScreenInfo(*frame);
   int device_width = screen_info.rect.width();
@@ -176,6 +184,13 @@ int MediaValues::CalculateDeviceWidth(LocalFrame* frame) {
 
 int MediaValues::CalculateDeviceHeight(LocalFrame* frame) {
   DCHECK(frame && frame->View() && frame->GetSettings() && frame->GetPage());
+
+  // BrowserOS: Return custom device height for CSS media queries
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return config.GetScreenHeight();
+  }
+
   const display::ScreenInfo& screen_info =
       frame->GetPage()->GetChromeClient().GetScreenInfo(*frame);
   int device_height = screen_info.rect.height();
