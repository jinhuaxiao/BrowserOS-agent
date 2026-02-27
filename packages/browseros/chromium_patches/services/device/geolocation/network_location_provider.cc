diff --git a/services/device/geolocation/network_location_provider.cc b/services/device/geolocation/network_location_provider.cc
index 1234567890abc..fedcba0987654 100644
--- a/services/device/geolocation/network_location_provider.cc
+++ b/services/device/geolocation/network_location_provider.cc
@@ -11,6 +11,7 @@

 #include "base/feature_list.h"
 #include "base/functional/bind.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "base/location.h"
 #include "base/memory/scoped_refptr.h"
 #include "base/metrics/histogram_functions.h"
@@ -155,6 +156,32 @@ void NetworkLocationProvider::OnLocationResponse(LocationResponseResult result,
   DCHECK(thread_checker_.CalledOnValidThread());
   GEOLOCATION_LOG(DEBUG) << "Got new position";

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
+    auto spoofed_result =
+        mojom::GeopositionResult::NewPosition(std::move(spoofed_position));
+    position_cache_->SetLastUsedNetworkPosition(*spoofed_result);
+    position_cache_->CachePosition(wifi_data,
+                                   *spoofed_result->get_position());
+    is_new_data_available_ = false;
+    if (!location_provider_update_callback_.is_null()) {
+      location_provider_update_callback_.Run(this, std::move(spoofed_result));
+    }
+    internals_updated_closure_.Run();
+    network_response_callback_.Run(std::move(result.raw_response));
+    return;
+  }
+
   if (result.result_code != NetworkLocationRequestResult::kSuccess &&
       !first_session_error_.has_value()) {
     first_session_error_ = result.result_code;
@@ -269,6 +296,30 @@ void NetworkLocationProvider::RequestPosition() {
                          << is_new_data_available_ << " is_wifi_data_complete_="
                          << is_wifi_data_complete_;

+  // BrowserOS: When geolocation spoofing is active, immediately return the
+  // configured position without sending real wifi data to the network.
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
+    auto spoofed_result =
+        mojom::GeopositionResult::NewPosition(std::move(spoofed_position));
+    position_cache_->SetLastUsedNetworkPosition(*spoofed_result);
+    is_new_data_available_ = false;
+    if (!location_provider_update_callback_.is_null()) {
+      location_provider_update_callback_.Run(this, std::move(spoofed_result));
+    }
+    return;
+  }
+
   // The wifi polling policy may require us to wait for several minutes before
   // fresh wifi data is available. To ensure we can return a position estimate
   // quickly when the network location provider is the primary provider, allow
