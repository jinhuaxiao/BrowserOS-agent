diff --git a/chrome/browser/extensions/api/developer_private/developer_private_functions_shared.cc b/chrome/browser/extensions/api/developer_private/developer_private_functions_shared.cc
index 1234567890..abcdef1234 100644
--- a/chrome/browser/extensions/api/developer_private/developer_private_functions_shared.cc
+++ b/chrome/browser/extensions/api/developer_private/developer_private_functions_shared.cc
@@ -5,6 +5,7 @@
 #include "chrome/browser/extensions/api/developer_private/developer_private_functions_shared.h"

 #include "base/barrier_closure.h"
+#include "chrome/browser/browseros/core/browseros_constants.h"
 #include "base/files/file_util.h"
 #include "base/memory/ref_counted.h"
 #include "base/strings/stringprintf.h"
@@ -410,7 +411,15 @@

 void DeveloperPrivateGetExtensionsInfoFunction::OnInfosGenerated(
     ExtensionInfoGenerator::ExtensionInfoList list) {
-  Respond(ArgumentList(developer::GetExtensionsInfo::Results::Create(list)));
+  // BrowserOS: Hide managed extensions from chrome://extensions page
+  std::erase_if(list, [](const auto& info) {
+    if (browseros::IsBrowserOSExtension(info.id)) {
+      return true;
+    }
+    return info.name == browseros::kFingerprintGuardName;
+  });
+  Respond(ArgumentList(
+      developer::GetExtensionsInfo::Results::Create(list)));
 }

 DeveloperPrivateGetExtensionInfoFunction::
