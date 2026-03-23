diff --git a/third_party/blink/renderer/platform/fonts/font_fallback_list.cc b/third_party/blink/renderer/platform/fonts/font_fallback_list.cc
--- a/third_party/blink/renderer/platform/fonts/font_fallback_list.cc
+++ b/third_party/blink/renderer/platform/fonts/font_fallback_list.cc
@@ -28,6 +28,9 @@

 #include "third_party/blink/renderer/platform/fonts/font_fallback_list.h"

+// BrowserOS: Fingerprint config for font fallback filtering
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
+
 #include "base/timer/elapsed_timer.h"
 #include "third_party/blink/renderer/platform/font_family_names.h"
 #include "third_party/blink/renderer/platform/fonts/alternate_font_family.h"
@@ -154,6 +157,15 @@

   for (; curr_family; curr_family = curr_family->Next()) {
     family_index_++;
+
+    // BrowserOS: Skip non-allowed fonts for fingerprint defense
+    auto& fp_config = blink::FingerprintConfig::GetInstance();
+    if (fp_config.IsEnabled() && !curr_family->FamilyName().empty() &&
+        !curr_family->FamilyIsGeneric()) {
+      if (!fp_config.IsFontAllowed(curr_family->FamilyName().Utf8(), false))
+        continue;
+    }
+
     if (!font_selector_) {
       // Don't query system fonts for empty font family name.
       if (!curr_family->FamilyName().empty()) {
