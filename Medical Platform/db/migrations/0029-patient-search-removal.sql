-- CHG-176, CAP-013-R07, datovy-model.md 7
DROP INDEX patient_cache_birth_date_idx;
ALTER TABLE patient_cache DROP COLUMN search_text;
