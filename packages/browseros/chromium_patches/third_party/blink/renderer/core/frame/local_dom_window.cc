diff --git a/third_party/blink/renderer/core/frame/local_dom_window.cc b/third_party/blink/renderer/core/frame/local_dom_window.cc
index c425735d53..3e19b1e181 100644
--- a/third_party/blink/renderer/core/frame/local_dom_window.cc
+++ b/third_party/blink/renderer/core/frame/local_dom_window.cc
@@ -32,6 +32,7 @@
 
 #include "base/command_line.h"
 #include "base/metrics/histogram_macros.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "base/task/single_thread_task_runner.h"
 #include "base/trace_event/trace_id_helper.h"
 #include "base/trace_event/typed_macros.h"
@@ -1822,6 +1823,11 @@ double LocalDOMWindow::devicePixelRatio() const {
   if (!GetFrame())
     return 0.0;
 
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasScreenOverride()) {
+    return static_cast<double>(config.GetDevicePixelRatio());
+  }
+
   return GetFrame()->DevicePixelRatio();
 }
 
