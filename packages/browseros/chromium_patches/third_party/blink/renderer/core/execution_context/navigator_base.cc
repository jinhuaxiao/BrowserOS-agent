diff --git a/third_party/blink/renderer/core/execution_context/navigator_base.cc b/third_party/blink/renderer/core/execution_context/navigator_base.cc
index abc123456..fingerprint123 100644
--- a/third_party/blink/renderer/core/execution_context/navigator_base.cc
+++ b/third_party/blink/renderer/core/execution_context/navigator_base.cc
@@ -11,6 +11,7 @@
 #include "third_party/blink/renderer/core/frame/navigator_concurrent_hardware.h"
 #include "third_party/blink/renderer/core/probe/core_probes.h"
 #include "third_party/blink/renderer/platform/wtf/text/string_builder.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"

 #if !BUILDFLAG(IS_MAC) && !BUILDFLAG(IS_WIN)
 #include <sys/utsname.h>
@@ -79,6 +80,12 @@ void NavigatorBase::Trace(Visitor* visitor) const {
 }

 unsigned int NavigatorBase::hardwareConcurrency() const {
+  // BrowserOS: Return custom hardwareConcurrency if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled()) {
+    return config.GetHardwareConcurrency();
+  }
+
   unsigned int hardware_concurrency =
       NavigatorConcurrentHardware::hardwareConcurrency();

