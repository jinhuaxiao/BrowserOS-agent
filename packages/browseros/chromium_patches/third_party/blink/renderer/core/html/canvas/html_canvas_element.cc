diff --git a/third_party/blink/renderer/core/html/canvas/html_canvas_element.cc b/third_party/blink/renderer/core/html/canvas/html_canvas_element.cc
index f95a360b8d..58b2ac8f22 100644
--- a/third_party/blink/renderer/core/html/canvas/html_canvas_element.cc
+++ b/third_party/blink/renderer/core/html/canvas/html_canvas_element.cc
@@ -131,10 +131,126 @@
 #include "ui/gfx/geometry/skia_conversions.h"
 #include "v8/include/v8.h"
 
+// BrowserOS: Fingerprint config and Skia includes for canvas noise
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
+#include "third_party/blink/renderer/platform/graphics/unaccelerated_static_bitmap_image.h"
+#include "third_party/skia/include/core/SkBitmap.h"
+#include "ui/gfx/skia_span_util.h"
+
 namespace blink {
 
 namespace {
 
+// BrowserOS: Canvas noise helpers for fingerprint protection
+uint32_t FingerprintXorShift32(uint32_t value) {
+  value ^= value << 13;
+  value ^= value >> 17;
+  value ^= value << 5;
+  return value;
+}
+
+void ApplyFingerprintCanvasNoise(uint8_t* data,
+                                 size_t length,
+                                 float factor,
+                                 uint32_t seed) {
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
+    // Mix pixel index with seed and add spatial correlation via row/column
+    uint32_t pixel_idx = static_cast<uint32_t>(i >> 2);
+    uint32_t spatial_key = seed ^ (pixel_idx * 2654435761u);
+    uint32_t x1 = FingerprintXorShift32(spatial_key);
+    uint32_t x2 = FingerprintXorShift32(x1);
+
+    // Triangular distribution: sum of two uniform values minus mean
+    // This approximates Gaussian noise better than flat uniform
+    int u1 = static_cast<int>(x1 % static_cast<uint32_t>(2 * max_delta + 1));
+    int u2 = static_cast<int>(x2 % static_cast<uint32_t>(2 * max_delta + 1));
+    int delta = ((u1 + u2) / 2) - max_delta;
+
+    // Apply noise to RGB channels
+    for (int channel = 0; channel < 3; ++channel) {
+      int value = static_cast<int>(UNSAFE_TODO(data[i + channel])) + delta;
+      if (value < 0)
+        value = 0;
+      else if (value > 255)
+        value = 255;
+      UNSAFE_TODO(data[i + channel] = static_cast<uint8_t>(value));
+    }
+
+    // Apply very small noise to alpha for non-boundary values
+    uint8_t alpha = UNSAFE_TODO(data[i + 3]);
+    if (alpha > 1 && alpha < 254) {
+      uint32_t x3 = FingerprintXorShift32(x2);
+      int alpha_delta = (static_cast<int>(x3 & 3u) - 1);  // -1, 0, 0, or 1
+      int new_alpha = static_cast<int>(alpha) + alpha_delta;
+      if (new_alpha < 1) new_alpha = 1;
+      if (new_alpha > 254) new_alpha = 254;
+      UNSAFE_TODO(data[i + 3] = static_cast<uint8_t>(new_alpha));
+    }
+  }
+}
+
+// BrowserOS: Apply noise to StaticBitmapImage using FingerprintConfig
+bool MaybeApplyFingerprintNoise(scoped_refptr<StaticBitmapImage>& snapshot) {
+  auto& config = FingerprintConfig::GetInstance();
+  if (!config.IsEnabled() || !config.GetCanvasNoiseEnabled()) {
+    return false;
+  }
+
+  // Create a writable copy of the pixels
+  auto info = SkImageInfo::Make(
+      snapshot->GetSize().width(), snapshot->GetSize().height(),
+      kRGBA_8888_SkColorType, kUnpremul_SkAlphaType,
+      snapshot->GetColorSpace().ToSkColorSpace());
+
+  SkBitmap bm;
+  if (!bm.tryAllocPixels(info)) {
+    return false;
+  }
+
+  // Copy pixels from snapshot to bitmap
+  auto pixmap = bm.pixmap();
+  PaintImage paint_image = snapshot->PaintImageForCurrentFrame();
+  if (!paint_image.readPixels(bm.info(), pixmap.writable_addr(),
+                              bm.rowBytes(), 0, 0)) {
+    return false;
+  }
+
+  // Apply noise using FingerprintConfig settings
+  base::span<uint8_t> pixel_span = gfx::SkPixmapToWritableSpan(pixmap);
+  ApplyFingerprintCanvasNoise(pixel_span.data(), pixel_span.size(),
+                              config.GetCanvasNoiseFactor(),
+                              config.GetCanvasSessionSeed());
+
+  // Create new image from noised pixels
+  auto noised_image = bm.asImage();
+  snapshot = UnacceleratedStaticBitmapImage::Create(
+      std::move(noised_image), snapshot->Orientation());
+
+  return true;
+}
+
 constexpr unsigned kMaxCanvasAnimationBacklog = 2;
 
 // These two constants determine if a newly created canvas starts with
@@ -1313,6 +1429,9 @@ String HTMLCanvasElement::ToDataURLInternal(
 
   scoped_refptr<StaticBitmapImage> image_bitmap = Snapshot(source_buffer);
   if (image_bitmap) {
+    // BrowserOS: Apply fingerprint noise to canvas snapshot
+    MaybeApplyFingerprintNoise(image_bitmap);
+
     std::unique_ptr<ImageDataBuffer> data_buffer =
         ImageDataBuffer::Create(image_bitmap);
     if (!data_buffer)
@@ -1424,6 +1543,9 @@ void HTMLCanvasElement::toBlob(V8BlobCallback* callback,
   CanvasAsyncBlobCreator* async_creator = nullptr;
   scoped_refptr<StaticBitmapImage> image_bitmap = Snapshot(kBackBuffer);
   if (image_bitmap) {
+    // BrowserOS: Apply fingerprint noise to canvas snapshot
+    MaybeApplyFingerprintNoise(image_bitmap);
+
     auto* options = ImageEncodeOptions::Create();
     options->setType(ImageEncoderUtils::MimeTypeName(encoding_mime_type));
     async_creator = MakeGarbageCollected<CanvasAsyncBlobCreator>(
