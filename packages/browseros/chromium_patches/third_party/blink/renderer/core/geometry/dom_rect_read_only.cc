diff --git a/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc b/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc
index 1234567890abc..fedcba0987654 100644
--- a/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc
+++ b/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc
@@ -4,6 +4,8 @@

 #include "third_party/blink/renderer/core/geometry/dom_rect_read_only.h"

+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
+
 #include "third_party/blink/renderer/bindings/core/v8/v8_dom_rect_init.h"
 #include "third_party/blink/renderer/bindings/core/v8/v8_object_builder.h"

@@ -11,6 +13,40 @@

 namespace blink {

+namespace {
+
+// XorShift32 PRNG for deterministic noise per-profile
+class ClientRectsNoise {
+ public:
+  static double Apply(double value, uint32_t seed, float factor) {
+    if (factor <= 0.0f || seed == 0)
+      return value;
+    // Mix value bits into seed for position-dependent noise
+    uint32_t mixed = seed ^ static_cast<uint32_t>(value * 1000.0);
+    mixed ^= mixed << 13;
+    mixed ^= mixed >> 17;
+    mixed ^= mixed << 5;
+    // Normalize to [-1, 1] range
+    double normalized = (static_cast<double>(mixed) / 4294967296.0) * 2.0 - 1.0;
+    return value + normalized * factor;
+  }
+};
+
+double MaybeApplyClientRectsNoise(double value) {
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (!config.IsEnabled() || !config.GetClientRectsNoiseEnabled())
+    return value;
+  return ClientRectsNoise::Apply(
+      value,
+      config.GetClientRectsSessionSeed(),
+      config.GetClientRectsNoiseFactor());
+}
+
+}  // namespace
+
 DOMRectReadOnly* DOMRectReadOnly::Create(double x,
                                          double y,
                                          double width,
@@ -30,6 +66,22 @@ DOMRectReadOnly* DOMRectReadOnly::fromRect(const DOMRectInit* other) {
       other->width(), other->height());
 }

+double DOMRectReadOnly::x() const {
+  return MaybeApplyClientRectsNoise(x_);
+}
+
+double DOMRectReadOnly::y() const {
+  return MaybeApplyClientRectsNoise(y_);
+}
+
+double DOMRectReadOnly::width() const {
+  return MaybeApplyClientRectsNoise(width_);
+}
+
+double DOMRectReadOnly::height() const {
+  return MaybeApplyClientRectsNoise(height_);
+}
+
 ScriptValue DOMRectReadOnly::toJSONForBinding(
     ScriptState* script_state) const {
   V8ObjectBuilder result(script_state);
