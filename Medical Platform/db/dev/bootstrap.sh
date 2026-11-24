#!/usr/bin/env bash
# local dev only
set -euo pipefail
cd "$(dirname "$0")/../.."

psql() {
	docker compose exec -T postgres psql -U postgres -d vulna -v ON_ERROR_STOP=1 "$@"
}

docker compose up -d --wait

if [ "$(psql -tAc "select 1 from pg_roles where rolname = 'vulna_migrate'")" != "1" ]; then
	psql -f - < db/roles/roles.sql
fi

# dev passwords
for role in vulna_migrate vulna_api vulna_worker; do
	psql -qc "alter role $role password 'vulna'"
done

set -a
. ./.env
set +a
pnpm migrate

psql -f - < db/dev/login-configuration.sql
psql -f - < db/dev/patient-identification-configuration.sql
psql -f - < db/dev/dicom-configuration.sql
