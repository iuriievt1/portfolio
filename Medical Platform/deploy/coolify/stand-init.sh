#!/usr/bin/env bash
# ADR-021, ADR-011, CAP-012-R30, CAP-021-R36, Q-040, Q-148
set -euo pipefail

readonly SERVER_OWNER=65532:65532
readonly CLINICAL_RECORD_OWNER=1000:1000
readonly BINARY_STORE=/var/lib/vulna/binary
readonly CLINICAL_RECORD_BINARY=/var/lib/medplum/binary
readonly API_CREDENTIALS=/keys/clinical-record/api.env
readonly WORKER_CREDENTIALS=/keys/clinical-record-worker/worker.env
readonly RETENTION_CREDENTIALS=/keys/clinical-record-worker/retention.env
readonly CLINICAL_RECORD_WAIT_SECONDS=600
readonly CLINICAL_RECORD_POLL_SECONDS=5

step() {
	echo "stand-init: $1"
}

clinical_record_is_healthy() {
	node -e "fetch(new URL('healthcheck', process.argv[1])).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" \
		"$CLINICAL_RECORD_URL"
}

wait_for_clinical_record() {
	local waited=0
	until clinical_record_is_healthy; do
		if ((waited >= CLINICAL_RECORD_WAIT_SECONDS)); then
			echo "stand-init: the clinical record at $CLINICAL_RECORD_URL is not healthy after $waited s" >&2
			return 1
		fi
		sleep "$CLINICAL_RECORD_POLL_SECONDS"
		waited=$((waited + CLINICAL_RECORD_POLL_SECONDS))
	done
}

step "database roles"
sh /init/db-init.sh roles

step "owners of the shared directories"
chown "$SERVER_OWNER" "$BINARY_STORE"
chown "$CLINICAL_RECORD_OWNER" "$CLINICAL_RECORD_BINARY"

step "migrations"
node apps/vulna-server-migrate/dist/main.js

step "configuration seed"
sh /init/db-init.sh seed

step "waiting for the clinical record"
wait_for_clinical_record

step "clinical record installation"
pnpm --filter @ansora/tools clinical-record:install --operator coolify --reason deployment \
	--credential-file "$API_CREDENTIALS" --worker-credential-file "$WORKER_CREDENTIALS" \
	--retention-credential-file "$RETENTION_CREDENTIALS" --credential-owner "$SERVER_OWNER"

step "stand data"
setpriv --reuid=65532 --regid=65532 --clear-groups env HOME=/tmp bash -c '
	set -euo pipefail
	pnpm --filter @ansora/tools registry:seed
	if [ "${DEMO_SEED:-1}" = "1" ]; then
		set -a
		. "$0"
		set +a
		pnpm --filter @ansora/server-api seed:demo
	fi
' "$API_CREDENTIALS"

step "done"
exec sleep infinity
