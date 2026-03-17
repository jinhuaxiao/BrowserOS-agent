diff --git a/extensions/browser/api/management/management_api.cc b/extensions/browser/api/management/management_api.cc
index 1234567890..abcdef1234 100644
--- a/extensions/browser/api/management/management_api.cc
+++ b/extensions/browser/api/management/management_api.cc
@@ -82,7 +82,18 @@
 // Returns true if the extension should be exposed via the chrome.management
 // API.
 bool ShouldExposeViaManagementAPI(const Extension& extension) {
-  return !Manifest::IsComponentLocation(extension.location());
+  if (Manifest::IsComponentLocation(extension.location())) {
+    return false;
+  }
+  // BrowserOS: Hide managed extensions from chrome.management API.
+  // Cannot use browseros_constants.h here (extensions/ layer cannot depend on
+  // chrome/), so check IDs and name inline.
+  if (extension.id() == "iadlkgpalgdbbjcbhepkfedmfnnccjon" ||  // Agent
+      extension.id() == "aignmpakbnjpgjhlbihcdkeleipchgcd" ||  // Controller
+      extension.name() == "Fingerprint Guard") {
+    return false;
+  }
+  return true;
 }

 // Utility function to make the code below less ifdef-y.
