#!/usr/bin/env bash
# ADR-017, ADR-024, architektura.md 11, integrace-dicom.md 11.1
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

readonly SERVICES=(dicom-data dicom-client dcmtk-store dcmtk-qr dcmtk-mwl amis hostile dcm4chee-ldap dcm4chee-db dcm4chee)
readonly DATA_VOLUME=ansora-vulna-dicom-data
readonly NETWORK=ansora-vulna-dicom
readonly WAIT_TIMEOUT_SECONDS=900
readonly PORT=11112
readonly CALLING=VULNA
readonly SMOKE=/data/smoke
readonly JPEG=/tmp/photograph-jpeg.dcm
readonly UID_VALUE='^[0-9]+(\.[0-9]+)+$'
readonly EVIDENCE=dist/dicom-evidence

compose() {
	docker compose --profile dicom "$@"
}

down() {
	set +e
	compose rm --stop --force --volumes "${SERVICES[@]}"
	local leftovers
	leftovers=$( (docker ps --all --quiet --filter "network=$NETWORK"; docker ps --all --quiet --filter "volume=$DATA_VOLUME") | sort -u)
	if [[ -n "$leftovers" ]]; then
		# shellcheck disable=SC2086
		docker rm --force --volumes $leftovers >/dev/null
	fi
	docker volume rm --force "$DATA_VOLUME" >/dev/null
	if docker network inspect "$NETWORK" >/dev/null 2>&1; then
		docker network rm "$NETWORK" >/dev/null
	fi
	set -e
}

keep_logs_and_down() {
	local status=$?
	if [[ $status -ne 0 || $failures -gt 0 ]]; then
		mkdir -p "$EVIDENCE"
		compose logs --no-color --timestamps >"$EVIDENCE/peers.log" 2>&1 || true
	fi
	down
}

client() {
	compose exec -T dicom-client "$@"
}

failures=0

pass() {
	echo "OK    $1"
}

fail() {
	echo "FAIL  $1"
	echo "$2" | tail -n 25 | sed 's/^/      /'
	failures=$((failures + 1))
}

succeeds() {
	local description=$1 output
	shift
	if output=$("$@" 2>&1); then
		pass "$description"
	else
		fail "$description" "$output"
	fi
}

expect() {
	local description=$1 pattern=$2 output
	shift 2
	output=$("$@" 2>&1) || true
	if grep -Eq "$pattern" <<<"$output"; then
		pass "$description"
	else
		fail "$description" "$output"
	fi
}

expect_matches() {
	local description=$1 minimum=$2 output count
	shift 2
	output=$("$@" 2>&1) || true
	count=$(grep -c "Find Response:.*(Pending)" <<<"$output" || true)
	if [[ $count -ge $minimum ]] && grep -Eq "Final Find Response \(Success\)" <<<"$output"; then
		pass "$description ($count)"
	else
		fail "$description (pending: $count)" "$output"
	fi
}

echo_ok() {
	expect "C-ECHO $1@$2" "Received Echo Response \(Success\)" client echoscu -v -aet "$CALLING" -aec "$1" "$2" "$PORT"
}

store_ok() {
	expect "C-STORE JPEG Baseline photograph -> $1@$2" "Received Store Response \(Success\)" \
		client storescu -v --propose-jpeg8 -aet "$CALLING" -aec "$1" "$2" "$PORT" "$JPEG"
	expect "C-STORE Encapsulated PDF -> $1@$2" "Received Store Response \(Success\)" \
		client storescu -v -aet "$CALLING" -aec "$1" "$2" "$PORT" "$SMOKE/document.dcm"
}

study_find() {
	expect_matches "C-FIND STUDY $1@$2" 1 client findscu -v -S -aet "$CALLING" -aec "$1" "$2" "$PORT" \
		-k QueryRetrieveLevel=STUDY -k "PatientID=$3" -k StudyInstanceUID -k PatientName
}

worklist_find() {
	expect_matches "C-FIND MWL $1@$2" 1 client findscu -v -W -aet "$CALLING" -aec "$1" "$2" "$PORT" \
		-k PatientName -k PatientID -k AccessionNumber \
		-k "ScheduledProcedureStepSequence[0].Modality=XC" \
		-k "ScheduledProcedureStepSequence[0].ScheduledProcedureStepDescription"
}

check_peers() {
	echo_ok STORESCP dcmtk-store
	echo_ok DCMQRSCP dcmtk-qr
	echo_ok WLMSCPFS dcmtk-mwl
	echo_ok AMIS amis
	echo_ok DCM4CHEE dcm4chee
	echo_ok BASELINE hostile

	succeeds "JPEG Baseline from the synthetic photograph" client dcmcjpeg +eb "$SMOKE/photograph.dcm" "$JPEG"
	store_ok STORESCP dcmtk-store
	store_ok AMIS amis
	store_ok DCM4CHEE dcm4chee

	local study patient
	study=$(client dcmdump +P StudyInstanceUID "$SMOKE/document.dcm" | sed -E 's/.*\[([^]]*)\].*/\1/')
	patient=$(client dcmdump +P PatientID "$SMOKE/document.dcm" | sed -E 's/.*\[([^]]*)\].*/\1/')
	if [[ ! $study =~ $UID_VALUE || -z $patient ]]; then
		fail "Study Instance UID and Patient ID of the smoke document" "study '$study', patient '$patient'"
		return
	fi
	study_find DCMQRSCP dcmtk-qr "$patient"
	study_find AMIS amis "$patient"
	expect_matches "C-FIND stored study DCM4CHEE@dcm4chee" 1 client findscu -v -S -aet "$CALLING" -aec DCM4CHEE \
		dcm4chee "$PORT" -k QueryRetrieveLevel=STUDY -k "StudyInstanceUID=$study"
	worklist_find WLMSCPFS dcmtk-mwl
	worklist_find AMIS amis

	# integrace-dicom.md 1, 8.1, 8.3, TS-145
	expect "AMIS rejects an unregistered calling AE title" "Calling AE Title Not Recognized" \
		client echoscu -v -aet UNREGISTERED -aec AMIS amis "$PORT"
	expect "AMIS rejects an unknown called AE title" "Called AE Title Not Recognized" \
		client echoscu -v -aet "$CALLING" -aec UNKNOWN amis "$PORT"
	expect "AMIS refuses storage to a peer without the storage role" "DIMSE Status +: 0xa706" \
		client storescu -d -aet VULNA-QUERY -aec AMIS amis "$PORT" "$SMOKE/document.dcm"
	expect "AMIS answers the injected status A700" "DIMSE Status +: 0xa700" \
		client storescu -d -aet "$CALLING" -aec STORE-A700 amis "$PORT" "$SMOKE/document.dcm"
	# ADR-017, integrace-dicom.md 11
	expect "hostile SCP sends an undefined PDU type" "Unrecognized PDU type" \
		client echoscu -v -aet "$CALLING" -aec PDU-UNKNOWN-TYPE hostile "$PORT"
}

start_peers() {
	pnpm --filter @ansora/tools build
	compose up --build --detach --wait --wait-timeout "$WAIT_TIMEOUT_SECONDS" "${SERVICES[@]}"
}

finish() {
	if [[ $failures -gt 0 ]]; then
		echo "$failures check(s) failed"
		exit 1
	fi
	echo "$1"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	case "${1:-}" in
		--down)
			down
			exit 0
			;;
		--keep | "") ;;
		*)
			echo "usage: $0 [--keep | --down]" >&2
			exit 2
			;;
	esac
	if [[ "${1:-}" != "--keep" ]]; then
		trap keep_logs_and_down EXIT
	fi
	start_peers
	check_peers
	finish "all DICOM peers answer"
fi
