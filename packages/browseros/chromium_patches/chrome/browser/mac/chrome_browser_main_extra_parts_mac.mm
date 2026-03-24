diff --git a/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm b/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm
index 6bb5ccb823..5b5230f826 100644
--- a/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm
+++ b/chrome/browser/mac/chrome_browser_main_extra_parts_mac.mm
@@ -4,11 +4,150 @@
 
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
+@property(nonatomic) int profileNumber;
+@end
+
+@implementation BrowserOSDockTileView
+
+@synthesize profileName = _profileName;
+@synthesize badgeColor = _badgeColor;
+@synthesize profileNumber = _profileNumber;
+
+- (void)drawRect:(NSRect)dirtyRect {
+  NSImage* appIcon = [NSImage imageNamed:NSImageNameApplicationIcon];
+  [appIcon drawInRect:self.bounds
+             fromRect:NSZeroRect
+            operation:NSCompositingOperationSourceOver
+             fraction:1.0];
+
+  if (!_profileName.length && _profileNumber <= 0) return;
+
+  CGFloat iconWidth = NSWidth(self.bounds);
+
+  // Display number if available, otherwise name.
+  NSString* displayText = (_profileNumber > 0)
+      ? [NSString stringWithFormat:@"%d", _profileNumber]
+      : _profileName;
+
+  NSColor* bgColor = _badgeColor
+      ? _badgeColor
+      : [NSColor colorWithSRGBRed:0.13 green:0.59 blue:0.95 alpha:1.0];
+
+  // AdsPower-style: circular badge in bottom-right corner.
+  CGFloat badgeSize = iconWidth * 0.38;
+  CGFloat fontSize = badgeSize * 0.55;
+  CGFloat margin = iconWidth * 0.02;
+  NSFont* font = [NSFont systemFontOfSize:fontSize weight:NSFontWeightBold];
+
+  // Measure text to expand badge for multi-digit numbers.
+  NSDictionary* measureAttrs = @{ NSFontAttributeName : font };
+  NSSize textSize = [displayText sizeWithAttributes:measureAttrs];
+  CGFloat badgeWidth = fmax(badgeSize, textSize.width + badgeSize * 0.5);
+  CGFloat badgeHeight = badgeSize;
+  CGFloat badgeX = iconWidth - badgeWidth - margin;
+  CGFloat badgeY = margin;
+  NSRect badgeRect = NSMakeRect(badgeX, badgeY, badgeWidth, badgeHeight);
+
+  // Shadow behind badge.
+  {
+    [NSGraphicsContext saveGraphicsState];
+    NSShadow* shadow = [[NSShadow alloc] init];
+    shadow.shadowColor = [NSColor colorWithCalibratedWhite:0 alpha:0.4];
+    shadow.shadowOffset = NSMakeSize(0, -1);
+    shadow.shadowBlurRadius = 3;
+    [shadow set];
+
+    NSBezierPath* bgPath = [NSBezierPath bezierPathWithRoundedRect:badgeRect
+                                                           xRadius:badgeHeight / 2
+                                                           yRadius:badgeHeight / 2];
+    [bgColor setFill];
+    [bgPath fill];
+    [NSGraphicsContext restoreGraphicsState];
+  }
+
+  // White border for contrast.
+  {
+    NSRect borderRect = NSInsetRect(badgeRect, 1.5, 1.5);
+    NSBezierPath* borderPath = [NSBezierPath bezierPathWithRoundedRect:borderRect
+                                                               xRadius:borderRect.size.height / 2
+                                                               yRadius:borderRect.size.height / 2];
+    [[NSColor colorWithCalibratedWhite:1.0 alpha:0.9] setStroke];
+    [borderPath setLineWidth:1.5];
+    [borderPath stroke];
+  }
+
+  // Draw number text centered in badge.
+  NSMutableParagraphStyle* style = [[NSMutableParagraphStyle alloc] init];
+  style.alignment = NSTextAlignmentCenter;
+  NSDictionary* textAttrs = @{
+    NSFontAttributeName : font,
+    NSForegroundColorAttributeName : NSColor.whiteColor,
+    NSParagraphStyleAttributeName : style,
+  };
+  NSRect textRect = NSMakeRect(badgeX, badgeY + (badgeHeight - textSize.height) / 2,
+                               badgeWidth, textSize.height);
+  [displayText drawInRect:textRect withAttributes:textAttrs];
+}
+
+@end
+
+void ChromeBrowserMainExtraPartsMac::PostBrowserStart() {
+  // BrowserOS: Show profile name on dock icon for multi-profile identification.
+  const auto& fp_config = blink::FingerprintConfig::GetInstance();
+  if (fp_config.HasProfileBadge() || fp_config.HasProfileNumber()) {
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
+    view.profileNumber = fp_config.GetProfileNumber();
+    [NSApp dockTile].contentView = view;
+    [[NSApp dockTile] display];
+  }
+}
