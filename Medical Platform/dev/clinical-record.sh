#!/usr/bin/env bash
# local dev only
set -euo pipefail
cd "$(dirname "$0")/.."

STORE_URL=http://127.0.0.1:8103/
VULNA_DATABASE=${VULNA_DATABASE:-vulna}
STORE_WAIT_SECONDS=180
# ADR-053 (doplnění 2026-09-24) bod 1, emulator address of dev/tls
STORAGE_URL=${CLINICAL_RECORD_STORAGE_URL:-https://10.0.2.2:8443/storage/}
STORAGE_SIGNING_FILE=.data/clinical-record-storage.env

psql() {
	docker compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

if [ "$(psql -d postgres -tAc "select 1 from pg_roles where rolname = 'clinical_record'")" != "1" ]; then
	psql -d postgres -f - < db/roles/clinical-record.sql
fi
psql -d postgres -qc "alter role clinical_record password 'clinical_record'"
psql -d "$VULNA_DATABASE" -f - < db/roles/clinical-record-separation.sql
psql -d "$VULNA_DATABASE" -v clinical_record_url="$STORE_URL" -v instance_base_uri=https://vulna-dev.invalid/fhir \
	-v storage_url="$STORAGE_URL" -f - < db/dev/clinical-record-configuration.sql

# ADR-053 (doplnění 2026-09-24) bod 1
mkdir -p .data
if [ ! -f "$STORAGE_SIGNING_FILE" ]; then
	passphrase=$(openssl rand -hex 32)
	key=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -aes-256-cbc -pass "pass:$passphrase")
	(
		umask 077
		printf 'MEDPLUM_SIGNING_KEY_ID=vulna-dev\nMEDPLUM_SIGNING_KEY="%s"\nMEDPLUM_SIGNING_KEY_PASSPHRASE=%s\n' \
			"$key" "$passphrase" > "$STORAGE_SIGNING_FILE"
		printf 'CLINICAL_RECORD_STORAGE_SIGNING_KEY="%s"\nCLINICAL_RECORD_STORAGE_SIGNING_KEY_PASSPHRASE=%s\n' \
			"$key" "$passphrase" >> "$STORAGE_SIGNING_FILE"
	)
fi

docker compose --profile clinical-record up -d --build --wait clinical-record-cache clinical-record

# first start seeds
for _ in $(seq "$STORE_WAIT_SECONDS"); do
	curl -sf "${STORE_URL}healthcheck" > /dev/null && break
	sleep 1
done
curl -sf "${STORE_URL}healthcheck" > /dev/null

# values from docker-compose.yml
CLINICAL_RECORD_URL="$STORE_URL" \
CLINICAL_RECORD_BREAK_GLASS_EMAIL=break-glass@vulna.invalid \
CLINICAL_RECORD_BREAK_GLASS_PASSWORD=vulna-dev-break-glass-not-for-production \
CLINICAL_RECORD_ADMIN_NETWORKS="::ffff:172.,::ffff:192.168." \
INSTANCE_CODE=vulna-dev \
INSTANCE_NAME="Vývojová instance" \
	pnpm --filter @ansora/tools clinical-record:install \
	--operator "$(git config user.name)" --reason "local development" \
	--rotate-api-secret --credential-file "$PWD/.data/clinical-record.env" \
	--rotate-worker-secret --worker-credential-file "$PWD/.data/clinical-record-worker.env" \
	--rotate-retention-secret --retention-credential-file "$PWD/.data/clinical-record-retention.env"
