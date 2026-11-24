#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
ios_signing_type="${2:-${IOS_SIGNING_TYPE:-adhoc}}"
project_dir="${CI_PROJECT_DIR:-$(pwd)}"
credentials_dir="${project_dir}/.ci/eas"
app_identifier="${IOS_BUNDLE_IDENTIFIER:-${MOBILE_DEV_APP_IDENTIFIER:-com.bfbs.player.dev}}"
android_keystore_path="${ANDROID_KEYSTORE_PATH:-${project_dir}/bfbs.keystore}"

require_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

write_credentials_json() {
  EAS_CREDENTIALS_PLATFORM="${platform}" \
    EAS_CREDENTIALS_DIR="${credentials_dir}" \
    node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const platform = process.env.EAS_CREDENTIALS_PLATFORM;
const credentialsDir = process.env.EAS_CREDENTIALS_DIR;
const credentials = {};

if (platform === "android") {
  credentials.android = {
    keystore: {
      keystorePath: process.env.ANDROID_KEYSTORE_PATH,
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keyAlias: process.env.ANDROID_KEY_ALIAS,
      keyPassword: process.env.ANDROID_KEY_PASSWORD,
    },
  };
}

if (platform === "ios") {
  credentials.ios = {
    provisioningProfilePath: path.join(credentialsDir, "ios", "profile.mobileprovision"),
    distributionCertificate: {
      path: path.join(credentialsDir, "ios", "dist.p12"),
      password: process.env.IOS_DISTRIBUTION_CERTIFICATE_PASSWORD,
    },
  };
}

fs.writeFileSync("credentials.json", `${JSON.stringify(credentials, null, 2)}\n`);
NODE
}

prepare_android_credentials() {
  require_env ANDROID_KEYSTORE_PASSWORD
  require_env ANDROID_KEY_ALIAS
  require_env ANDROID_KEY_PASSWORD

  if [[ ! -f "${android_keystore_path}" ]]; then
    echo "Android keystore not found: ${android_keystore_path}" >&2
    exit 1
  fi

  export ANDROID_KEYSTORE_PATH="${android_keystore_path}"

  write_credentials_json
}

select_mobileprovision() {
  local profile_dirs=(
    "${HOME}/Library/MobileDevice/Provisioning Profiles"
    "${HOME}/Library/Developer/Xcode/UserData/Provisioning Profiles"
  )
  local plist_file
  local profile_dir
  local profile_app_identifier

  for profile_dir in "${profile_dirs[@]}"; do
    [[ -d "${profile_dir}" ]] || continue

    while IFS= read -r -d "" profile_path; do
      plist_file="$(mktemp)"

      if security cms -D -i "${profile_path}" >"${plist_file}" 2>/dev/null; then
        profile_app_identifier="$(/usr/libexec/PlistBuddy -c "Print :Entitlements:application-identifier" "${plist_file}" 2>/dev/null || true)"

        if [[ "${profile_app_identifier}" == *".${app_identifier}" ]]; then
          cp "${profile_path}" "${credentials_dir}/ios/profile.mobileprovision"
          rm -f "${plist_file}"
          return 0
        fi
      fi

      rm -f "${plist_file}"
    done < <(find "${profile_dir}" -name "*.mobileprovision" -print0)
  done

  echo "No ${ios_signing_type} provisioning profile found for ${app_identifier}" >&2
  exit 1
}

prepare_ios_credentials() {
  require_env FASTLANE_MATCH_REPO
  require_env MATCH_PASSWORD
  require_env APPLE_DEV_TEAM
  require_env APPLE_DEV_USERNAME
  require_env IOS_BUNDLE_IDENTIFIER
  require_env IOS_DISTRIBUTION_CERTIFICATE_PASSWORD

  local keychain_name="${IOS_KEYCHAIN_NAME:-bfbs-mobile-ci.keychain}"
  local keychain_password="${IOS_KEYCHAIN_PASSWORD:-bfbs-mobile-ci}"
  local keychain
  local keychains

  mkdir -p "${credentials_dir}/ios"

  export IOS_KEYCHAIN_NAME="${keychain_name}"
  export IOS_KEYCHAIN_PASSWORD="${keychain_password}"

  ios_original_keychains=()
  while IFS= read -r keychain; do
    keychain="${keychain//\"/}"
    keychain="${keychain#"${keychain%%[![:space:]]*}"}"
    keychain="${keychain%"${keychain##*[![:space:]]}"}"
    [[ -n "${keychain}" ]] && ios_original_keychains+=("${keychain}")
  done < <(security list-keychains -d user)

  restore_ios_keychains() {
    if [[ ${#ios_original_keychains[@]} -gt 0 ]]; then
      security list-keychains -d user -s "${ios_original_keychains[@]}" >/dev/null || true
    fi
  }
  trap restore_ios_keychains EXIT

  security create-keychain -p "${keychain_password}" "${keychain_name}" 2>/dev/null || true
  security unlock-keychain -p "${keychain_password}" "${keychain_name}"
  security set-keychain-settings -lut 21600 "${keychain_name}"

  keychains=("${keychain_name}")
  for keychain in "${ios_original_keychains[@]}"; do
    [[ "${keychain}" == "${keychain_name}" || "${keychain}" == *"/${keychain_name}" ]] && continue
    keychains+=("${keychain}")
  done
  security list-keychains -d user -s "${keychains[@]}"

  case "${ios_signing_type}" in
    adhoc)
      bundle exec fastlane ios sync_adhoc_readonly
      ;;
    appstore)
      bundle exec fastlane ios sync_appstore_readonly
      ;;
    *)
      echo "Unsupported iOS signing type: ${ios_signing_type}" >&2
      exit 1
      ;;
  esac

  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${keychain_password}" "${keychain_name}" >/dev/null
  select_mobileprovision
  security export -k "${keychain_name}" -t identities -f pkcs12 -o "${credentials_dir}/ios/dist.p12" -P "${IOS_DISTRIBUTION_CERTIFICATE_PASSWORD}"
  chmod 600 "${credentials_dir}/ios/dist.p12" "${credentials_dir}/ios/profile.mobileprovision"

  write_credentials_json
}

case "${platform}" in
  android)
    prepare_android_credentials
    ;;
  ios)
    prepare_ios_credentials
    ;;
  *)
    echo "Usage: $0 android|ios [adhoc|appstore]" >&2
    exit 1
    ;;
esac
