#!/usr/bin/env bash
# ADR-024, Q-040, ADR-018, ADR-021
set -euo pipefail
cd "$(dirname "$0")/../.."

readonly DATABASE=vulna_system
# db/dev/bootstrap.sh
readonly ROLE_PASSWORD=vulna
readonly LOOPBACK=127.0.0.1
readonly DATABASE_PORT=5432
readonly OWNER_URL="postgres://postgres:postgres@$LOOPBACK:$DATABASE_PORT/$DATABASE"
# package.json image:build
readonly IMAGE=ansora-vulna-server:dev
readonly API_CONTAINER=vulna-system-api
readonly WORKER_CONTAINER=vulna-system-worker
readonly API_PORT=3100
readonly API_SURVEILLANCE_PORT=3101
readonly WORKER_SURVEILLANCE_PORT=3102
readonly SURVEILLANCE_TOKEN=system-test-surveillance-token-0123456789
# RFC 863
readonly UNREACHABLE_IDENTITY_PROVIDER="http://$LOOPBACK:9/"
readonly PACS_PORT=4242
readonly PACS_AE_TITLE=ORTHANC
readonly PACS_CALLING_AE_TITLE=VULNA
# dev/pacs/orthanc.json
readonly ORTHANC_URL="http://$LOOPBACK:8042"
readonly ORTHANC_USER=vulna
readonly ORTHANC_PASSWORD=vulna
# dev/clinical-record.sh
readonly CLINICAL_RECORD_URL="http://$LOOPBACK:8103/"
readonly SYSLOG_PORT=6514
# dev/syslog/syslog-ng.conf
readonly SYSLOG_FILE=.data/syslog/messages.log
readonly KEY_VERSION=1
readonly READY_WAIT_SECONDS=180
readonly CURL_WAIT_SECONDS=2
# dev/dicom/peers.sh
readonly EVIDENCE=dist/system-evidence
readonly WORK=.data/system-work
# Dockerfile stand-api, stand-worker
readonly KEYS=/keys

psql() {
	docker compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

role_url() {
	echo "postgres://$1:$ROLE_PASSWORD@$LOOPBACK:$DATABASE_PORT/$DATABASE"
}

save_logs() {
	for name in "$API_CONTAINER" "$WORKER_CONTAINER"; do
		if docker container inspect "$name" > /dev/null 2>&1; then
			docker logs "$name" > "$EVIDENCE/$name.log" 2>&1 || true
		fi
	done
	docker compose --profile pacs --profile syslog --profile clinical-record logs --no-color --timestamps \
		> "$EVIDENCE/services.log" 2>&1 || true
}

stop_processes() {
	set +e
	save_logs
	docker rm -f "$API_CONTAINER" "$WORKER_CONTAINER" > /dev/null 2>&1
}

quietly() {
	local name=$1
	shift
	if ! "$@" > "$EVIDENCE/$name.log" 2>&1; then
		tail -n 50 "$EVIDENCE/$name.log" >&2
		return 1
	fi
}

wait_until_ready() {
	local name=$1 port=$2
	for _ in $(seq "$READY_WAIT_SECONDS"); do
		if [ "$(docker container inspect -f '{{.State.Running}}' "$name")" != "true" ]; then
			save_logs
			echo "$name stopped, see $EVIDENCE/$name.log" >&2
			return 1
		fi
		if curl -sf --max-time "$CURL_WAIT_SECONDS" "http://$LOOPBACK:$port/health/ready" > /dev/null; then
			return 0
		fi
		sleep 1
	done
	save_logs
	echo "$name did not become ready, see $EVIDENCE/$name.log; on macOS Docker Desktop needs Enable host networking" >&2
	return 1
}

# ADR-005 ř. 37, CAP-012-R30
start_server() {
	local name=$1
	shift
	docker run -d --name "$name" --network host --user "$(id -u):$(id -g)" \
		-v "$PWD/$WORK/binary:$KEYS/binary" "$@" > /dev/null
}

case "${1:-}" in
	--keep) ;;
	"") trap stop_processes EXIT ;;
	*)
		echo "usage: $0 [--keep]" >&2
		exit 2
		;;
esac

docker rm -f "$API_CONTAINER" "$WORKER_CONTAINER" > /dev/null 2>&1 || true
rm -rf "$EVIDENCE" "$WORK"
mkdir -p "$EVIDENCE" "$WORK/binary" "$WORK/hpke" "$WORK/qr"

echo "== build"
quietly build pnpm exec nx run @ansora/tools:build
quietly typecheck pnpm --filter @ansora/tools typecheck:system
quietly image pnpm image:build

echo "== database $DATABASE"
docker compose up -d --wait postgres
if [ "$(psql -d postgres -tAc "select 1 from pg_roles where rolname = 'vulna_migrate'")" != "1" ]; then
	grep '^CREATE ROLE' db/roles/roles.sql | psql -d postgres -q
fi
psql -d postgres -q -v password="$ROLE_PASSWORD" << 'SQL'
ALTER ROLE vulna_migrate PASSWORD :'password';
ALTER ROLE vulna_api PASSWORD :'password';
ALTER ROLE vulna_worker PASSWORD :'password';
SQL
psql -d postgres -qc "drop database if exists $DATABASE with (force)"
psql -d postgres -qc "create database $DATABASE"
sed '/^CREATE ROLE/d' db/roles/roles.sql | psql -d "$DATABASE" -q
docker run --rm --network host -e DATABASE_URL_MIGRATE="$(role_url vulna_migrate)" "$IMAGE" \
	apps/vulna-server-migrate/dist/main.js > "$EVIDENCE/migrate.log" 2>&1
# db/dev/bootstrap.sh
for file in login-configuration patient-identification-configuration dicom-configuration; do
	psql -d "$DATABASE" -q -f - < "db/dev/$file.sql"
done

echo "== synthetic PACS and Syslog"
docker compose --profile pacs up -d --wait pacs
bash dev/syslog/certs.sh
mkdir -p "$(dirname "$SYSLOG_FILE")"
[ -e "$SYSLOG_FILE" ] || : > "$SYSLOG_FILE"
docker compose --profile syslog up -d --wait --force-recreate syslog
psql -d "$DATABASE" -q -v pacs_host="$LOOPBACK" -v pacs_port="$PACS_PORT" -v pacs_ae_title="$PACS_AE_TITLE" \
	-v pacs_calling_ae_title="$PACS_CALLING_AE_TITLE" -v syslog_host="$LOOPBACK" -v syslog_port="$SYSLOG_PORT" \
	-f - < db/dev/system-configuration.sql

echo "== clinical record store, rotates the credentials in .data/clinical-record*.env"
quietly clinical-record env VULNA_DATABASE="$DATABASE" DATABASE_URL_API="$(role_url vulna_api)" bash dev/clinical-record.sh

echo "== keys"
quietly hpke pnpm --filter @ansora/tools hpke:keygen "$PWD/$WORK/hpke" "$KEY_VERSION"
quietly qr pnpm --filter @ansora/tools qr:keygen "$PWD/$WORK/qr" "$KEY_VERSION"

echo "== processes from $IMAGE"
(
	umask 077
	cat > "$WORK/api.env" << EOF
PORT_API=$API_PORT
PORT_API_SURVEILLANCE=$API_SURVEILLANCE_PORT
SURVEILLANCE_TOKEN=$SURVEILLANCE_TOKEN
DATABASE_URL_API=$(role_url vulna_api)
BINARY_STORE_PATH=$KEYS/binary
OIDC_ISSUER=$UNREACHABLE_IDENTITY_PROVIDER
OIDC_CLIENT_ID=system-test
OIDC_CLIENT_SECRET=system-test
OIDC_REDIRECT_URI=http://$LOOPBACK:$API_PORT/api/v1/login/oidc/return
OIDC_ADMINISTRATION_REDIRECT_URI=http://$LOOPBACK:$API_PORT/api/admin/v1/login/oidc/callback
DEVICE_REGISTRATION_SECRET=system-test-device-registration
HPKE_KEYS_PATH=$KEYS/hpke
HPKE_CURRENT_KEY_VERSION=$KEY_VERSION
QR_SIGNING_KEYS_PATH=$KEYS/qr
QR_SIGNING_CURRENT_KEY_VERSION=$KEY_VERSION
EOF
	cat > "$WORK/worker.env" << EOF
PORT_WORKER_SURVEILLANCE=$WORKER_SURVEILLANCE_PORT
SURVEILLANCE_TOKEN=$SURVEILLANCE_TOKEN
DATABASE_URL_WORKER=$(role_url vulna_worker)
BINARY_STORE_PATH=$KEYS/binary
SYSLOG_TLS_CA_PATH=$KEYS/syslog/ca.crt
EOF
)
start_server "$API_CONTAINER" \
	-v "$PWD/$WORK/api.env:$KEYS/api.env:ro" \
	-v "$PWD/$WORK/hpke:$KEYS/hpke:ro" \
	-v "$PWD/$WORK/qr:$KEYS/qr:ro" \
	-v "$PWD/.data/clinical-record.env:$KEYS/clinical-record/api.env:ro" \
	-v "$PWD/.data/clinical-record-storage.env:$KEYS/clinical-record/storage.env:ro" \
	"$IMAGE" --env-file="$KEYS/api.env" --env-file="$KEYS/clinical-record/api.env" \
	--env-file="$KEYS/clinical-record/storage.env" apps/vulna-server-api/dist/main.js
start_server "$WORKER_CONTAINER" \
	-v "$PWD/$WORK/worker.env:$KEYS/worker.env:ro" \
	-v "$PWD/.data/clinical-record-worker.env:$KEYS/clinical-record-worker/worker.env:ro" \
	-v "$PWD/.data/clinical-record-retention.env:$KEYS/clinical-record-worker/retention.env:ro" \
	-v "$PWD/dev/syslog/certs/ca.crt:$KEYS/syslog/ca.crt:ro" \
	"$IMAGE" --env-file="$KEYS/worker.env" --env-file="$KEYS/clinical-record-worker/worker.env" \
	--env-file="$KEYS/clinical-record-worker/retention.env" apps/vulna-server-worker/dist/main.js
wait_until_ready "$API_CONTAINER" "$API_SURVEILLANCE_PORT"
wait_until_ready "$WORKER_CONTAINER" "$WORKER_SURVEILLANCE_PORT"

echo "== system tests"
SYSTEM_API_URL="http://$LOOPBACK:$API_PORT" \
SYSTEM_DATABASE_URL="$OWNER_URL" \
SYSTEM_ORTHANC_URL="$ORTHANC_URL" \
SYSTEM_ORTHANC_USER="$ORTHANC_USER" \
SYSTEM_ORTHANC_PASSWORD="$ORTHANC_PASSWORD" \
SYSTEM_CLINICAL_RECORD_URL="$CLINICAL_RECORD_URL" \
SYSTEM_SYSLOG_FILE="$PWD/$SYSLOG_FILE" \
SYSTEM_API_SURVEILLANCE_URL="http://$LOOPBACK:$API_SURVEILLANCE_PORT" \
SYSTEM_WORKER_SURVEILLANCE_URL="http://$LOOPBACK:$WORKER_SURVEILLANCE_PORT" \
SYSTEM_API_CONTAINER="$API_CONTAINER" \
SYSTEM_WORKER_CONTAINER="$WORKER_CONTAINER" \
	pnpm --filter @ansora/tools test:system
