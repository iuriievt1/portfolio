# konfigurace-a-profily.md 2.1, Q-015
FROM orthancteam/orthanc:26.9.0@sha256:1ca07ad4a70f67f815e55a558e76718d572ed9d0571268a3fbc1516a9155c5ca
COPY deploy/coolify/pacs.json /etc/orthanc/orthanc.json
