-- CAP-021-R39, ADR-050 (doplnění D33)
INSERT INTO document (id, acquisition_id)
SELECT gen_random_uuid(), a.id
FROM acquisition a
WHERE a.kind = 'scan' AND NOT EXISTS (SELECT 1 FROM document d WHERE d.acquisition_id = a.id);
