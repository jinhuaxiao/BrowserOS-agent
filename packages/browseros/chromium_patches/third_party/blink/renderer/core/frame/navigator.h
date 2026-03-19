diff --git a/third_party/blink/renderer/core/frame/navigator.h b/third_party/blink/renderer/core/frame/navigator.h
index 2059101f63..c0ebd37686 100644
--- a/third_party/blink/renderer/core/frame/navigator.h
+++ b/third_party/blink/renderer/core/frame/navigator.h
@@ -45,11 +45,18 @@ class CORE_EXPORT Navigator final : public NavigatorBase,
   String vendor() const;
   String vendorSub() const;
 
+  String userAgent() const override;
   String platform() const override;
 
   String GetAcceptLanguages() override;
 
   void Trace(Visitor*) const override;
+
+ protected:
+  UserAgentMetadata GetUserAgentMetadata() const override;
+
+ private:
+  UserAgentMetadata metadata_;
 };
 
 }  // namespace blink
