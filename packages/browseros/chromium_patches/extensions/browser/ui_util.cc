diff --git a/extensions/browser/ui_util.cc b/extensions/browser/ui_util.cc
index 1234567890..abcdef1234 100644
--- a/extensions/browser/ui_util.cc
+++ b/extensions/browser/ui_util.cc
@@ -39,8 +39,22 @@
   return true;
 }

 bool ShouldDisplayInExtensionSettings(const Extension& extension) {
-  return ShouldDisplayInExtensionSettings(extension.GetType(),
-                                          extension.location());
+  // BrowserOS: Hide managed extensions from chrome://extensions.
+  // Cannot use browseros_constants.h here (extensions/ layer cannot depend on
+  // chrome/), so check IDs and name inline.
+  static const char* const kHiddenIds[] = {
+    "iadlkgpalgdbbjcbhepkfedmfnnccjon",  // Agent (CRX signed)
+    "bflpfmnmnokmjhmgnolecpppdbdophmk",  // Agent (manifest key)
+    "aignmpakbnjpgjhlbihcdkeleipchgcd",  // Controller (CRX signed)
+    "nlnihljpboknmfagkikhkdblbedophja",  // Controller (manifest key)
+  };
+  for (const char* id : kHiddenIds) {
+    if (extension.id() == id) return false;
+  }
+  if (extension.name() == "Fingerprint Guard") return false;
+
+  return ShouldDisplayInExtensionSettings(extension.GetType(),
+                                          extension.location());
 }

 }  // namespace ui_util
