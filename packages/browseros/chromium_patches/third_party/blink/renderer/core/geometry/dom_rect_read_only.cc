diff --git a/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc b/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc
index 54e4be2694..26d5ac2cc2 100644
--- a/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc
+++ b/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc
@@ -4,6 +4,8 @@
 
 #include "third_party/blink/renderer/core/geometry/dom_rect_read_only.h"
 
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
+
 #include "third_party/blink/renderer/bindings/core/v8/script_value.h"
 #include "third_party/blink/renderer/bindings/core/v8/v8_dom_rect_init.h"
 #include "third_party/blink/renderer/bindings/core/v8/v8_object_builder.h"
@@ -11,6 +13,39 @@
 
 namespace blink {
 
+namespace {
+
+// XorShift32 PRNG for deterministic noise per-profile
+double ComputeClientRectsNoise(double value, uint32_t seed, float factor) {
+  if (factor <= 0.0f || seed == 0)
+    return 0.0;
+  // Mix value bits into seed for position-dependent noise
+  uint32_t mixed = seed ^ static_cast<uint32_t>(value * 1000.0);
+  mixed ^= mixed << 13;
+  mixed ^= mixed >> 17;
+  mixed ^= mixed << 5;
+  // Normalize to [-1, 1] range
+  double normalized = (static_cast<double>(mixed) / 4294967296.0) * 2.0 - 1.0;
+  return normalized * factor;
+}
+
+}  // namespace
+
+void DOMRectReadOnly::ComputeNoiseOffsetsIfNeeded() const {
+  if (noise_computed_)
+    return;
+  noise_computed_ = true;
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (!config.IsEnabled() || !config.GetClientRectsNoiseEnabled())
+    return;
+  uint32_t seed = config.GetClientRectsSessionSeed();
+  float factor = config.GetClientRectsNoiseFactor();
+  noise_x_ = ComputeClientRectsNoise(x_, seed, factor);
+  noise_y_ = ComputeClientRectsNoise(y_, seed, factor);
+  noise_w_ = ComputeClientRectsNoise(width_, seed, factor);
+  noise_h_ = ComputeClientRectsNoise(height_, seed, factor);
+}
+
 DOMRectReadOnly* DOMRectReadOnly::Create(double x,
                                          double y,
                                          double width,
@@ -47,6 +82,26 @@ DOMRectReadOnly* DOMRectReadOnly::fromRect(const DOMRectInit* other) {
                                                other->width(), other->height());
 }
 
+double DOMRectReadOnly::x() const {
+  ComputeNoiseOffsetsIfNeeded();
+  return x_ + noise_x_;
+}
+
+double DOMRectReadOnly::y() const {
+  ComputeNoiseOffsetsIfNeeded();
+  return y_ + noise_y_;
+}
+
+double DOMRectReadOnly::width() const {
+  ComputeNoiseOffsetsIfNeeded();
+  return width_ + noise_w_;
+}
+
+double DOMRectReadOnly::height() const {
+  ComputeNoiseOffsetsIfNeeded();
+  return height_ + noise_h_;
+}
+
 DOMRectReadOnly::DOMRectReadOnly(double x,
                                  double y,
                                  double width,
