-- datovy-model.md 4, CAP-020-R19, ADR-006
ALTER TABLE acquisition
	ADD COLUMN closed_wound_type_code               text     CHECK (length(closed_wound_type_code) BETWEEN 1 AND 64),
	ADD COLUMN closed_wound_type_code_list_version  integer  REFERENCES code_list_set (version);

-- CAP-020-R19, CAP-020-R21
UPDATE acquisition
SET closed_wound_type_code = snapshot.code,
	closed_wound_type_code_list_version = snapshot.code_list_version
FROM (
	SELECT closed.id,
		CASE
			WHEN last_before.id IS NOT NULL THEN last_before.wound_type_code
			WHEN first_after.id IS NOT NULL THEN first_after.previous_wound_type_code
			ELSE finding.wound_type_code
		END AS code,
		CASE
			WHEN last_before.id IS NOT NULL THEN last_before.wound_type_code_list_version
			WHEN first_after.id IS NOT NULL THEN first_after.previous_wound_type_code_list_version
			ELSE finding.wound_type_code_list_version
		END AS code_list_version
	FROM acquisition closed
	JOIN finding ON finding.id = closed.finding_id
	LEFT JOIN LATERAL (
		SELECT wound_change.id, wound_change.wound_type_code, wound_change.wound_type_code_list_version
		FROM finding_wound_type_change wound_change
		WHERE wound_change.finding_id = finding.id AND wound_change.changed_at <= closed.closed_at
		ORDER BY wound_change.changed_at DESC, wound_change.id DESC
		LIMIT 1
	) AS last_before ON TRUE
	LEFT JOIN LATERAL (
		SELECT wound_change.id, wound_change.previous_wound_type_code,
			wound_change.previous_wound_type_code_list_version
		FROM finding_wound_type_change wound_change
		WHERE wound_change.finding_id = finding.id AND wound_change.changed_at > closed.closed_at
		ORDER BY wound_change.changed_at ASC, wound_change.id ASC
		LIMIT 1
	) AS first_after ON TRUE
	WHERE closed.state <> 'draft' AND closed.kind = 'photo'
) AS snapshot
WHERE acquisition.id = snapshot.id;

-- CAP-020-R01, CAP-020-R20, ADR-012
DROP INDEX acquisition_finding_closed_idx;
DROP INDEX acquisition_finding_idx;
CREATE INDEX acquisition_finding_closed_idx ON acquisition (finding_id, closed_at DESC, id DESC);

-- CAP-020-R18, ADR-012
DROP INDEX acquisition_patient_scan_closed_idx;
CREATE INDEX acquisition_patient_closed_idx ON acquisition (patient_id, kind, closed_at DESC, id DESC);
