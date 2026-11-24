# syntax=docker/dockerfile:1

ARG BASE_IMAGE
ARG PNPM_VERSION=11.12.0

FROM ${BASE_IMAGE} AS base

# CAP-022-R01, CAP-022-R03, ADR-011 ř. 46, ADR-018, ADR-005
FROM debian:trixie-slim@sha256:f6b08b09a05725f9431502d3b5714f5c4576e82c1a84fa1debe0c24a7e0c3ec4 AS ocr
COPY deploy/images/ocr/variables.sh deploy/images/ocr/apt.sh deploy/images/ocr/sources.sha256 \
	deploy/images/ocr/models.sha256 deploy/images/ocr/sandbox.c deploy/images/ocr/build.sh /ocr/
RUN bash /ocr/build.sh
COPY --from=base /var/lib/dpkg/status.d /base-status
COPY deploy/images/ocr/collect.sh /ocr/
RUN bash /ocr/collect.sh /base-status /ocr-root

FROM node:24-trixie-slim@sha256:54f84b4cf8432b21aaffd5d3ce8d41e12cea0d10d33c09d2f3c9879d49d6b446 AS deps
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

FROM deps AS build
ENV NX_DAEMON=false NX_NO_CLOUD=true CI=1
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm profile:build
RUN pnpm exec nx run-many -t build --projects=@ansora/server-api,@ansora/server-worker,@ansora/server-migrate,@ansora/admin
RUN find apps libs profiles tools -name package.json -not -path '*/node_modules/*' -exec install -D {} /manifests/{} \; \
	&& find vendor -mindepth 2 -maxdepth 2 -name package.json -exec install -D {} /manifests/{} \;

FROM deps AS server
ENV CI=1
COPY package.json ./
COPY --from=build /manifests ./
RUN pnpm install --frozen-lockfile --offline --prod --config.node-linker=isolated \
		--filter "@ansora/server-api..." \
		--filter "@ansora/server-worker..." \
		--filter "@ansora/server-migrate..." \
	&& rm -rf tools profiles
COPY --from=build /app/apps/vulna-server-api/dist apps/vulna-server-api/dist
COPY --from=build /app/apps/vulna-server-worker/dist apps/vulna-server-worker/dist
COPY --from=build /app/apps/vulna-server-migrate/dist apps/vulna-server-migrate/dist
COPY --from=build /app/apps/vulna-admin/dist apps/vulna-admin/dist
COPY --from=build /app/libs/contracts/dist libs/contracts/dist
COPY --from=build /app/libs/core/server/dist libs/core/server/dist
COPY --from=build /app/libs/modules/vulna/domain/dist libs/modules/vulna/domain/dist
COPY --from=build /app/libs/modules/vulna/projection-dicom/dist libs/modules/vulna/projection-dicom/dist
COPY --from=build /app/libs/modules/vulna/adapter-binary-local/dist libs/modules/vulna/adapter-binary-local/dist
COPY --from=build /app/libs/modules/vulna/adapter-oidc/dist libs/modules/vulna/adapter-oidc/dist
COPY --from=build /app/libs/modules/vulna/adapter-syslog/dist libs/modules/vulna/adapter-syslog/dist
COPY --from=build /app/libs/modules/vulna/adapter-registry-local/dist libs/modules/vulna/adapter-registry-local/dist
COPY --from=build /app/libs/modules/vulna/adapter-dicom-dimse/dist libs/modules/vulna/adapter-dicom-dimse/dist
COPY --from=build /app/libs/modules/vulna/adapter-clinical-record-medplum/dist libs/modules/vulna/adapter-clinical-record-medplum/dist
# ADR-017, ADR-003 ř. 26, ADR-005 ř. 38–39
COPY --from=build /app/vendor/dcmjs/src vendor/dcmjs/src
COPY --from=build /app/vendor/dcmjs/License.txt vendor/dcmjs/License.txt
COPY --from=build /app/vendor/dcmjs-dimse/src vendor/dcmjs-dimse/src
COPY --from=build /app/vendor/dcmjs-dimse/LICENSE.txt vendor/dcmjs-dimse/LICENSE.txt
# ADR-041 bod a, CAP-028-S08, vendor/postgres/PEDIGREE.md
COPY --from=build /app/vendor/postgres/cjs/src vendor/postgres/cjs/src
COPY --from=build /app/vendor/postgres/cjs/package.json vendor/postgres/cjs/package.json
COPY --from=build /app/vendor/postgres/UNLICENSE vendor/postgres/UNLICENSE
COPY --from=build /app/dist/profile dist/profile
COPY db/migrations db/migrations
RUN find apps libs -name package.json -not -path '*/node_modules/*' \
	-exec sh -c 'test -d "$(dirname "$1")/dist" || rm -rf "$(dirname "$1")"' _ {} \;
RUN find apps libs -type d -empty -delete

FROM base AS runtime
COPY --from=ocr /ocr-root/ /
# ADR-018, ADR-011 ř. 46
RUN ["/usr/local/bin/tesseract", "--tessdata-dir", "/usr/share/tesseract-ocr/5/tessdata", "--list-langs"]
# datovy-model.md 13.3
ARG SERVER_VERSION=unversioned
WORKDIR /app
ENV NODE_ENV=production
ENV SERVER_VERSION=${SERVER_VERSION}
COPY --from=server /app ./
CMD ["apps/vulna-server-api/dist/main.js"]

# CAP-012-R30
FROM runtime AS stand-api
CMD ["--env-file-if-exists=/keys/clinical-record/api.env", "apps/vulna-server-api/dist/main.js"]

# CAP-012-R30, CAP-026-R19
FROM runtime AS stand-worker
CMD ["--env-file-if-exists=/keys/clinical-record-worker/worker.env", "--env-file-if-exists=/keys/clinical-record-worker/retention.env", "apps/vulna-server-worker/dist/main.js"]

# ADR-021, Q-040
FROM build AS stand-init
RUN bash -c 'source deploy/images/ocr/apt.sh \
	&& echo "Acquire::Retries \"0\";" >/etc/apt/apt.conf.d/80-retries \
	&& apt_get_until_fetched update \
	&& apt_get_until_fetched install -y --download-only --no-install-recommends postgresql-client \
	&& apt-get install -y --no-install-recommends postgresql-client \
	&& rm -rf /var/lib/apt/lists/*'
RUN install -D -m 0644 -t /init db/roles/roles.sql db/roles/clinical-record.sql db/roles/clinical-record-separation.sql \
	db/dev/login-configuration.sql db/dev/clinical-record-configuration.sql db/dev/patient-identification-configuration.sql \
	db/dev/dicom-configuration.sql deploy/coolify/db-init.sh
CMD ["bash", "deploy/coolify/stand-init.sh"]

FROM runtime AS release
