#!/bin/sh
# ADR-021, NAB-465
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"
POSTGRES_HOST=${POSTGRES_HOST:-postgres}

as_postgres() {
	psql -h "$POSTGRES_HOST" -U postgres -d vulna -v ON_ERROR_STOP=1 "$@"
}

in_cluster() {
	psql -h "$POSTGRES_HOST" -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

case "${1:-}" in
roles)
	if [ "$(as_postgres -tAc "select 1 from pg_roles where rolname = 'vulna_migrate'")" != "1" ]; then
		as_postgres -f /init/roles.sql
	fi
	as_postgres -v migrate="$VULNA_MIGRATE_PASSWORD" -v api="$VULNA_API_PASSWORD" -v worker="$VULNA_WORKER_PASSWORD" <<'SQL'
ALTER ROLE vulna_migrate PASSWORD :'migrate';
ALTER ROLE vulna_api PASSWORD :'api';
ALTER ROLE vulna_worker PASSWORD :'worker';
SQL
	# ADR-021, provoz-a-dohled.md 7
	if [ "$(in_cluster -tAc "select 1 from pg_roles where rolname = 'clinical_record'")" != "1" ]; then
		in_cluster -f /init/clinical-record.sql
	fi
	in_cluster -v store="$CLINICAL_RECORD_PASSWORD" <<'SQL'
ALTER ROLE clinical_record PASSWORD :'store';
SQL
	as_postgres -f /init/clinical-record-separation.sql
	;;
seed)
	as_postgres -f /init/login-configuration.sql
	as_postgres -v clinical_record_url="$CLINICAL_RECORD_URL" -v instance_base_uri="$CLINICAL_RECORD_INSTANCE_BASE_URI" \
		-v storage_url="$CLINICAL_RECORD_STORAGE_URL" -f /init/clinical-record-configuration.sql
	# Q-148
	as_postgres -f /init/patient-identification-configuration.sql
	as_postgres -f /init/dicom-configuration.sql
	;;
*)
	echo "usage: db-init.sh roles|seed" >&2
	exit 2
	;;
esac
