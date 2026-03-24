diff --git a/chrome/browser/ui/browser.cc b/chrome/browser/ui/browser.cc
index ca32d6faac..2e6912e677 100644
--- a/chrome/browser/ui/browser.cc
+++ b/chrome/browser/ui/browser.cc
@@ -42,6 +42,7 @@
 #include "chrome/browser/background/background_contents_service_factory.h"
 #include "chrome/browser/bookmarks/bookmark_model_factory.h"
 #include "chrome/browser/browser_process.h"
+#include "chrome/browser/browseros/core/browseros_prefs.h"
 #include "chrome/browser/buildflags.h"
 #include "chrome/browser/content_settings/host_content_settings_map_factory.h"
 #include "chrome/browser/content_settings/mixed_content_settings_tab_helper.h"
@@ -234,6 +235,7 @@
 #include "extensions/common/extension.h"
 #include "extensions/common/manifest_handlers/background_info.h"
 #include "net/base/filename_util.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "third_party/blink/public/common/security/protocol_handler_security_level.h"
 #include "third_party/blink/public/mojom/frame/blocked_navigation_types.mojom.h"
 #include "third_party/blink/public/mojom/frame/fullscreen.mojom.h"
@@ -927,6 +929,13 @@ std::u16string Browser::GetWindowTitleFromWebContents(
 
 #if BUILDFLAG(IS_MAC)
   // On Mac, we don't want to suffix the page title with the application name.
+  // BrowserOS: Prepend profile name for dock/Mission Control identification.
+  {
+    const auto& fp_config = blink::FingerprintConfig::GetInstance();
+    if (fp_config.HasProfileBadge()) {
+      return u"[" + base::UTF8ToUTF16(fp_config.GetProfileName()) + u"] " + title;
+    }
+  }
   return title;
 #else
   // If there is no title and this is an app, fall back on the app name. This
@@ -2298,6 +2307,11 @@ bool Browser::ShouldFocusLocationBarByDefault(WebContents* source) {
       source->GetController().GetPendingEntry()
           ? source->GetController().GetPendingEntry()
           : source->GetController().GetLastCommittedEntry();
+
+  // BrowserOS: Check once so the per-URL gates below can use it.
+  const bool ntp_focus_content =
+      browseros::IsNtpFocusContentEnabled(profile_->GetPrefs());
+
   if (entry) {
     const GURL& url = entry->GetURL();
     const GURL& virtual_url = entry->GetVirtualURL();
@@ -2310,15 +2324,18 @@ bool Browser::ShouldFocusLocationBarByDefault(WebContents* source) {
          url.host() == chrome::kChromeUINewTabHost) ||
         (virtual_url.SchemeIs(content::kChromeUIScheme) &&
          virtual_url.host() == chrome::kChromeUINewTabHost)) {
-      return true;
+      return !ntp_focus_content;
     }
 
     if (url.spec() == chrome::kChromeUISplitViewNewTabPageURL) {
-      return true;
+      return !ntp_focus_content;
     }
   }
 
-  return search::NavEntryIsInstantNTP(source, entry);
+  if (search::NavEntryIsInstantNTP(source, entry)) {
+    return !ntp_focus_content;
+  }
+  return false;
 }
 
 bool Browser::ShouldFocusPageAfterCrash(WebContents* source) {
