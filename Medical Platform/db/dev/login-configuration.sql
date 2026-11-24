DO $$
DECLARE
	current_version integer;
	next_version integer;
	development_values jsonb := '{
		"login_methods.card": false,
		"identity_provider.personal_number_claim": "personal_number",
		"identity_provider.login_name_claim": "preferred_username",
		"identity_provider.email_claim": "email",
		"identity_provider.group_claim": "groups",
		"identity_provider.authorized_group": "vulna-users",
		"role_mapping.group_to_role": [
			{"group": "vulna-clinicians", "role": "clinician"},
			{"group": "vulna-administrators", "role": "administrator"}
		],
		"pin_policy.complexity": "standard"
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
	VALUES (next_version, NULL, 'Vývojový identitní poskytovatel: nároky a mapování skupin');
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM configuration
	WHERE version_id = current_version AND NOT development_values ? key;
	INSERT INTO configuration (version_id, key, value)
	SELECT next_version, key, value FROM jsonb_each(development_values);
END $$;
