diff --git a/chrome/browser/ui/views/location_bar/location_bar_view.cc b/chrome/browser/ui/views/location_bar/location_bar_view.cc
index abc123456..def789012 100644
--- a/chrome/browser/ui/views/location_bar/location_bar_view.cc
+++ b/chrome/browser/ui/views/location_bar/location_bar_view.cc
@@ -100,6 +100,10 @@
 #include "chrome/browser/ui/views/location_bar/intent_chip_button.h"
 #endif

+// BrowserOS: Profile Badge
+#include "chrome/browser/ui/views/location_bar/profile_badge_view.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
+
 namespace {

 // The border radius of the omnibox.
@@ -200,6 +204,17 @@ void LocationBarView::Init() {
   // |location_icon_view_| is initially set to be visible.
   location_icon_view_->SetVisible(true);

+  // BrowserOS: Create profile badge view if fingerprint config has profile info
+  const auto& fingerprint_config = blink::FingerprintConfig::GetInstance();
+  if (fingerprint_config.HasProfileBadge()) {
+    profile_badge_view_ = AddChildViewAt(
+        std::make_unique<ProfileBadgeView>(), 0);
+    profile_badge_view_->SetProfile(
+        fingerprint_config.GetProfileName(),
+        fingerprint_config.GetProfileColor());
+    profile_badge_view_->SetVisible(true);
+  }
+
   // Initialize the Omnibox view.
   omnibox_view_ = std::make_unique<OmniboxViewViews>(
       this, std::make_unique<OmniboxEditController>(
@@ -350,6 +365,14 @@ gfx::Size LocationBarView::CalculatePreferredSize(
   return GetSizeNeededForMinWidth(min_width);
 }

+// BrowserOS: Profile Badge getter
+ProfileBadgeView* LocationBarView::GetProfileBadgeView() {
+  if (!profile_badge_view_) {
+    profile_badge_view_ = AddChildViewAt(std::make_unique<ProfileBadgeView>(), 0);
+  }
+  return profile_badge_view_;
+}
+
 void LocationBarView::Layout(PassKey) {
   TRACE_EVENT0("ui", "LocationBarView::Layout");

@@ -380,6 +403,22 @@ void LocationBarView::Layout(PassKey) {
   int leading_decorations_width = 0;
   int trailing_decorations_width = 0;

+  // BrowserOS: Layout profile badge first if present
+  if (profile_badge_view_ && profile_badge_view_->GetVisible()) {
+    gfx::Size badge_size = profile_badge_view_->GetPreferredSize();
+    // Center vertically within the location bar
+    int badge_y = (height() - badge_size.height()) / 2;
+    profile_badge_view_->SetBounds(
+        kLocationBarBorderThickness + edge_padding,
+        badge_y,
+        badge_size.width(),
+        badge_size.height());
+    leading_decorations_width += badge_size.width() + edge_padding;
+    // Add separator space after badge
+    const int kBadgeSeparatorWidth = 8;
+    leading_decorations_width += kBadgeSeparatorWidth;
+  }
+
   // Position |location_icon_view_|.
   if (location_icon_view_->GetVisible()) {
     gfx::Size icon_size = location_icon_view_->GetPreferredSize();
