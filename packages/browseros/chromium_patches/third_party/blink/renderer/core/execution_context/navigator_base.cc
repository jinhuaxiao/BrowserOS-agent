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
@@ -54,6 +55,13 @@ NavigatorBase::NavigatorBase(ExecutionContext* context)
 String NavigatorBase::platform() const {
   ExecutionContext* execution_context = GetExecutionContext();

+  // BrowserOS: Return custom platform if fingerprint config is enabled.
+  // This covers both Navigator (main frame) and WorkerNavigator (Service Workers).
+  auto& fp_config = FingerprintConfig::GetInstance();
+  if (fp_config.IsEnabled() && !fp_config.GetPlatform().empty()) {
+    return String::FromUTF8(fp_config.GetPlatform());
+  }
+
 #if BUILDFLAG(IS_ANDROID)
   // For user-agent reduction phase 6, Android platform should be frozen
   // string, see https://www.chromium.org/updates/ua-reduction/.
@@ -79,6 +87,12 @@ void NavigatorBase::Trace(Visitor* visitor) const {
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

