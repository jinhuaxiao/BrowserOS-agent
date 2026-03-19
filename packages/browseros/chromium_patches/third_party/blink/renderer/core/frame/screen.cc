diff --git a/third_party/blink/renderer/core/frame/screen.cc b/third_party/blink/renderer/core/frame/screen.cc
index 69ffc2b05f..902e2af68f 100644
--- a/third_party/blink/renderer/core/frame/screen.cc
+++ b/third_party/blink/renderer/core/frame/screen.cc
@@ -37,6 +37,7 @@
 #include "third_party/blink/renderer/core/page/chrome_client.h"
 #include "ui/display/screen_info.h"
 #include "ui/display/screen_infos.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 
 namespace blink {
 
@@ -81,12 +82,26 @@ bool Screen::AreWebExposedScreenPropertiesEqual(
 int Screen::height() const {
   if (!DomWindow())
     return 0;
+
+  // BrowserOS: Return custom screen height if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return config.GetScreenHeight();
+  }
+
   return GetRect(/*available=*/false).height();
 }
 
 int Screen::width() const {
   if (!DomWindow())
     return 0;
+
+  // BrowserOS: Return custom screen width if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return config.GetScreenWidth();
+  }
+
   return GetRect(/*available=*/false).width();
 }
 
@@ -97,6 +112,12 @@ unsigned Screen::colorDepth() const {
   // https://drafts.csswg.org/cssom-view/#dom-screen-colordepth
   unsigned unknown_color_depth = 24u;
 
+  // BrowserOS: Return custom color depth if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return static_cast<unsigned>(config.GetColorDepth());
+  }
+
   if (!DomWindow()) {
     return unknown_color_depth;
   }
@@ -124,12 +145,26 @@ int Screen::availTop() const {
 int Screen::availHeight() const {
   if (!DomWindow())
     return 0;
+
+  // BrowserOS: Return custom availHeight if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return config.GetScreenAvailHeight();
+  }
+
   return GetRect(/*available=*/true).height();
 }
 
 int Screen::availWidth() const {
   if (!DomWindow())
     return 0;
+
+  // BrowserOS: Return custom availWidth if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return config.GetScreenAvailWidth();
+  }
+
   return GetRect(/*available=*/true).width();
 }
 
