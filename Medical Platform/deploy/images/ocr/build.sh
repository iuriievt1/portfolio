#!/usr/bin/env bash
# CAP-022-R01, CAP-022-R03, CAP-022-R14, ADR-011 ř. 46, ADR-018, NAB-468
set -euo pipefail

RECIPE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly RECIPE
# shellcheck source=variables.sh
source "$RECIPE/variables.sh"
# shellcheck source=apt.sh
source "$RECIPE/apt.sh"
readonly WORK=/tmp/ocr-build
readonly KEYRING=/usr/share/keyrings/debian-archive-keyring.gpg
readonly DOWNLOAD_RETRIES=10
readonly BUILD_PACKAGES=(ca-certificates curl build-essential cmake pkg-config zlib1g-dev libjpeg62-turbo-dev
	libpng-dev "${LIBRARY_PACKAGES[@]}" "${MODEL_PACKAGES[@]}")

printf '%s\n' \
	'Types: deb' \
	"URIs: http://snapshot.debian.org/archive/debian/$DEBIAN_SNAPSHOT" \
	'Suites: trixie trixie-updates' \
	'Components: main' \
	"Signed-By: $KEYRING" \
	'Check-Valid-Until: no' \
	'' \
	'Types: deb' \
	"URIs: http://snapshot.debian.org/archive/debian-security/$DEBIAN_SNAPSHOT" \
	'Suites: trixie-security' \
	'Components: main' \
	"Signed-By: $KEYRING" \
	'Check-Valid-Until: no' \
	>/etc/apt/sources.list.d/debian.sources
# Debian #1111554
echo 'Acquire::Retries "0";' >/etc/apt/apt.conf.d/80-retries

export DEBIAN_FRONTEND=noninteractive
apt_get_until_fetched update
apt_get_until_fetched install -y --download-only --no-install-recommends "${BUILD_PACKAGES[@]}"
apt-get install -y --no-install-recommends "${BUILD_PACKAGES[@]}"
(cd / && sha256sum -c "$RECIPE/models.sha256")

rm -rf "$WORK"
mkdir "$WORK"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
curl -fsSL --retry "$DOWNLOAD_RETRIES" -o "leptonica-$LEPTONICA_VERSION.tar.gz" \
	"https://github.com/DanBloomberg/leptonica/releases/download/$LEPTONICA_VERSION/leptonica-$LEPTONICA_VERSION.tar.gz"
curl -fsSL --retry "$DOWNLOAD_RETRIES" -o "tesseract-$TESSERACT_VERSION.tar.gz" \
	"https://github.com/tesseract-ocr/tesseract/archive/refs/tags/$TESSERACT_VERSION.tar.gz"
sha256sum -c "$RECIPE/sources.sha256"
tar -xzf "leptonica-$LEPTONICA_VERSION.tar.gz"
tar -xzf "tesseract-$TESSERACT_VERSION.tar.gz"

export DEB_BUILD_MAINT_OPTIONS=hardening=+all
CFLAGS="$(dpkg-buildflags --get CFLAGS) $(dpkg-buildflags --get CPPFLAGS)"
CXXFLAGS="$(dpkg-buildflags --get CXXFLAGS) $(dpkg-buildflags --get CPPFLAGS)"
LDFLAGS=$(dpkg-buildflags --get LDFLAGS)
export CFLAGS CXXFLAGS LDFLAGS

cmake -S "leptonica-$LEPTONICA_VERSION" -B leptonica-build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
	-DCMAKE_INSTALL_PREFIX="$PREFIX" -DSW_BUILD=OFF -DBUILD_PROG=OFF \
	-DENABLE_ZLIB=ON -DENABLE_PNG=ON -DENABLE_JPEG=ON \
	-DENABLE_GIF=OFF -DENABLE_TIFF=OFF -DENABLE_WEBP=OFF -DENABLE_OPENJPEG=OFF
cmake --build leptonica-build --parallel "$(nproc)"
cmake --install leptonica-build

cmake -S "tesseract-$TESSERACT_VERSION" -B tesseract-build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
	-DCMAKE_INSTALL_PREFIX="$PREFIX" \
	-DBUILD_TRAINING_TOOLS=OFF -DBUILD_TESTS=OFF -DENABLE_NATIVE=OFF -DOPENMP_BUILD=OFF \
	-DDISABLE_CURL=ON -DDISABLE_ARCHIVE=ON -DDISABLE_TIFF=ON -DGRAPHICS_DISABLED=ON -DDISABLED_LEGACY_ENGINE=ON
cmake --build tesseract-build --parallel "$(nproc)"
cmake --install tesseract-build --strip

# ADR-005, backend.md 5
cc $CFLAGS -Wall -Wextra -Werror $LDFLAGS -o "$SANDBOX" "$RECIPE/sandbox.c"
strip "$SANDBOX"

install -D -m 0644 "tesseract-$TESSERACT_VERSION/LICENSE" "$LICENSES/tesseract/LICENSE"
install -D -m 0644 "leptonica-$LEPTONICA_VERSION/leptonica-license.txt" "$LICENSES/leptonica/leptonica-license.txt"
"$TESSERACT" --version
