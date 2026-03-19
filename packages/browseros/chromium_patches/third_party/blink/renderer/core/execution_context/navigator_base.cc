diff --git a/third_party/blink/renderer/core/execution_context/navigator_base.cc b/third_party/blink/renderer/core/execution_context/navigator_base.cc
index cccfafe8f9..b4b9eae329 100644
--- a/third_party/blink/renderer/core/execution_context/navigator_base.cc
+++ b/third_party/blink/renderer/core/execution_context/navigator_base.cc
@@ -12,6 +12,7 @@
 #include "third_party/blink/renderer/core/probe/core_probes.h"
 #include "third_party/blink/renderer/platform/runtime_enabled_features.h"
 #include "third_party/blink/renderer/platform/wtf/text/string_builder.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 
 #if !BUILDFLAG(IS_MAC) && !BUILDFLAG(IS_WIN)
 #include <sys/utsname.h>
@@ -52,6 +53,13 @@ String NavigatorBase::userAgent() const {
 }
 
 String NavigatorBase::platform() const {
+  // BrowserOS: Return custom platform if fingerprint config is enabled.
+  // This covers both Navigator (main frame) and WorkerNavigator (Service Workers).
+  auto& fp_config = FingerprintConfig::GetInstance();
+  if (fp_config.IsEnabled() && !fp_config.GetPlatform().empty()) {
+    return String::FromUTF8(fp_config.GetPlatform());
+  }
+
 #if BUILDFLAG(IS_ANDROID)
   // We need to check the ReduceUserAgentMinorVersion feature flag for
   // Android WebView, which does not currently ship a reduced User-Agent.
@@ -70,6 +78,12 @@ void NavigatorBase::Trace(Visitor* visitor) const {
 }
 
 unsigned int NavigatorBase::hardwareConcurrency() const {
+  // BrowserOS: Return custom hardwareConcurrency if fingerprint config is enabled
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasNavigatorOverride()) {
+    return config.GetHardwareConcurrency();
+  }
+
   unsigned int hardware_concurrency =
       NavigatorConcurrentHardware::hardwareConcurrency();
 
