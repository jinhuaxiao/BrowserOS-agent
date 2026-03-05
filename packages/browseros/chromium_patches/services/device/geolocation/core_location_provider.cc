diff --git a/services/device/geolocation/core_location_provider.cc b/services/device/geolocation/core_location_provider.cc
index 1234567890abc..fedcba0987654 100644
--- a/services/device/geolocation/core_location_provider.cc
+++ b/services/device/geolocation/core_location_provider.cc
@@ -7,6 +7,7 @@
 
 #include "base/apple/scoped_cftyperef.h"
 #include "base/task/single_thread_task_runner.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "services/device/public/cpp/device_features.h"
 #include "services/device/public/cpp/geolocation/location_system_permission_status.h"
 #include "services/device/public/mojom/geolocation_internals.mojom-shared.h"
@@ -71,6 +72,25 @@ void CoreLocationProvider::OnPermissionGranted() {
 
 void CoreLocationProvider::OnPositionUpdated(
     const mojom::Geoposition& location) {
+  // BrowserOS: Override geolocation with configured coordinates
+  const auto& fp_config = blink::FingerprintConfig::GetInstance();
+  if (fp_config.IsEnabled() && fp_config.GetGeolocationEnabled()) {
+    auto spoofed_position = mojom::Geoposition::New();
+    spoofed_position->latitude = fp_config.GetGeolocationLatitude();
+    spoofed_position->longitude = fp_config.GetGeolocationLongitude();
+    spoofed_position->accuracy = fp_config.GetGeolocationAccuracy();
+    spoofed_position->altitude = 0.0;
+    spoofed_position->altitude_accuracy = -1.0;
+    spoofed_position->heading = -1.0;
+    spoofed_position->speed = -1.0;
+    spoofed_position->timestamp = base::Time::Now();
+
+    last_result_ =
+        mojom::GeopositionResult::NewPosition(std::move(spoofed_position));
+    callback_.Run(this, last_result_.Clone());
+    return;
+  }
+
   last_result_ = mojom::GeopositionResult::NewPosition(location.Clone());
   callback_.Run(this, last_result_.Clone());
 }
