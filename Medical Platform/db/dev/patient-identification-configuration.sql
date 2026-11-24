-- Mock, remove later, Q-148
DO $$
DECLARE
	current_version integer;
	next_version integer;
	development_values jsonb := '{
		"patient_identification.code_system": "urn:vulna:synthetic:patient-id",
		"patient_identification.nfc_source": "ndef_text",
		"patient_identification.nfc_system": "urn:vulna:synthetic:patient-id"
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
	VALUES (next_version, NULL, 'Vývoj: identifikace syntetických pacientů kódem a NFC tagem');
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM configuration
	WHERE version_id = current_version AND NOT development_values ? key;
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM jsonb_each(development_values);
END $$;
