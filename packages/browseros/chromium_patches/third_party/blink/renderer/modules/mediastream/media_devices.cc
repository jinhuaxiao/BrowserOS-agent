diff --git a/third_party/blink/renderer/modules/mediastream/media_devices.cc b/third_party/blink/renderer/modules/mediastream/media_devices.cc
index 6a7b8c9d0e1f2..fingerprint123 100644
--- a/third_party/blink/renderer/modules/mediastream/media_devices.cc
+++ b/third_party/blink/renderer/modules/mediastream/media_devices.cc
@@ -13,6 +13,7 @@
 
 #include "third_party/blink/renderer/modules/mediastream/media_devices.h"
 
 #include "third_party/blink/renderer/bindings/core/v8/script_promise.h"
+#include "base/strings/string_util.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "third_party/blink/renderer/bindings/core/v8/v8_object_builder.h"
@@ -69,6 +70,13 @@ ScriptPromise MediaDevices::enumerateDevices(ScriptState* script_state,
                                              ExceptionState& exception_state) {
   UpdateWebRTCMethodCount(RTCAPIName::kEnumerateDevices);
   if (!script_state->ContextIsValid()) {
     exception_state.ThrowDOMException(DOMExceptionCode::kNotSupportedError,
                                       "Current frame is detached.");
     return ScriptPromise();
   }
+
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.IsWebRTCDisabled()) {
+    auto* resolver = MakeGarbageCollected<ScriptPromiseResolver>(script_state);
+    ScriptPromise promise = resolver->Promise();
+    MediaDeviceInfoVector empty_devices;
+    resolver->Resolve(empty_devices);
+    return promise;
+  }
@@ -121,6 +129,12 @@ ScriptPromise MediaDevices::SendUserMediaRequest(
     UserMediaRequest::MediaType media_type,
     const MediaStreamConstraints* options,
     ExceptionState& exception_state) {
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.IsWebRTCDisabled()) {
+    exception_state.ThrowDOMException(DOMExceptionCode::kNotAllowedError,
+                                      "WebRTC is disabled.");
+    return ScriptPromise();
+  }
+
   if (!script_state->ContextIsValid()) {
     exception_state.ThrowDOMException(DOMExceptionCode::kNotSupportedError,
                                       "No media device controller available; "
                                       "is this a detached window?");
     return ScriptPromise();
@@ -1339,6 +1347,90 @@ void MediaDevices::DevicesEnumerated(
   if (!audio_input_capabilities.empty()) {
     DCHECK_EQ(enumeration[static_cast<wtf_size_t>(
                               mojom::blink::MediaDeviceType::kMediaAudioInput)]
                   .size(),
               audio_input_capabilities.size());
   }
 
+  auto& config = FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.HasMediaDevices()) {
+    bool allow_audio_input_labels = false;
+    bool allow_audio_output_labels = false;
+    bool allow_video_input_labels = false;
+    bool allow_audio_input_ids = false;
+    bool allow_audio_output_ids = false;
+    bool allow_video_input_ids = false;
+    bool allow_audio_input_group = false;
+    bool allow_audio_output_group = false;
+    bool allow_video_input_group = false;
+
+    for (wtf_size_t i = 0;
+         i < static_cast<wtf_size_t>(
+                 mojom::blink::MediaDeviceType::kNumMediaDeviceTypes);
+         ++i) {
+      mojom::blink::MediaDeviceType device_type =
+          static_cast<mojom::blink::MediaDeviceType>(i);
+      for (const auto& device_info : enumeration[i]) {
+        if (!device_info.label.empty()) {
+          if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput) {
+            allow_audio_input_labels = true;
+          } else if (device_type ==
+                     mojom::blink::MediaDeviceType::kMediaAudioOutput) {
+            allow_audio_output_labels = true;
+          } else if (device_type ==
+                     mojom::blink::MediaDeviceType::kMediaVideoInput) {
+            allow_video_input_labels = true;
+          }
+        }
+        if (!device_info.device_id.empty()) {
+          if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput) {
+            allow_audio_input_ids = true;
+          } else if (device_type ==
+                     mojom::blink::MediaDeviceType::kMediaAudioOutput) {
+            allow_audio_output_ids = true;
+          } else if (device_type ==
+                     mojom::blink::MediaDeviceType::kMediaVideoInput) {
+            allow_video_input_ids = true;
+          }
+        }
+        if (!device_info.group_id.empty()) {
+          if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput) {
+            allow_audio_input_group = true;
+          } else if (device_type ==
+                     mojom::blink::MediaDeviceType::kMediaAudioOutput) {
+            allow_audio_output_group = true;
+          } else if (device_type ==
+                     mojom::blink::MediaDeviceType::kMediaVideoInput) {
+            allow_video_input_group = true;
+          }
+        }
+      }
+    }
+
+    auto normalize_kind = [](const std::string& value) -> std::string {
+      std::string out = base::ToLowerASCII(value);
+      base::TrimWhitespaceASCII(out, base::TRIM_ALL, &out);
+      out.erase(std::remove_if(out.begin(), out.end(),
+                               [](char c) {
+                                 return c == '-' || c == '_' || c == ' ';
+                               }),
+                out.end());
+      return out;
+    };
+
+    MediaDeviceInfoVector media_devices;
+    bool result_contains_nonempty_input_device_ids = false;
+    for (const auto& device : config.GetMediaDevices()) {
+      std::string kind = normalize_kind(device.kind);
+      mojom::blink::MediaDeviceType device_type;
+      if (kind == "audioinput") {
+        device_type = mojom::blink::MediaDeviceType::kMediaAudioInput;
+      } else if (kind == "audiooutput") {
+        device_type = mojom::blink::MediaDeviceType::kMediaAudioOutput;
+      } else if (kind == "videoinput") {
+        device_type = mojom::blink::MediaDeviceType::kMediaVideoInput;
+      } else {
+        continue;
+      }
+
+      bool allow_labels = false;
+      bool allow_ids = false;
+      bool allow_group = false;
+      if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput) {
+        allow_labels = allow_audio_input_labels;
+        allow_ids = allow_audio_input_ids;
+        allow_group = allow_audio_input_group;
+      } else if (device_type ==
+                 mojom::blink::MediaDeviceType::kMediaAudioOutput) {
+        allow_labels = allow_audio_output_labels;
+        allow_ids = allow_audio_output_ids;
+        allow_group = allow_audio_output_group;
+      } else if (device_type ==
+                 mojom::blink::MediaDeviceType::kMediaVideoInput) {
+        allow_labels = allow_video_input_labels;
+        allow_ids = allow_video_input_ids;
+        allow_group = allow_video_input_group;
+      }
+
+      String device_id =
+          allow_ids ? String::FromUTF8(device.device_id) : String();
+      String device_label =
+          allow_labels ? String::FromUTF8(device.label) : String();
+      String group_id =
+          allow_group ? String::FromUTF8(device.group_id) : String();
+
+      if (device_type == mojom::blink::MediaDeviceType::kMediaAudioInput ||
+          device_type == mojom::blink::MediaDeviceType::kMediaVideoInput) {
+        if (!device_id.empty()) {
+          result_contains_nonempty_input_device_ids = true;
+        }
+        media_devices.push_back(MakeGarbageCollected<InputDeviceInfo>(
+            device_id, device_label, group_id, device_type));
+      } else {
+        media_devices.push_back(MakeGarbageCollected<MediaDeviceInfo>(
+            device_id, device_label, group_id, device_type));
+      }
+    }
+
+    RecordEnumeratedDevices(result_tracker->GetScriptState(), media_devices);
+    ReportCompletedEnumerateDevices(result_contains_nonempty_input_device_ids);
+    result_tracker->Resolve(media_devices);
+    tracer->End();
+    return;
+  }
+
   MediaDeviceInfoVector media_devices;
   bool result_contains_nonempty_input_device_ids = false;
