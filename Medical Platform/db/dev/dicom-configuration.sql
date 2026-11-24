-- integrace-dicom.md 4, Q-045
DO $$
DECLARE
	current_version integer;
	next_version integer;
	development_values jsonb := '{
		"dicom.implementation_class_uid": "2.25.114121808482181632410403048131802259005"
	}';
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
	VALUES (next_version, NULL, 'Vývoj: Implementation Class UID pro sestavení DICOM');
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM configuration
	WHERE version_id = current_version AND NOT development_values ? key;
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM jsonb_each(development_values);
END $$;
