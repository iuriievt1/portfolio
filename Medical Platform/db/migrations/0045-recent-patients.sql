-- CAP-021-R13, clinical-workflow.yaml listRecentPatients
CREATE INDEX acquisition_operator_closed_idx ON acquisition (operator_user_id, patient_id, closed_at DESC, id DESC)
	WHERE closed_at IS NOT NULL;
