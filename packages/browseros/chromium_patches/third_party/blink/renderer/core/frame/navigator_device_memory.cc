diff --git a/third_party/blink/renderer/core/frame/navigator_device_memory.cc b/third_party/blink/renderer/core/frame/navigator_device_memory.cc
index abc123456..fingerprint123 100644
--- a/third_party/blink/renderer/core/frame/navigator_device_memory.cc
+++ b/third_party/blink/renderer/core/frame/navigator_device_memory.cc
@@ -10,6 +10,7 @@
 #include "third_party/blink/renderer/core/dom/document.h"
 #include "third_party/blink/renderer/core/frame/local_dom_window.h"
 #include "third_party/blink/renderer/platform/runtime_enabled_features.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 
 namespace blink {

@@ -23,6 +24,12 @@ constexpr float kReducedDeviceMemoryValue = 8.0;
 }  // namespace
 
 float NavigatorDeviceMemory::deviceMemory() const {
+  // BrowserOS: Return custom deviceMemory if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    return config.GetDeviceMemory();
+  }
+
   if (RuntimeEnabledFeatures::ReduceDeviceMemoryEnabled()) {
     return kReducedDeviceMemoryValue;
   }
