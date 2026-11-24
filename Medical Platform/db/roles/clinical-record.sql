-- ADR-021, provoz-a-dohled.md 7, NAB-465
CREATE ROLE clinical_record LOGIN;
CREATE DATABASE clinical_record OWNER clinical_record;
REVOKE ALL ON DATABASE clinical_record FROM PUBLIC;
