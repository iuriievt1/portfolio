#!/usr/bin/env bash
# ADR-011 ř. 46, ADR-011 ř. 49, ADR-005, NAB-471
set -euo pipefail

RECIPE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly RECIPE
# shellcheck source=variables.sh
source "$RECIPE/variables.sh"
# shellcheck source=apt.sh
source "$RECIPE/apt.sh"
readonly BASE_STATUS=${1:?directory with the dpkg status of the base image}
readonly ROOT=${2:?directory to collect the runtime files into}
readonly STATUS=$ROOT/var/lib/dpkg/status.d
readonly RUNTIME_PACKAGES=("${LIBRARY_PACKAGES[@]}" "${MODEL_PACKAGES[@]}")

fail() {
	echo "$1" >&2
	exit 1
}

for package in "${RUNTIME_PACKAGES[@]}"; do
	if [[ -e "$BASE_STATUS/${package%%=*}" ]]; then
		fail "${package%%=*} is already in the base image"
	fi
done

library_packages=" ${LIBRARY_PACKAGES[*]%%=*} "
loaded=" "
for executable in "$TESSERACT" "$SANDBOX"; do
	libraries=$(ldd "$executable")
	if grep -q "not found" <<<"$libraries"; then
		fail "$executable misses libraries: $libraries"
	fi
	while read -r library; do
		owner=$(dpkg-query -S "$(realpath "$library")" | awk -F : 'NR == 1 { print $1 }')
		if [[ ! -e "$BASE_STATUS/$owner" && "$library_packages" != *" $owner "* ]]; then
			fail "$executable loads $library of $owner, which the image does not carry"
		fi
		loaded+="$owner "
	done < <(awk '$2 == "=>" { print $3 }' <<<"$libraries")
done
for package in "${LIBRARY_PACKAGES[@]%%=*}"; do
	if [[ "$loaded" != *" $package "* ]]; then
		fail "$TESSERACT does not load $package"
	fi
done

downloads=$(mktemp -d)
trap 'rm -rf "$downloads"' EXIT
chown _apt "$downloads"
cd "$downloads"
apt_get_until_fetched download "${RUNTIME_PACKAGES[@]}"

mkdir -p "$STATUS"
for deb in "$downloads"/*.deb; do
	package=$(dpkg-deb -f "$deb" Package)
	dpkg-deb -x "$deb" "$ROOT"
	dpkg-deb -f "$deb" >"$STATUS/$package"
	dpkg-deb --ctrl-tarfile "$deb" | tar -xO ./md5sums >"$STATUS/$package.md5sums"
done
(cd "$ROOT" && sha256sum -c "$RECIPE/models.sha256")

install -D -m 0755 "$TESSERACT" "$ROOT$TESSERACT"
install -D -m 0755 "$SANDBOX" "$ROOT$SANDBOX"
mkdir -p "$ROOT$LICENSES"
cp -R "$LICENSES/tesseract" "$LICENSES/leptonica" "$ROOT$LICENSES/"
