-- ADR-024, Q-040, dev/system/run.sh
SELECT set_config('vulna.pacs_host', :'pacs_host', false);
SELECT set_config('vulna.pacs_port', :'pacs_port', false);
SELECT set_config('vulna.pacs_ae_title', :'pacs_ae_title', false);
SELECT set_config('vulna.pacs_calling_ae_title', :'pacs_calling_ae_title', false);
SELECT set_config('vulna.syslog_host', :'syslog_host', false);
SELECT set_config('vulna.syslog_port', :'syslog_port', false);
DO $$
DECLARE
	current_version integer;
	next_version integer;
	system_values jsonb := jsonb_build_object(
		'dicom_dimse.PACS_HOST', current_setting('vulna.pacs_host'),
		'dicom_dimse.PACS_PORT', current_setting('vulna.pacs_port')::integer,
		'dicom_dimse.PACS_AE_TITLE', current_setting('vulna.pacs_ae_title'),
		'dicom_dimse.PACS_CALLING_AE_TITLE', current_setting('vulna.pacs_calling_ae_title'),
		'syslog.SYSLOG_HOST', current_setting('vulna.syslog_host'),
		'syslog.SYSLOG_PORT', current_setting('vulna.syslog_port')::integer
	);
BEGIN
	SELECT max(id) INTO current_version FROM configuration_version;
	IF current_version IS NULL THEN
		RAISE EXCEPTION 'run the migration step first';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM jsonb_each(system_values) AS wanted
		WHERE NOT EXISTS (
			SELECT 1 FROM configuration
			WHERE version_id = current_version AND configuration.key = wanted.key AND configuration.value = wanted.value
		)
	) THEN
		RETURN;
	END IF;
	next_version := current_version + 1;
	INSERT INTO configuration_version (id, author_user_id, reason)
	VALUES (next_version, NULL, 'Systémové testy: syntetický PACS a Syslog');
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM configuration
	WHERE version_id = current_version AND NOT system_values ? key;
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM jsonb_each(system_values);
END $$;
