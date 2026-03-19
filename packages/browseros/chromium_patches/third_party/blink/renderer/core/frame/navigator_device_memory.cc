diff --git a/third_party/blink/renderer/core/frame/navigator_device_memory.cc b/third_party/blink/renderer/core/frame/navigator_device_memory.cc
index 05fa33e456..c8702fba85 100644
--- a/third_party/blink/renderer/core/frame/navigator_device_memory.cc
+++ b/third_party/blink/renderer/core/frame/navigator_device_memory.cc
@@ -8,10 +8,17 @@
 #include "third_party/blink/public/mojom/use_counter/metrics/web_feature.mojom-shared.h"
 #include "third_party/blink/renderer/core/dom/document.h"
 #include "third_party/blink/renderer/core/frame/local_dom_window.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 
 namespace blink {
 
 float NavigatorDeviceMemory::deviceMemory() const {
+  // BrowserOS: Return custom deviceMemory if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasNavigatorOverride()) {
+    return config.GetDeviceMemory();
+  }
+
   return ApproximatedDeviceMemory::GetApproximatedDeviceMemory();
 }
 
