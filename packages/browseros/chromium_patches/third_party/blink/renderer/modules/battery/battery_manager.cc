diff --git a/third_party/blink/renderer/modules/battery/battery_manager.cc b/third_party/blink/renderer/modules/battery/battery_manager.cc
index 51cdc75cee..31098ddb25 100644
--- a/third_party/blink/renderer/modules/battery/battery_manager.cc
+++ b/third_party/blink/renderer/modules/battery/battery_manager.cc
@@ -4,6 +4,7 @@
 
 #include "third_party/blink/renderer/modules/battery/battery_manager.h"
 
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "third_party/blink/public/mojom/frame/lifecycle.mojom-blink.h"
 #include "third_party/blink/renderer/core/dom/dom_exception.h"
 #include "third_party/blink/renderer/core/dom/events/event.h"
@@ -80,24 +81,51 @@ ScriptPromise<BatteryManager> BatteryManager::StartRequest(
 }
 
 bool BatteryManager::charging() {
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetBatteryEnabled()) {
+    return config.GetBatteryCharging();
+  }
   return battery_status_.Charging();
 }
 
 double BatteryManager::chargingTime() {
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetBatteryEnabled()) {
+    return config.GetBatteryChargingTime();
+  }
   return battery_status_.charging_time().InSecondsF();
 }
 
 double BatteryManager::dischargingTime() {
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetBatteryEnabled()) {
+    return config.GetBatteryDischargingTime();
+  }
   return battery_status_.discharging_time().InSecondsF();
 }
 
 double BatteryManager::level() {
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetBatteryEnabled()) {
+    return config.GetBatteryLevel();
+  }
   return battery_status_.Level();
 }
 
 void BatteryManager::DidUpdateData() {
   DCHECK(battery_property_);
 
+  // When battery spoofing is active, resolve the promise once
+  // but the getter values come from config instead of real status.
+  // Only resolve if still pending — Promise can only be resolved once.
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (config.IsEnabled() && config.GetBatteryEnabled()) {
+    if (battery_property_->GetState() == BatteryProperty::kPending) {
+      battery_property_->Resolve(this);
+    }
+    return;
+  }
+
   BatteryStatus old_status = battery_status_;
   battery_status_ = *battery_dispatcher_->LatestData();
 
