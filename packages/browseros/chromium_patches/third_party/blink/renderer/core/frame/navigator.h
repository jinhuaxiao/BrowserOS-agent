diff --git a/third_party/blink/renderer/core/frame/navigator.h b/third_party/blink/renderer/core/frame/navigator.h
index ae0804af47..db34d93539 100644
--- a/third_party/blink/renderer/core/frame/navigator.h
+++ b/third_party/blink/renderer/core/frame/navigator.h
@@ -45,6 +45,7 @@ class CORE_EXPORT Navigator final : public NavigatorBase,
   String vendor() const;
   String vendorSub() const;
 
+  String userAgent() const override;
   String platform() const override;
 
   String GetAcceptLanguages() override;
@@ -52,6 +53,9 @@ class CORE_EXPORT Navigator final : public NavigatorBase,
 
   void Trace(Visitor*) const override;
 
+ protected:
+  UserAgentMetadata GetUserAgentMetadata() const override;
+
  private:
   UserAgentMetadata metadata_;
 };
