# Debian #1111554, ADR-011 ř. 46, NAB-468
readonly APT_ATTEMPTS=5
readonly APT_ATTEMPT_SECONDS=300
readonly APT_PAUSE_SECONDS=30

apt_get_until_fetched() {
	local attempt
	for ((attempt = 1; attempt <= APT_ATTEMPTS; attempt++)); do
		if timeout "$APT_ATTEMPT_SECONDS" apt-get -o APT::Update::Error-Mode=any "$@"; then
			return 0
		fi
		if ((attempt < APT_ATTEMPTS)); then
			echo "apt-get $1: attempt $attempt of $APT_ATTEMPTS failed, next one in $((attempt * APT_PAUSE_SECONDS)) s" >&2
			sleep $((attempt * APT_PAUSE_SECONDS))
		fi
	done
	echo "apt-get $1 failed $APT_ATTEMPTS times" >&2
	return 1
}
