# ADR-017, architektura.md 11, integrace-dicom.md 11.1
FROM debian:trixie-slim@sha256:f6b08b09a05725f9431502d3b5714f5c4576e82c1a84fa1debe0c24a7e0c3ec4

ARG DCMTK_VERSION=3.6.9-5+deb13u3
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

# Debian #1111554
RUN attempt=1 \
	&& until timeout "${APT_ATTEMPT_SECONDS}" apt-get -o APT::Update::Error-Mode=any update \
		&& timeout "${APT_ATTEMPT_SECONDS}" apt-get install -y --download-only --no-install-recommends \
			"dcmtk=${DCMTK_VERSION}"; do \
		[ "${attempt}" -lt "${APT_ATTEMPTS}" ] || exit 1; \
		sleep $((attempt * APT_PAUSE_SECONDS)); \
		attempt=$((attempt + 1)); \
	done \
	&& apt-get install -y --no-install-recommends "dcmtk=${DCMTK_VERSION}" \
	&& rm -rf /var/lib/apt/lists/* \
	&& useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin dicom \
	&& mkdir -p /var/lib/storescp /var/lib/dcmqrscp/DCMQRSCP \
	&& chown -R dicom:dicom /var/lib/storescp /var/lib/dcmqrscp

COPY dcmqrscp.cfg /etc/dcmqrscp.cfg

USER dicom
