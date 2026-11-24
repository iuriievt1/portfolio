-- CAP-012-R30, ADR-050 bod 2
SELECT set_config('vulna.clinical_record_url', :'clinical_record_url', false);
SELECT set_config('vulna.instance_base_uri', :'instance_base_uri', false);
SELECT set_config('vulna.storage_url', :'storage_url', false);
DO $$
DECLARE
	current_version integer;
	next_version integer;
	development_values jsonb := jsonb_build_object(
		'clinical_record_medplum.MEDPLUM_BASE_URL',
		current_setting('vulna.clinical_record_url'),
		'clinical_record_medplum.INSTANCE_BASE_URI',
		current_setting('vulna.instance_base_uri'),
		'clinical_record_medplum.STORAGE_URL',
		current_setting('vulna.storage_url')
	);
BEGIN
	SELECT max(id) INTO current_version FROM configuration_version;
	IF current_version IS NULL THEN
		RAISE EXCEPTION 'run the migration step first';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM jsonb_each(development_values) AS wanted
		WHERE NOT EXISTS (
			SELECT 1 FROM configuration
			WHERE version_id = current_version AND configuration.key = wanted.key AND configuration.value = wanted.value
		)
	) THEN
		RETURN;
	END IF;
	next_version := current_version + 1;
	INSERT INTO configuration_version (id, author_user_id, reason)
	VALUES (next_version, NULL, 'Vývoj: úložiště klinického záznamu na zpětné smyčce');
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM configuration
	WHERE version_id = current_version AND NOT development_values ? key;
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM jsonb_each(development_values);
END $$;
