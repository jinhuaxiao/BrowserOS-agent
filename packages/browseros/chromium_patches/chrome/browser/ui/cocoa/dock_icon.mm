diff --git a/chrome/browser/ui/cocoa/dock_icon.mm b/chrome/browser/ui/cocoa/dock_icon.mm
index f08c2b156c..9744e88cb4 100644
--- a/chrome/browser/ui/cocoa/dock_icon.mm
+++ b/chrome/browser/ui/cocoa/dock_icon.mm
@@ -9,7 +9,9 @@
 #include "base/apple/bundle_locations.h"
 #include "base/apple/foundation_util.h"
 #include "base/check_op.h"
+#include "base/strings/sys_string_conversions.h"
 #include "content/public/browser/browser_thread.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "ui/gfx/scoped_ns_graphics_context_save_gstate_mac.h"
 
 using content::BrowserThread;
@@ -77,6 +79,72 @@ - (void)drawRect:(NSRect)dirtyRect {
             operation:NSCompositingOperationSourceOver
              fraction:1.0];
 
+  // BrowserOS: Draw profile name bar at bottom of dock icon.
+  {
+    const auto& fp_config = blink::FingerprintConfig::GetInstance();
+    if (fp_config.HasProfileBadge()) {
+      NSString* name = base::SysUTF8ToNSString(fp_config.GetProfileName());
+      CGFloat iconWidth = NSWidth(self.bounds);
+      CGFloat fontSize = iconWidth * 0.18;
+      NSFont* font = [NSFont systemFontOfSize:fontSize weight:NSFontWeightBold];
+      NSDictionary* measureAttrs = @{ NSFontAttributeName : font };
+      NSSize textSize = [name sizeWithAttributes:measureAttrs];
+      CGFloat badgeHeight = textSize.height + 8;
+
+      // Parse profile color or default blue.
+      NSColor* bgColor = nil;
+      std::string colorHex = fp_config.GetProfileColor();
+      if (colorHex.length() >= 7 && colorHex[0] == '#') {
+        unsigned int rgb = 0;
+        NSScanner* scanner = [NSScanner scannerWithString:
+            base::SysUTF8ToNSString(colorHex.substr(1))];
+        [scanner scanHexInt:&rgb];
+        bgColor = [NSColor colorWithSRGBRed:((rgb >> 16) & 0xFF) / 255.0
+                                      green:((rgb >> 8) & 0xFF) / 255.0
+                                       blue:(rgb & 0xFF) / 255.0
+                                      alpha:1.0];
+      }
+      if (!bgColor) {
+        bgColor = [NSColor colorWithSRGBRed:0.13 green:0.59 blue:0.95 alpha:1.0];
+      }
+
+      // Full-width bottom bar with top-only rounded corners.
+      CGFloat topRadius = 6;
+      NSBezierPath* bgPath = [NSBezierPath bezierPath];
+      [bgPath moveToPoint:NSMakePoint(0, 0)];
+      [bgPath lineToPoint:NSMakePoint(iconWidth, 0)];
+      [bgPath lineToPoint:NSMakePoint(iconWidth, badgeHeight - topRadius)];
+      [bgPath curveToPoint:NSMakePoint(iconWidth - topRadius, badgeHeight)
+             controlPoint1:NSMakePoint(iconWidth, badgeHeight)
+             controlPoint2:NSMakePoint(iconWidth, badgeHeight)];
+      [bgPath lineToPoint:NSMakePoint(topRadius, badgeHeight)];
+      [bgPath curveToPoint:NSMakePoint(0, badgeHeight - topRadius)
+             controlPoint1:NSMakePoint(0, badgeHeight)
+             controlPoint2:NSMakePoint(0, badgeHeight)];
+      [bgPath closePath];
+      [bgColor setFill];
+      [bgPath fill];
+
+      // Draw text centered with shadow.
+      NSShadow* textShadow = [[NSShadow alloc] init];
+      textShadow.shadowColor = [NSColor colorWithCalibratedWhite:0 alpha:0.6];
+      textShadow.shadowOffset = NSMakeSize(0, -1);
+      textShadow.shadowBlurRadius = 2;
+      NSMutableParagraphStyle* style = [[NSMutableParagraphStyle alloc] init];
+      style.alignment = NSTextAlignmentCenter;
+      style.lineBreakMode = NSLineBreakByTruncatingTail;
+      NSDictionary* textAttrs = @{
+        NSFontAttributeName : font,
+        NSForegroundColorAttributeName : NSColor.whiteColor,
+        NSParagraphStyleAttributeName : style,
+        NSShadowAttributeName : textShadow,
+      };
+      NSRect textRect = NSMakeRect(4, (badgeHeight - textSize.height) / 2,
+                                   iconWidth - 8, textSize.height);
+      [name drawInRect:textRect withAttributes:textAttrs];
+    }
+  }
+
   if (_downloads == 0) {
     return;
   }
