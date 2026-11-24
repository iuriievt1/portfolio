FROM postgres:18-alpine
COPY db/roles/roles.sql /init/roles.sql
COPY db/roles/clinical-record.sql /init/clinical-record.sql
COPY db/roles/clinical-record-separation.sql /init/clinical-record-separation.sql
COPY db/dev/login-configuration.sql /init/login-configuration.sql
COPY db/dev/clinical-record-configuration.sql /init/clinical-record-configuration.sql
COPY db/dev/patient-identification-configuration.sql /init/patient-identification-configuration.sql
COPY db/dev/dicom-configuration.sql /init/dicom-configuration.sql
COPY deploy/coolify/db-init.sh /init/db-init.sh
ENTRYPOINT ["sh", "/init/db-init.sh"]
