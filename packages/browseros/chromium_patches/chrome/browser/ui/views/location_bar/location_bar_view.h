diff --git a/chrome/browser/ui/views/location_bar/location_bar_view.h b/chrome/browser/ui/views/location_bar/location_bar_view.h
index abc123456..def789012 100644
--- a/chrome/browser/ui/views/location_bar/location_bar_view.h
+++ b/chrome/browser/ui/views/location_bar/location_bar_view.h
@@ -50,6 +50,9 @@
 #include "chrome/browser/ui/views/location_bar/permission_quiet_chip.h"
 #endif
 
+// BrowserOS: Profile Badge
+class ProfileBadgeView;
+
 class Browser;
 class CommandUpdater;
 class ContentSettingBubbleModelDelegate;
@@ -300,6 +303,10 @@ class LocationBarView : public LocationBar,
   // Returns the current PageActionIconView for the given |type|.
   PageActionIconView* GetPageActionIconView(PageActionIconType type);
 
+  // BrowserOS: Profile Badge
+  // Returns the profile badge view, creating it if necessary.
+  ProfileBadgeView* GetProfileBadgeView();
+
  private:
   FRIEND_TEST_ALL_PREFIXES(LocationBarViewTest, GetAccessibleNodeData);
   FRIEND_TEST_ALL_PREFIXES(TouchLocationBarBrowserTest,
@@ -403,6 +410,9 @@ class LocationBarView : public LocationBar,
   // Whether the location bar is focused and the omnibox popup is not showing.
   bool is_focused_no_popup_showing_ = false;
 
+  // BrowserOS: Profile badge showing current profile name
+  raw_ptr<ProfileBadgeView> profile_badge_view_ = nullptr;
+
   base::CallbackListSubscription browser_defaults_subscription_;
 
   base::WeakPtrFactory<LocationBarView> weak_factory_{this};
