diff --git a/third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc b/third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc
index 7831167a98..6d4fa6e317 100644
--- a/third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc
+++ b/third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc
@@ -12,6 +12,8 @@
 #include <utility>
 
 #include "base/check.h"
+#include "base/compiler_specific.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "base/check_op.h"
 #include "base/location.h"
 #include "base/memory/scoped_refptr.h"
@@ -114,6 +116,55 @@ class MemoryManagedPaintCanvas;
 
 namespace {
 
+uint32_t CanvasXorShift32(uint32_t value) {
+  value ^= value << 13;
+  value ^= value >> 17;
+  value ^= value << 5;
+  return value;
+}
+
+void ApplyCanvasNoise(uint8_t* data,
+                      size_t length,
+                      float factor,
+                      uint32_t seed) {
+  if (!data || length < 4 || factor <= 0.0f)
+    return;
+
+  // Scale down noise factor for large canvases to avoid blocking the renderer
+  // main thread and triggering hang detection, while preserving detectable
+  // noise at all sizes.
+  size_t pixel_count = length / 4;
+  float effective_factor = factor;
+  if (pixel_count > 1000000) {
+    effective_factor *= 0.1f;
+  } else if (pixel_count > 100000) {
+    effective_factor *= 0.25f;
+  }
+
+  float scaled = effective_factor * 255.0f;
+  if (scaled <= 0.0f)
+    return;
+
+  int max_delta = static_cast<int>(scaled);
+  if (max_delta < 1)
+    max_delta = 1;
+
+  for (size_t i = 0; i + 3 < length; i += 4) {
+    uint32_t x = CanvasXorShift32(seed ^ static_cast<uint32_t>(i));
+    int delta = static_cast<int>(x % static_cast<uint32_t>(2 * max_delta + 1)) -
+                max_delta;
+
+    for (int channel = 0; channel < 3; ++channel) {
+      int value = static_cast<int>(UNSAFE_TODO(data[i + channel])) + delta;
+      if (value < 0)
+        value = 0;
+      else if (value > 255)
+        value = 255;
+      UNSAFE_TODO(data[i + channel] = static_cast<uint8_t>(value));
+    }
+  }
+}
+
 wgpu::TextureFormat AsDawnType(const viz::SharedImageFormat& format) {
   // NOTE: Canvas2D can be only RGBA_8888, BGRA_8888, or F16.
   if (format == viz::SinglePlaneFormat::kRGBA_8888) {
@@ -557,6 +608,18 @@ ImageData* BaseRenderingContext2D::getImageDataInternal(
     }
   }
 
+  // BrowserOS: Apply canvas noise if fingerprint config is enabled
+  {
+    auto& config = FingerprintConfig::GetInstance();
+    if (config.IsEnabled() && config.GetCanvasNoiseEnabled()) {
+      SkPixmap pm = image_data->GetSkPixmap();
+      ApplyCanvasNoise(reinterpret_cast<uint8_t*>(pm.writable_addr()),
+                       pm.computeByteSize(),
+                       config.GetCanvasNoiseFactor(),
+                       config.GetCanvasSessionSeed());
+    }
+  }
+
   return image_data;
 }
 
