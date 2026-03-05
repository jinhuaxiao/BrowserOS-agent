diff --git a/third_party/blink/renderer/core/geometry/dom_rect.h b/third_party/blink/renderer/core/geometry/dom_rect.h
index 27b07a3092..26516bffe9 100644
--- a/third_party/blink/renderer/core/geometry/dom_rect.h
+++ b/third_party/blink/renderer/core/geometry/dom_rect.h
@@ -33,10 +33,10 @@ class CORE_EXPORT DOMRect final : public DOMRectReadOnly {
 
   gfx::Rect ToEnclosingRect() const;
 
-  void setX(double x) { x_ = x; }
-  void setY(double y) { y_ = y; }
-  void setWidth(double width) { width_ = width; }
-  void setHeight(double height) { height_ = height; }
+  void setX(double x) { x_ = x; noise_computed_ = false; }
+  void setY(double y) { y_ = y; noise_computed_ = false; }
+  void setWidth(double width) { width_ = width; noise_computed_ = false; }
+  void setHeight(double height) { height_ = height; noise_computed_ = false; }
 };
 
 inline bool operator==(const DOMRect& lhs, const DOMRect& rhs) {
