diff --git a/chrome/browser/ui/views/location_bar/location_bar_view.h b/chrome/browser/ui/views/location_bar/location_bar_view.h
index 82d6c36f74..d5d9ff3467 100644
--- a/chrome/browser/ui/views/location_bar/location_bar_view.h
+++ b/chrome/browser/ui/views/location_bar/location_bar_view.h
@@ -53,6 +53,9 @@
 #include "services/device/public/cpp/geolocation/geolocation_system_permission_manager.h"
 #endif  // BUILDFLAG(OS_LEVEL_GEOLOCATION_PERMISSION_SUPPORTED)
 
+// BrowserOS: Profile Badge
+class ProfileBadgeView;
+
 class CommandUpdater;
 class ContentSettingBubbleModelDelegate;
 class IntentChipButton;
@@ -315,6 +318,10 @@ class LocationBarView
     return omnibox_popup_aim_presenter_.get();
   }
 
+  // BrowserOS: Profile Badge
+  // Returns the profile badge view, creating it if necessary.
+  ProfileBadgeView* GetProfileBadgeView();
+
  private:
   FRIEND_TEST_ALL_PREFIXES(SecurityIndicatorTest, CheckIndicatorText);
   FRIEND_TEST_ALL_PREFIXES(TouchLocationBarViewBrowserTest,
@@ -617,6 +624,9 @@ class LocationBarView
   //  reliable.
   bool in_popup_state_transition_ = false;
 
+  // BrowserOS: Profile badge showing current profile name
+  raw_ptr<ProfileBadgeView> profile_badge_view_ = nullptr;
+
   base::WeakPtrFactory<LocationBarView> weak_factory_{this};
 };
 
