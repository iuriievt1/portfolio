-- ADR-021, CAP-017-R05, CAP-017-R08, CAP-017-R09, CAP-017-R18
REVOKE ALL ON TABLE code_list, code_list_item, code_list_item_name, code_list_set FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT ON TABLE code_list TO vulna_api;
GRANT SELECT, INSERT, UPDATE ON TABLE code_list_item TO vulna_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE code_list_item_name TO vulna_api;
GRANT SELECT, INSERT ON TABLE code_list_set TO vulna_api;

-- CAP-017-R09, CAP-016-R07, CAP-016-R18
ALTER TABLE code_list_set
	-- rollback, ADR-021
	ADD COLUMN body_diagram_digest text NOT NULL DEFAULT ''
	CHECK (body_diagram_digest = '' OR body_diagram_digest ~ '^[0-9a-f]{64}$');

-- CAP-021-R29, CAP-021-S23, CAP-021-S24
ALTER TABLE acquisition_update_request ADD COLUMN response jsonb;
