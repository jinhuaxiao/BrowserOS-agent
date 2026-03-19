diff --git a/net/socket/ssl_client_socket_impl.cc b/net/socket/ssl_client_socket_impl.cc
--- a/net/socket/ssl_client_socket_impl.cc
+++ b/net/socket/ssl_client_socket_impl.cc
@@ -35,6 +35,7 @@
 #include "base/values.h"
 #include "build/build_config.h"
 #include "crypto/openssl_util.h"
+#include "third_party/blink/common/fingerprint/fingerprint_config.h"
 #include "net/base/features.h"
 #include "net/base/ip_address.h"
 #include "net/base/ip_endpoint.h"
@@ -73,6 +74,70 @@ namespace net {

 namespace {

+// TLS cipher suite orderings for different browser profiles.
+// These affect the JA3/JA4 fingerprint hash.
+
+// Chrome default TLS 1.3 cipher ordering
+static const char kChromeCiphers[] =
+    "TLS_AES_128_GCM_SHA256:"
+    "TLS_AES_256_GCM_SHA384:"
+    "TLS_CHACHA20_POLY1305_SHA256:"
+    "ECDHE-ECDSA-AES128-GCM-SHA256:"
+    "ECDHE-RSA-AES128-GCM-SHA256:"
+    "ECDHE-ECDSA-AES256-GCM-SHA384:"
+    "ECDHE-RSA-AES256-GCM-SHA384:"
+    "ECDHE-ECDSA-CHACHA20-POLY1305:"
+    "ECDHE-RSA-CHACHA20-POLY1305";
+
+// Firefox TLS 1.3 cipher ordering (ChaCha20 before AES-256)
+static const char kFirefoxCiphers[] =
+    "TLS_AES_128_GCM_SHA256:"
+    "TLS_CHACHA20_POLY1305_SHA256:"
+    "TLS_AES_256_GCM_SHA384:"
+    "ECDHE-ECDSA-AES128-GCM-SHA256:"
+    "ECDHE-RSA-AES128-GCM-SHA256:"
+    "ECDHE-ECDSA-CHACHA20-POLY1305:"
+    "ECDHE-RSA-CHACHA20-POLY1305:"
+    "ECDHE-ECDSA-AES256-GCM-SHA384:"
+    "ECDHE-RSA-AES256-GCM-SHA384";
+
+// Safari TLS cipher ordering
+static const char kSafariCiphers[] =
+    "TLS_AES_128_GCM_SHA256:"
+    "TLS_AES_256_GCM_SHA384:"
+    "TLS_CHACHA20_POLY1305_SHA256:"
+    "ECDHE-ECDSA-AES256-GCM-SHA384:"
+    "ECDHE-ECDSA-AES128-GCM-SHA256:"
+    "ECDHE-ECDSA-CHACHA20-POLY1305:"
+    "ECDHE-RSA-AES256-GCM-SHA384:"
+    "ECDHE-RSA-AES128-GCM-SHA256:"
+    "ECDHE-RSA-CHACHA20-POLY1305";
+
+// Apply TLS profile from FingerprintConfig to SSL context.
+// This modifies the cipher suite ordering to match the target browser,
+// affecting the JA3/JA4 TLS fingerprint hash.
+void MaybeApplyTLSProfile(SSL_CTX* ctx) {
+  const auto& config = blink::FingerprintConfig::GetInstance();
+  if (!config.IsEnabled())
+    return;
+
+  const std::string& profile = config.GetTLSProfile();
+  if (profile.empty() || profile == "chrome") {
+    SSL_CTX_set_cipher_list(ctx, kChromeCiphers);
+  } else if (profile == "firefox") {
+    SSL_CTX_set_cipher_list(ctx, kFirefoxCiphers);
+  } else if (profile == "safari") {
+    SSL_CTX_set_cipher_list(ctx, kSafariCiphers);
+  }
+
+  // Enable TLS extension permutation for additional fingerprint diversity.
+  SSL_CTX_set_permute_extensions(ctx, 1);
+}
+
+}  // namespace
+
+namespace {
+
 // This constant can be any non-negative/non-zero value (eg: it does not
 // overlap with any value of the net::Error range, including net::OK).
 const int kSSLClientSocketNoPendingResult = 1;
@@ -664,6 +729,9 @@ int SSLClientSocketImpl::Init() {
   if (!ssl_ || !context->SetClientSocketForSSL(ssl_.get(), this))
     return ERR_UNEXPECTED;

+  // Nova Seller: Apply TLS profile for JA3/JA4 fingerprint customization
+  MaybeApplyTLSProfile(SSL_get_SSL_CTX(ssl_.get()));
+
   const bool host_is_ip_address =
       HostIsIPAddressNoBrackets(host_and_port_.host());
