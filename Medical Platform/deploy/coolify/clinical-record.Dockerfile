# konfigurace-a-profily.md 2.6
FROM medplum/medplum-server:5.2.18@sha256:5061141d2a0f30b3ae7486608d21d500f1b873d352fed1720004d5d6fa085954
COPY profiles/mou/clinical-record/medplum.config.json /etc/medplum/medplum.config.json
CMD ["file:/etc/medplum/medplum.config.json,env"]
