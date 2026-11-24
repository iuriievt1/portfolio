#!/usr/bin/env bash
# Dev CA and server certificate for the TLS test server ✓ CAP-010. In production the customer's CA
# issues the server certificate ✓ NAB-615; here the dev CA plays that role and the simulator or
# emulator trusts it. The next key exists before its certificate, so devices can pin it as the
# backup fingerprint ✓ CAP-010-R06.
#
#   certs.sh [host-or-ip ...]   creates what is missing; extra names are for a physical phone's route
#   certs.sh --rotate           the next key gets the certificate, a new next key appears ✓ CAP-010-S04
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p certs
cd certs

days=825
sans="DNS:localhost,IP:127.0.0.1,IP:10.0.2.2"

issue() {
	openssl req -new -key server.key -subj "/CN=Ansora Vulna dev server" \
		-addext "subjectAltName=$1" -addext "extendedKeyUsage=serverAuth" -out server.csr >/dev/null 2>&1
	openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days "$days" \
		-copy_extensions copy -out server.crt >/dev/null 2>&1
	rm -f server.csr ca.srl
}

if [ "${1:-}" = "--rotate" ]; then
	[ -f next.key ] || { echo "run certs.sh first" >&2; exit 1; }
	sans=$(openssl x509 -in server.crt -noout -ext subjectAltName | tail -n +2 | tr -d ' \n' | sed 's/IPAddress:/IP:/g')
	mv server.key previous.key
	mv next.key server.key
	issue "$sans"
	openssl ecparam -name prime256v1 -genkey -noout -out next.key
	chmod 600 previous.key server.key next.key
	echo "dev TLS: rotated to the former next key; restart the tls service and distribute new fingerprints"
	exit 0
fi

for extra in "$@"; do
	case "$extra" in
		*[!0-9.]*) sans="$sans,DNS:$extra" ;;
		*) sans="$sans,IP:$extra" ;;
	esac
done

if [ ! -f ca.crt ]; then
	openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days "$days" \
		-subj "/CN=Ansora Vulna dev CA" \
		-addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" \
		-keyout ca.key -out ca.crt >/dev/null 2>&1
fi
[ -f server.key ] || openssl ecparam -name prime256v1 -genkey -noout -out server.key
[ -f next.key ] || openssl ecparam -name prime256v1 -genkey -noout -out next.key
[ -f server.crt ] || issue "$sans"
chmod 600 ca.key server.key next.key
echo "dev TLS: $(pwd)/server.crt for $sans"
