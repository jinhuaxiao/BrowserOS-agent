diff --git a/chrome/browser/ui/cocoa/dock_icon.mm b/chrome/browser/ui/cocoa/dock_icon.mm
index f08c2b156c..a35786660a 100644
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
@@ -77,6 +79,81 @@ - (void)drawRect:(NSRect)dirtyRect {
             operation:NSCompositingOperationSourceOver
              fraction:1.0];
 
+  // BrowserOS: Draw circular badge in bottom-right corner (AdsPower style).
+  {
+    const auto& fp_config = blink::FingerprintConfig::GetInstance();
+    if (fp_config.HasProfileBadge() || fp_config.HasProfileNumber()) {
+      int profileNum = fp_config.GetProfileNumber();
+      NSString* displayText = (profileNum > 0)
+          ? [NSString stringWithFormat:@"%d", profileNum]
+          : base::SysUTF8ToNSString(fp_config.GetProfileName());
+      CGFloat iconWidth = NSWidth(self.bounds);
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
+      CGFloat badgeSize = iconWidth * 0.38;
+      CGFloat fontSize = badgeSize * 0.55;
+      CGFloat margin = iconWidth * 0.02;
+      NSFont* font = [NSFont systemFontOfSize:fontSize weight:NSFontWeightBold];
+      NSDictionary* measureAttrs = @{ NSFontAttributeName : font };
+      NSSize textSize = [displayText sizeWithAttributes:measureAttrs];
+      CGFloat badgeWidth = fmax(badgeSize, textSize.width + badgeSize * 0.5);
+      CGFloat badgeHeight = badgeSize;
+      CGFloat badgeX = iconWidth - badgeWidth - margin;
+      CGFloat badgeY = margin;
+      NSRect badgeRect = NSMakeRect(badgeX, badgeY, badgeWidth, badgeHeight);
+
+      {
+        [NSGraphicsContext saveGraphicsState];
+        NSShadow* shadow = [[NSShadow alloc] init];
+        shadow.shadowColor = [NSColor colorWithCalibratedWhite:0 alpha:0.4];
+        shadow.shadowOffset = NSMakeSize(0, -1);
+        shadow.shadowBlurRadius = 3;
+        [shadow set];
+        NSBezierPath* bgPath = [NSBezierPath bezierPathWithRoundedRect:badgeRect
+                                                               xRadius:badgeHeight / 2
+                                                               yRadius:badgeHeight / 2];
+        [bgColor setFill];
+        [bgPath fill];
+        [NSGraphicsContext restoreGraphicsState];
+      }
+      {
+        NSRect borderRect = NSInsetRect(badgeRect, 1.5, 1.5);
+        NSBezierPath* borderPath = [NSBezierPath bezierPathWithRoundedRect:borderRect
+                                                                   xRadius:borderRect.size.height / 2
+                                                                   yRadius:borderRect.size.height / 2];
+        [[NSColor colorWithCalibratedWhite:1.0 alpha:0.9] setStroke];
+        [borderPath setLineWidth:1.5];
+        [borderPath stroke];
+      }
+      NSMutableParagraphStyle* style = [[NSMutableParagraphStyle alloc] init];
+      style.alignment = NSTextAlignmentCenter;
+      NSDictionary* textAttrs = @{
+        NSFontAttributeName : font,
+        NSForegroundColorAttributeName : NSColor.whiteColor,
+        NSParagraphStyleAttributeName : style,
+      };
+      NSRect textRect = NSMakeRect(badgeX, badgeY + (badgeHeight - textSize.height) / 2,
+                                   badgeWidth, textSize.height);
+      [displayText drawInRect:textRect withAttributes:textAttrs];
+    }
+  }
+
   if (_downloads == 0) {
     return;
   }
