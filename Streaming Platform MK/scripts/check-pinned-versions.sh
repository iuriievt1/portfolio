#!/usr/bin/env bash
# Checks that all dependency versions in workspace package.json files are pinned (no ^, ~, >=, >, <, * ranges).
# Allows: workspace:*, npm: aliases, exact versions, peerDependencies (intentionally loose).
# Exit 1 if unpinned versions found.

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXIT_CODE=0

check_file() {
	local file="$1"
	local rel_path="${file#"$WORKSPACE_ROOT"/}"

	# Check dependencies, devDependencies, and pnpm.overrides — skip peerDependencies
	local unpinned
	unpinned=$(node -e "
		const pkg = require('./${rel_path}');
		const sections = ['dependencies', 'devDependencies'];
		const errors = [];

		for (const section of sections) {
			const deps = pkg[section] || {};
			for (const [name, version] of Object.entries(deps)) {
				// Allow workspace protocol and npm aliases
				if (version.startsWith('workspace:') || version.startsWith('npm:')) continue;
				// Flag any range prefix
				if (/^[\^~><=*]/.test(version) || version === 'latest') {
					errors.push('  ' + section + ' → ' + name + ': ' + version);
				}
			}
		}

		// Also check pnpm.overrides if present
		const overrides = (pkg.pnpm && pkg.pnpm.overrides) || {};
		for (const [name, version] of Object.entries(overrides)) {
			if (version.startsWith('workspace:') || version.startsWith('npm:')) continue;
			if (/^[\^~><=*]/.test(version) || version === 'latest') {
				errors.push('  pnpm.overrides → ' + name + ': ' + version);
			}
		}

		if (errors.length) process.stdout.write(errors.join('\n'));
	" 2>/dev/null || true)

	if [[ -n "$unpinned" ]]; then
		echo "FAIL $rel_path"
		echo "$unpinned"
		echo ""
		EXIT_CODE=1
	fi
}

cd "$WORKSPACE_ROOT"

# Root package.json
check_file "$WORKSPACE_ROOT/package.json"

# All workspace package.json files (apps + packages)
for dir in apps/*/package.json packages/*/package.json; do
	[[ -f "$dir" ]] && check_file "$WORKSPACE_ROOT/$dir"
done

if [[ $EXIT_CODE -eq 0 ]]; then
	echo "All dependency versions are pinned."
else
	echo "Found unpinned dependency versions. Pin them to exact versions (remove ^, ~, >=, etc)."
fi

exit $EXIT_CODE
