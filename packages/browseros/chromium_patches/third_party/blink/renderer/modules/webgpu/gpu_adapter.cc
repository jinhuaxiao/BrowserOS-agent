diff --git a/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc b/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc
index c189005655..6e085bdbf4 100644
--- a/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc
+++ b/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc
@@ -5,6 +5,7 @@
 #include "third_party/blink/renderer/modules/webgpu/gpu_adapter.h"
 
 #include "services/metrics/public/cpp/ukm_builders.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "third_party/blink/renderer/bindings/core/v8/script_promise_resolver.h"
 #include "third_party/blink/renderer/bindings/core/v8/v8_object_builder.h"
 #include "third_party/blink/renderer/bindings/modules/v8/v8_gpu_device_descriptor.h"
@@ -103,6 +104,20 @@ GPUAdapter::GPUAdapter(
   }
   description_ = String::FromUTF8(info.device);
   driver_ = String::FromUTF8(info.description);
+
+  // BrowserOS: Apply WebGPU fingerprint spoofing
+  {
+    auto& fp_config = blink::FingerprintConfig::GetInstance();
+    if (fp_config.IsEnabled() && fp_config.HasWebGPUOverride()) {
+      vendor_ = String::FromUTF8(fp_config.GetWebGPUVendor());
+      if (!fp_config.GetWebGPUArchitecture().empty())
+        architecture_ = String::FromUTF8(fp_config.GetWebGPUArchitecture());
+      if (!fp_config.GetWebGPUDevice().empty())
+        device_ = String::FromUTF8(fp_config.GetWebGPUDevice());
+      if (!fp_config.GetWebGPUDescription().empty())
+        description_ = String::FromUTF8(fp_config.GetWebGPUDescription());
+    }
+  }
   if (supportsPropertiesD3D) {
     d3d_shader_model_ = d3dProperties.shaderModel;
   }
