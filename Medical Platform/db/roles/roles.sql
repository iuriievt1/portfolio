-- passwords at install, NAB-465
CREATE ROLE vulna_migrate LOGIN;
CREATE ROLE vulna_api     LOGIN;
CREATE ROLE vulna_worker  LOGIN;

-- DDL only here, ADR-021
GRANT ALL ON SCHEMA public TO vulna_migrate;
REVOKE CREATE ON SCHEMA public FROM vulna_api, vulna_worker;
GRANT USAGE ON SCHEMA public TO vulna_api, vulna_worker;

-- audit narrowed in 0001
ALTER DEFAULT PRIVILEGES FOR ROLE vulna_migrate IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vulna_api, vulna_worker;
