diff --git a/third_party/blink/renderer/core/geometry/dom_rect_read_only.h b/third_party/blink/renderer/core/geometry/dom_rect_read_only.h
index 450b7865e7..ba8e45d1bd 100644
--- a/third_party/blink/renderer/core/geometry/dom_rect_read_only.h
+++ b/third_party/blink/renderer/core/geometry/dom_rect_read_only.h
@@ -32,10 +32,10 @@ class CORE_EXPORT DOMRectReadOnly : public ScriptWrappable {
 
   DOMRectReadOnly(double x, double y, double width, double height);
 
-  double x() const { return x_; }
-  double y() const { return y_; }
-  double width() const { return width_; }
-  double height() const { return height_; }
+  double x() const;
+  double y() const;
+  double width() const;
+  double height() const;
 
   double top() const { return geometry_util::NanSafeMin(y_, y_ + height_); }
   double right() const { return geometry_util::NanSafeMax(x_, x_ + width_); }
@@ -56,6 +56,14 @@ class CORE_EXPORT DOMRectReadOnly : public ScriptWrappable {
   double y_;
   double width_;
   double height_;
+
+  // BrowserOS: cached noise offsets for fingerprint protection
+  void ComputeNoiseOffsetsIfNeeded() const;
+  mutable bool noise_computed_ = false;
+  mutable double noise_x_ = 0.0;
+  mutable double noise_y_ = 0.0;
+  mutable double noise_w_ = 0.0;
+  mutable double noise_h_ = 0.0;
 };
 
 }  // namespace blink
