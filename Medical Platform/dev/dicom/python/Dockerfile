# ADR-017, architektura.md 11, integrace-dicom.md 11.1
FROM python:3.13-slim-trixie@sha256:ae14d4ce8771606477a81446e7ef429edd6762305fc50c84507c1041fa8285d1

ARG TARGETARCH
ARG DICOM3TOOLS_VERSION_AMD64=1.00~20240118131615-1
ARG DICOM3TOOLS_VERSION_ARM64=1.00~20240118131615-1+b1
ARG DEBIAN_SNAPSHOT=20261103T000000Z
ARG DEBIAN_MIRROR=deb.debian.org
ARG APT_ATTEMPTS=5
ARG APT_ATTEMPT_SECONDS=300
ARG APT_PAUSE_SECONDS=30

RUN printf '%s\n' \
		'Types: deb' \
		"URIs: http://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}" \
		'Suites: trixie trixie-updates' \
		'Components: main' \
		'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
		'Check-Valid-Until: no' \
		'' \
		'Types: deb' \
		"URIs: http://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT}" \
		'Suites: trixie-security' \
		'Components: main' \
		'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
		'Check-Valid-Until: no' \
		'' \
		'Types: deb' \
		"URIs: http://${DEBIAN_MIRROR}/debian" \
		'Suites: trixie trixie-updates' \
		'Components: main' \
		'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
		'' \
		'Types: deb' \
		"URIs: http://${DEBIAN_MIRROR}/debian-security" \
		'Suites: trixie-security' \
		'Components: main' \
		'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
		>/etc/apt/sources.list.d/debian.sources \
	&& printf '%s\n' \
		'Package: *' \
		"Pin: origin \"${DEBIAN_MIRROR}\"" \
		'Pin-Priority: -1' \
		>/etc/apt/preferences.d/80-mirror \
	&& echo 'Acquire::Retries "0";' >/etc/apt/apt.conf.d/80-retries

COPY requirements.txt /app/requirements.txt
# Debian #1111554
RUN case "${TARGETARCH}" in \
		amd64) dicom3tools_version="${DICOM3TOOLS_VERSION_AMD64}" ;; \
		arm64) dicom3tools_version="${DICOM3TOOLS_VERSION_ARM64}" ;; \
		*) echo "unsupported architecture ${TARGETARCH}" >&2; exit 1 ;; \
	esac \
	&& attempt=1 \
	&& until timeout "${APT_ATTEMPT_SECONDS}" apt-get -o APT::Update::Error-Mode=any update \
		&& timeout "${APT_ATTEMPT_SECONDS}" apt-get install -y --download-only --no-install-recommends \
			"dicom3tools=${dicom3tools_version}"; do \
		[ "${attempt}" -lt "${APT_ATTEMPTS}" ] || exit 1; \
		sleep $((attempt * APT_PAUSE_SECONDS)); \
		attempt=$((attempt + 1)); \
	done \
	&& apt-get install -y --no-install-recommends "dicom3tools=${dicom3tools_version}" \
	&& rm -rf /var/lib/apt/lists/* \
	&& pip install --no-cache-dir --no-deps --only-binary=:all: --require-hashes -r /app/requirements.txt \
	&& useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin dicom \
	&& mkdir -p /data /var/lib/amis \
	&& chown dicom:dicom /data /var/lib/amis

COPY dicom_synthetic.py /tmp/dicom_synthetic.py
RUN install -m 0644 /tmp/dicom_synthetic.py \
		"$(python -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')/dicom_synthetic.py" \
	&& rm /tmp/dicom_synthetic.py
COPY amis_emulator.py amis_healthcheck.py object_validation.py synthetic_check.py synthetic_data.py /app/

USER dicom
ENTRYPOINT ["python", "-I", "-u"]
