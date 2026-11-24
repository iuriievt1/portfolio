# syntax=docker/dockerfile:1
# CAP-029-R30, CAP-029-S20, ADR-042 bod 7
FROM valkey/valkey@sha256:bf09d58e96d6b4524a15396b65b242bbe18beebbcc15a04d8ee75ddac62fae0b AS source

FROM gcr.io/distroless/static-debian13@sha256:448810357cc8e67b7208988abdba0f5ec3d3aebee0a5b13eb624979792cffc0f
COPY --from=source /usr/local/bin/valkey-server /usr/local/bin/valkey-server
COPY --from=source /lib/ld-musl-*.so.1 /lib/
COPY --from=source /usr/lib/libssl.so.3 /usr/lib/libcrypto.so.3 /usr/lib/
USER nonroot
EXPOSE 6379
ENTRYPOINT ["/usr/local/bin/valkey-server"]
# konfigurace-a-profily.md 2.1, Q-113
CMD ["--save", "", "--appendonly", "no"]
