#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/certs" 2>/dev/null || { mkdir -p "$(dirname "$0")/certs"; cd "$(dirname "$0")/certs"; }
[ -f server.crt ] && exit 0
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 825 \
	-subj "/CN=Ansora Vulna dev syslog CA" -keyout ca.key -out ca.crt >/dev/null 2>&1
openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
	-subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -keyout server.key -out server.csr >/dev/null 2>&1
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 \
	-copy_extensions copy -out server.crt >/dev/null 2>&1
rm -f server.csr ca.srl
chmod 644 server.key ca.key
