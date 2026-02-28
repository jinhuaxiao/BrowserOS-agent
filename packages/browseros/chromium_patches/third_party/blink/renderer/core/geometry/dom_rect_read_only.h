diff --git a/third_party/blink/renderer/core/geometry/dom_rect_read_only.h b/third_party/blink/renderer/core/geometry/dom_rect_read_only.h
index 0000000000000..1234567890abc 100644
--- a/third_party/blink/renderer/core/geometry/dom_rect_read_only.h
+++ b/third_party/blink/renderer/core/geometry/dom_rect_read_only.h
@@ -32,10 +32,10 @@

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
