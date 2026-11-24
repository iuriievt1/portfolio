-- CAP-021-R39, CAP-021-R28, ADR-050 (doplnění D33) bod 3, CAP-015-R17, CAP-014-R25
GRANT DELETE ON TABLE series TO vulna_api;

-- ADR-050 (doplnění D33) bod 3, CAP-014-R25
ALTER TABLE document_page
	DROP CONSTRAINT document_page_document_id_fkey,
	ADD CONSTRAINT document_page_document_id_fkey
		FOREIGN KEY (document_id) REFERENCES document (id) ON DELETE CASCADE ON UPDATE CASCADE;
