diff --git a/third_party/blink/renderer/modules/font_access/font_access.cc b/third_party/blink/renderer/modules/font_access/font_access.cc
index 3fd2acdb1f..459c8a237e 100644
--- a/third_party/blink/renderer/modules/font_access/font_access.cc
+++ b/third_party/blink/renderer/modules/font_access/font_access.cc
@@ -23,6 +23,9 @@
 #include "third_party/blink/renderer/modules/font_access/font_metadata.h"
 #include "third_party/blink/renderer/platform/bindings/script_state.h"
 
+// BrowserOS: Fingerprint config for font enumeration filtering
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
+
 namespace blink {
 
 using mojom::blink::FontEnumerationStatus;
@@ -154,6 +157,13 @@ void FontAccess::DidGetEnumerationResponse(
   table.ParseFromArray(mapped_mem.data(),
                        base::checked_cast<int>(mapped_mem.size()));
   for (const auto& element : table.fonts()) {
+    // BrowserOS: filter fonts by fingerprint config
+    auto& fp_config = FingerprintConfig::GetInstance();
+    if (fp_config.IsEnabled() &&
+        !fp_config.IsFontAllowed(element.family(), false)) {
+      continue;
+    }
+
     // If the optional postscript name filter is set in QueryOptions,
     // only allow items that match.
     if (hasPostscriptNameFilter &&
