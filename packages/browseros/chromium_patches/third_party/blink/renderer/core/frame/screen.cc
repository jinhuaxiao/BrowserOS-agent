diff --git a/third_party/blink/renderer/core/frame/screen.cc b/third_party/blink/renderer/core/frame/screen.cc
index abc123456..fingerprint123 100644
--- a/third_party/blink/renderer/core/frame/screen.cc
+++ b/third_party/blink/renderer/core/frame/screen.cc
@@ -37,6 +37,7 @@
 #include "third_party/blink/renderer/core/page/chrome_client.h"
 #include "ui/display/screen_info.h"
 #include "ui/display/screen_infos.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 
 namespace blink {

@@ -98,6 +99,12 @@ int Screen::height() const {
   if (!DomWindow())
     return 0;
 
+  // BrowserOS: Return custom screen height if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    return config.GetScreenHeight();
+  }
+
   if (ShouldReduceScreenSize()) {
     return DomWindow()->innerHeight();
   }
@@ -109,6 +116,12 @@ int Screen::width() const {
   if (!DomWindow())
     return 0;
 
+  // BrowserOS: Return custom screen width if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    return config.GetScreenWidth();
+  }
+
   if (ShouldReduceScreenSize()) {
     return DomWindow()->innerWidth();
   }
@@ -122,6 +135,12 @@ unsigned Screen::colorDepth() const {
   // https://drafts.csswg.org/cssom-view/#dom-screen-colordepth
   unsigned unknown_color_depth = 24u;
 
+  // BrowserOS: Return custom color depth if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    return static_cast<unsigned>(config.GetColorDepth());
+  }
+
   if (!DomWindow() || ShouldReduceScreenSize()) {
     return unknown_color_depth;
   }
@@ -161,6 +180,12 @@ int Screen::availHeight() const {
   if (!DomWindow())
     return 0;
 
+  // BrowserOS: Return custom availHeight if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    return config.GetScreenAvailHeight();
+  }
+
   if (ShouldReduceScreenSize()) {
     return DomWindow()->innerHeight();
   }
@@ -172,6 +197,12 @@ int Screen::availWidth() const {
   if (!DomWindow())
     return 0;
 
+  // BrowserOS: Return custom availWidth if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    return config.GetScreenAvailWidth();
+  }
+
   if (ShouldReduceScreenSize()) {
     return DomWindow()->innerWidth();
   }
