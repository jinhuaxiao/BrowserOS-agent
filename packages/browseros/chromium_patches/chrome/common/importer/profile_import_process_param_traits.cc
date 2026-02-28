// Copyright 2013 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/common/importer/profile_import_process_param_traits.h"

// Get basic type definitions.
#define IPC_MESSAGE_IMPL
#include "chrome/common/importer/profile_import_process_param_traits_macros.h"

// Generate param traits write methods.
#include "ipc/param_traits_write_macros.h"
namespace IPC {
#undef CHROME_COMMON_IMPORTER_PROFILE_IMPORT_PROCESS_PARAM_TRAITS_MACROS_H_
#include "chrome/common/importer/profile_import_process_param_traits_macros.h"
}  // namespace IPC

// Generate param traits read methods.
#include "ipc/param_traits_read_macros.h"
namespace IPC {
#undef CHROME_COMMON_IMPORTER_PROFILE_IMPORT_PROCESS_PARAM_TRAITS_MACROS_H_
#include "chrome/common/importer/profile_import_process_param_traits_macros.h"
}  // namespace IPC

#include "mojo/public/cpp/base/string16_mojom_traits.h"

namespace mojo {

// static
bool StructTraits<chrome::mojom::ImportedPasswordFormDataView,
                  user_data_importer::ImportedPasswordForm>::
    Read(chrome::mojom::ImportedPasswordFormDataView data,
         user_data_importer::ImportedPasswordForm* out) {
  if (!data.ReadScheme(&out->scheme) ||
      !data.ReadSignonRealm(&out->signon_realm) || !data.ReadUrl(&out->url) ||
      !data.ReadAction(&out->action) ||
      !data.ReadUsernameElement(&out->username_element) ||
      !data.ReadUsernameValue(&out->username_value) ||
      !data.ReadPasswordElement(&out->password_element) ||
      !data.ReadPasswordValue(&out->password_value)) {
    return false;
  }

  out->blocked_by_user = data.blocked_by_user();
  return true;
}

// static
bool StructTraits<chrome::mojom::ImportedCookieEntryDataView,
                  browseros_importer::ImportedCookieEntry>::
    Read(chrome::mojom::ImportedCookieEntryDataView data,
         browseros_importer::ImportedCookieEntry* out) {
  if (!data.ReadHostKey(&out->host_key) || !data.ReadName(&out->name) ||
      !data.ReadValue(&out->value) || !data.ReadPath(&out->path) ||
      !data.ReadSameSite(&out->same_site) ||
      !data.ReadPriority(&out->priority) ||
      !data.ReadSourceScheme(&out->source_scheme)) {
    return false;
  }

  out->expires_utc = base::Time::FromDeltaSinceWindowsEpoch(
      base::Microseconds(data.expires_utc()));
  out->creation_utc = base::Time::FromDeltaSinceWindowsEpoch(
      base::Microseconds(data.creation_utc()));
  out->last_access_utc = base::Time::FromDeltaSinceWindowsEpoch(
      base::Microseconds(data.last_access_utc()));
  out->last_update_utc = base::Time::FromDeltaSinceWindowsEpoch(
      base::Microseconds(data.last_update_utc()));
  out->is_secure = data.is_secure();
  out->is_httponly = data.is_httponly();
  out->source_port = data.source_port();
  out->is_persistent = data.is_persistent();
  return true;
}

}  // namespace mojo
