-- ADR-021, B19
DO $$
BEGIN
	EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
	EXECUTE format('GRANT CONNECT ON DATABASE %I TO vulna_migrate, vulna_api, vulna_worker', current_database());
END $$;
