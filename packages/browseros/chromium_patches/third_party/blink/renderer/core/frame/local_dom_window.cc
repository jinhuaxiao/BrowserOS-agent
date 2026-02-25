diff --git a/third_party/blink/renderer/core/frame/local_dom_window.cc b/third_party/blink/renderer/core/frame/local_dom_window.cc
index 8f7b4b8c9a22d..fingerprint123 100644
--- a/third_party/blink/renderer/core/frame/local_dom_window.cc
+++ b/third_party/blink/renderer/core/frame/local_dom_window.cc
@@ -24,6 +24,7 @@
 #include <memory>
 #include <utility>
 
 #include "base/metrics/histogram_macros.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "cc/input/snap_selection_strategy.h"
 #include "net/base/registry_controlled_domains/registry_controlled_domain.h"
@@ -1464,6 +1465,12 @@ double LocalDOMWindow::devicePixelRatio() const {
   if (!GetFrame())
     return 0.0;
+
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetDevicePixelRatio() > 0.0f) {
+    return static_cast<double>(config.GetDevicePixelRatio());
+  }
 
   return GetFrame()->DevicePixelRatio();
 }
