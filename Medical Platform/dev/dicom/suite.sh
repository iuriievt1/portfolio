#!/usr/bin/env bash
# ADR-017, Q-040, Q-041, integrace-dicom.md 11, 11.1
set -euo pipefail

# shellcheck source=dev/dicom/peers.sh
source "$(dirname "${BASH_SOURCE[0]}")/peers.sh"

readonly NODE_RUNNERS=(dicom-node-24 dicom-node-26)
readonly BUILDER_OBJECTS="$EVIDENCE/objects"

run_once() {
	compose run --rm --no-deps --user "$(id -u):$(id -g)" "$1"
}

case "${1:-}" in
	--keep | "") ;;
	*)
		echo "usage: $0 [--keep]" >&2
		exit 2
		;;
esac

rm -rf "$EVIDENCE"
mkdir -p "$EVIDENCE"
if [[ "${1:-}" != "--keep" ]]; then
	trap keep_logs_and_down EXIT
fi
start_peers
check_peers
succeeds "builder objects from the synthetic set" node tools/dist/dicom/objects/build.js "$BUILDER_OBJECTS"
succeeds "validator passes the builder objects and catches the negative samples" run_once dicom-validator
for runner in "${NODE_RUNNERS[@]}"; do
	succeeds "suite on $runner" run_once "$runner"
done
succeeds "only synthetic data in the peers" run_once dicom-synthetic-check
finish "DICOM suite passed, evidence in $EVIDENCE"
