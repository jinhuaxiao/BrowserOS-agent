diff --git a/third_party/blink/renderer/modules/mediastream/media_devices.cc b/third_party/blink/renderer/modules/mediastream/media_devices.cc
index 86a41c16dc..8c10953343 100644
--- a/third_party/blink/renderer/modules/mediastream/media_devices.cc
+++ b/third_party/blink/renderer/modules/mediastream/media_devices.cc
@@ -11,8 +11,10 @@
 #include "base/metrics/histogram_functions.h"
 #include "base/notreached.h"
 #include "base/strings/strcat.h"
+#include "base/strings/string_util.h"
 #include "base/uuid.h"
 #include "build/build_config.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "media/base/media_permission.h"
 #include "mojo/public/cpp/bindings/remote.h"
 #include "services/network/public/mojom/permissions_policy/permissions_policy_feature.mojom-blink.h"
@@ -444,6 +446,15 @@ ScriptPromise<IDLSequence<MediaDeviceInfo>> MediaDevices::enumerateDevices(
     return ScriptPromise<IDLSequence<MediaDeviceInfo>>();
   }
 
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.IsWebRTCDisabled()) {
+    auto* resolver = MakeGarbageCollected<ScriptPromiseResolver<IDLSequence<MediaDeviceInfo>>>(script_state);
+    auto promise = resolver->Promise();
+    HeapVector<Member<MediaDeviceInfo>> empty_devices;
+    resolver->Resolve(empty_devices);
+    return promise;
+  }
+
   auto tracer = std::make_unique<ScopedMediaStreamTracer>(
       "MediaDevices.EnumerateDevices");
   auto* result_tracker = MakeGarbageCollected<ScriptPromiseResolverWithTracker<
@@ -488,6 +499,13 @@ ScriptPromise<MediaStream> MediaDevices::getUserMedia(
   resolver->SetResultSuffix("Result3");
   const auto promise = resolver->Promise();
 
+  auto& fp_config = FingerprintConfig::GetInstance();
+  if (fp_config.IsEnabled() && fp_config.IsWebRTCDisabled()) {
+    exception_state.ThrowDOMException(DOMExceptionCode::kNotAllowedError,
+                                      "WebRTC is disabled.");
+    return promise;
+  }
+
   DCHECK(options);  // Guaranteed by the default value in the IDL.
   DCHECK(!exception_state.HadException());
 
@@ -1307,39 +1325,73 @@ void MediaDevices::DevicesEnumerated(
 
   MediaDeviceInfoVector media_devices;
   bool result_contains_nonempty_input_device_ids = false;
-  for (wtf_size_t i = 0;
-       i < static_cast<wtf_size_t>(
-               mojom::blink::MediaDeviceType::kNumMediaDeviceTypes);
-       ++i) {
-    for (wtf_size_t j = 0; j < enumeration[i].size(); ++j) {
-      mojom::blink::MediaDeviceType device_type =
-          static_cast<mojom::blink::MediaDeviceType>(i);
-      WebMediaDeviceInfo device_info = enumeration[i][j];
-      String device_label = String::FromUTF8(device_info.label);
+
+  auto& fp_config = FingerprintConfig::GetInstance();
+  if (fp_config.IsEnabled() && fp_config.HasMediaDevices()) {
+    const auto& spoofed_devices = fp_config.GetMediaDevices();
+    for (const auto& dev : spoofed_devices) {
+      mojom::blink::MediaDeviceType device_type;
+      if (dev.kind == "audioinput") {
+        device_type = mojom::blink::MediaDeviceType::kMediaAudioInput;
+      } else if (dev.kind == "videoinput") {
+        device_type = mojom::blink::MediaDeviceType::kMediaVideoInput;
+      } else if (dev.kind == "audiooutput") {
+        device_type = mojom::blink::MediaDeviceType::kMediaAudioOutput;
+      } else {
+        continue;
+      }
+      String device_id = String::FromUTF8(dev.device_id);
+      String label = String::FromUTF8(dev.label);
+      String group_id = String::FromUTF8(dev.group_id);
       if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput ||
           device_type == mojom::blink::MediaDeviceType::kMediaVideoInput) {
-        if (!device_info.device_id.empty()) {
+        if (!dev.device_id.empty()) {
           result_contains_nonempty_input_device_ids = true;
         }
         InputDeviceInfo* input_device_info =
             MakeGarbageCollected<InputDeviceInfo>(
-                String::FromUTF8(device_info.device_id), device_label,
-                String::FromUTF8(device_info.group_id), device_type);
-        if (device_type == mojom::blink::MediaDeviceType::kMediaVideoInput &&
-            !video_input_capabilities.empty()) {
-          input_device_info->SetVideoInputCapabilities(
-              std::move(video_input_capabilities[j]));
-        }
-        if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput &&
-            !audio_input_capabilities.empty()) {
-          input_device_info->SetAudioInputCapabilities(
-              std::move(audio_input_capabilities[j]));
-        }
+                device_id, label, group_id, device_type);
         media_devices.push_back(input_device_info);
       } else {
         media_devices.push_back(MakeGarbageCollected<MediaDeviceInfo>(
-            String::FromUTF8(device_info.device_id), device_label,
-            String::FromUTF8(device_info.group_id), device_type));
+            device_id, label, group_id, device_type));
+      }
+    }
+  } else {
+    for (wtf_size_t i = 0;
+         i < static_cast<wtf_size_t>(
+                 mojom::blink::MediaDeviceType::kNumMediaDeviceTypes);
+         ++i) {
+      for (wtf_size_t j = 0; j < enumeration[i].size(); ++j) {
+        mojom::blink::MediaDeviceType device_type =
+            static_cast<mojom::blink::MediaDeviceType>(i);
+        WebMediaDeviceInfo device_info = enumeration[i][j];
+        String device_label = String::FromUTF8(device_info.label);
+        if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput ||
+            device_type == mojom::blink::MediaDeviceType::kMediaVideoInput) {
+          if (!device_info.device_id.empty()) {
+            result_contains_nonempty_input_device_ids = true;
+          }
+          InputDeviceInfo* input_device_info =
+              MakeGarbageCollected<InputDeviceInfo>(
+                  String::FromUTF8(device_info.device_id), device_label,
+                  String::FromUTF8(device_info.group_id), device_type);
+          if (device_type == mojom::blink::MediaDeviceType::kMediaVideoInput &&
+              !video_input_capabilities.empty()) {
+            input_device_info->SetVideoInputCapabilities(
+                std::move(video_input_capabilities[j]));
+          }
+          if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput &&
+              !audio_input_capabilities.empty()) {
+            input_device_info->SetAudioInputCapabilities(
+                std::move(audio_input_capabilities[j]));
+          }
+          media_devices.push_back(input_device_info);
+        } else {
+          media_devices.push_back(MakeGarbageCollected<MediaDeviceInfo>(
+              String::FromUTF8(device_info.device_id), device_label,
+              String::FromUTF8(device_info.group_id), device_type));
+        }
       }
     }
   }
