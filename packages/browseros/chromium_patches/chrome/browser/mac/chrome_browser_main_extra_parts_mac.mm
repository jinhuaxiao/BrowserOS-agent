diff --git a/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm b/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm
index 6bb5ccb823..1e35bf278c 100644
--- a/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm
+++ b/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm
@@ -4,11 +4,138 @@
 
 #include "chrome/browser/mac/chrome_browser_main_extra_parts_mac.h"
 
+#import <AppKit/AppKit.h>
+
+#include "base/strings/sys_string_conversions.h"
+#include "chrome/browser/buildflags.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "ui/display/screen.h"
 
+#if BUILDFLAG(ENABLE_SPARKLE)
+#include "chrome/browser/mac/sparkle_glue.h"
+#endif
+
 ChromeBrowserMainExtraPartsMac::ChromeBrowserMainExtraPartsMac() = default;
 ChromeBrowserMainExtraPartsMac::~ChromeBrowserMainExtraPartsMac() = default;
 
 void ChromeBrowserMainExtraPartsMac::PreEarlyInitialization() {
   screen_ = std::make_unique<display::ScopedNativeScreen>();
 }
+
+void ChromeBrowserMainExtraPartsMac::PreCreateMainMessageLoop() {
+#if BUILDFLAG(ENABLE_SPARKLE)
+  // Initialize Sparkle. This triggers the singleton creation which handles
+  // all setup internally, including checking if updates are disabled or
+  // if running from a read-only filesystem.
+  sparkle_glue::SparkleEnabled();
+#endif
+
+}
+
+// BrowserOS: Custom dock tile view that draws profile name badge on the app icon.
+@interface BrowserOSDockTileView : NSView
+@property(nonatomic, copy) NSString* profileName;
+@property(nonatomic, copy) NSColor* badgeColor;
+@end
+
+@implementation BrowserOSDockTileView
+
+@synthesize profileName = _profileName;
+@synthesize badgeColor = _badgeColor;
+
+- (void)drawRect:(NSRect)dirtyRect {
+  NSImage* appIcon = [NSImage imageNamed:NSImageNameApplicationIcon];
+  [appIcon drawInRect:self.bounds
+             fromRect:NSZeroRect
+            operation:NSCompositingOperationSourceOver
+             fraction:1.0];
+
+  if (!_profileName.length) return;
+
+  CGFloat iconWidth = NSWidth(self.bounds);
+
+  // Full-width bottom bar (AdsPower style).
+  CGFloat fontSize = iconWidth * 0.18;
+  NSFont* font = [NSFont systemFontOfSize:fontSize weight:NSFontWeightBold];
+  NSDictionary* measureAttrs = @{ NSFontAttributeName : font };
+  NSSize textSize = [_profileName sizeWithAttributes:measureAttrs];
+  CGFloat badgeHeight = textSize.height + 8;
+
+  NSColor* bgColor = _badgeColor
+      ? _badgeColor
+      : [NSColor colorWithSRGBRed:0.13 green:0.59 blue:0.95 alpha:1.0];
+
+  // Draw background bar with top-only rounded corners.
+  CGFloat topRadius = 6;
+  NSBezierPath* bgPath = [NSBezierPath bezierPath];
+  [bgPath moveToPoint:NSMakePoint(0, 0)];
+  [bgPath lineToPoint:NSMakePoint(iconWidth, 0)];
+  [bgPath lineToPoint:NSMakePoint(iconWidth, badgeHeight - topRadius)];
+  [bgPath curveToPoint:NSMakePoint(iconWidth - topRadius, badgeHeight)
+         controlPoint1:NSMakePoint(iconWidth, badgeHeight)
+         controlPoint2:NSMakePoint(iconWidth, badgeHeight)];
+  [bgPath lineToPoint:NSMakePoint(topRadius, badgeHeight)];
+  [bgPath curveToPoint:NSMakePoint(0, badgeHeight - topRadius)
+         controlPoint1:NSMakePoint(0, badgeHeight)
+         controlPoint2:NSMakePoint(0, badgeHeight)];
+  [bgPath closePath];
+  [bgColor setFill];
+  [bgPath fill];
+
+  // Top edge highlight for depth.
+  [[NSColor colorWithCalibratedWhite:1.0 alpha:0.2] setStroke];
+  NSBezierPath* topLine = [NSBezierPath bezierPath];
+  [topLine moveToPoint:NSMakePoint(topRadius, badgeHeight - 0.5)];
+  [topLine lineToPoint:NSMakePoint(iconWidth - topRadius, badgeHeight - 0.5)];
+  [topLine setLineWidth:1.0];
+  [topLine stroke];
+
+  // Draw text centered with shadow for readability.
+  NSShadow* textShadow = [[NSShadow alloc] init];
+  textShadow.shadowColor = [NSColor colorWithCalibratedWhite:0 alpha:0.6];
+  textShadow.shadowOffset = NSMakeSize(0, -1);
+  textShadow.shadowBlurRadius = 2;
+
+  NSMutableParagraphStyle* style = [[NSMutableParagraphStyle alloc] init];
+  style.alignment = NSTextAlignmentCenter;
+  style.lineBreakMode = NSLineBreakByTruncatingTail;
+  NSDictionary* textAttrs = @{
+    NSFontAttributeName : font,
+    NSForegroundColorAttributeName : NSColor.whiteColor,
+    NSParagraphStyleAttributeName : style,
+    NSShadowAttributeName : textShadow,
+  };
+  NSRect textRect = NSMakeRect(4, (badgeHeight - textSize.height) / 2,
+                               iconWidth - 8, textSize.height);
+  [_profileName drawInRect:textRect withAttributes:textAttrs];
+}
+
+@end
+
+void ChromeBrowserMainExtraPartsMac::PostBrowserStart() {
+  // BrowserOS: Show profile name on dock icon for multi-profile identification.
+  const auto& fp_config = blink::FingerprintConfig::GetInstance();
+  if (fp_config.HasProfileBadge()) {
+    NSString* profile_name =
+        base::SysUTF8ToNSString(fp_config.GetProfileName());
+
+    NSColor* badgeColor = nil;
+    std::string colorHex = fp_config.GetProfileColor();
+    if (colorHex.length() >= 7 && colorHex[0] == '#') {
+      unsigned int rgb = 0;
+      NSScanner* scanner = [NSScanner scannerWithString:
+          base::SysUTF8ToNSString(colorHex.substr(1))];
+      [scanner scanHexInt:&rgb];
+      badgeColor = [NSColor colorWithSRGBRed:((rgb >> 16) & 0xFF) / 255.0
+                                       green:((rgb >> 8) & 0xFF) / 255.0
+                                        blue:(rgb & 0xFF) / 255.0
+                                       alpha:1.0];
+    }
+
+    BrowserOSDockTileView* view = [[BrowserOSDockTileView alloc] init];
+    view.profileName = profile_name;
+    view.badgeColor = badgeColor;
+    [NSApp dockTile].contentView = view;
+    [[NSApp dockTile] display];
+  }
+}
