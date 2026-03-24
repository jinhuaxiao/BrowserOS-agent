diff --git a/chrome/browser/mac/chrome_browser_main_extra_parts_mac.h b/chrome/browser/mac/chrome_browser_main_extra_parts_mac.h
index 95726e7765..821ca6493b 100644
--- a/chrome/browser/mac/chrome_browser_main_extra_parts_mac.h
+++ b/chrome/browser/mac/chrome_browser_main_extra_parts_mac.h
@@ -24,6 +24,8 @@ class ChromeBrowserMainExtraPartsMac : public ChromeBrowserMainExtraParts {
 
   // ChromeBrowserMainExtraParts:
   void PreEarlyInitialization() override;
+  void PreCreateMainMessageLoop() override;
+  void PostBrowserStart() override;
 
  private:
   std::unique_ptr<display::ScopedNativeScreen> screen_;
