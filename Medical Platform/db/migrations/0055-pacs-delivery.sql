-- datovy-model.md 4 „Cíl doručení“, ADR-005 ř. 36, CAP-023-R23, CAP-023-R24, CAP-023-R27
CREATE TABLE delivery_target (
	code                       text         PRIMARY KEY CHECK (length(code) BETWEEN 1 AND 100),
	state                      text         NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'unavailable', 'paused')),
	reason                     text         CHECK (length(reason) BETWEEN 1 AND 100),
	changed_at                 timestamptz  NOT NULL DEFAULT now(),
	unavailability_alerted_at  timestamptz,
	resumed_by_user_id         uuid         REFERENCES app_user (id),
	CONSTRAINT delivery_target_active_reason_check CHECK ((state = 'active') = (reason IS NULL)),
	CONSTRAINT delivery_target_unavailability_alert_check CHECK (state = 'unavailable' OR unavailability_alerted_at IS NULL)
);

-- ADR-005 ř. 36
INSERT INTO delivery_target (code) VALUES ('pacs');

-- CAP-023-R23, CAP-023-R24, CAP-023-R27, CAP-028-R20
REVOKE ALL ON TABLE delivery_target FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, UPDATE (state, reason, changed_at, resumed_by_user_id) ON TABLE delivery_target TO vulna_api;
GRANT SELECT, UPDATE (state, reason, changed_at, unavailability_alerted_at) ON TABLE delivery_target TO vulna_worker;

ALTER TABLE delivery ADD FOREIGN KEY (target) REFERENCES delivery_target (code);
ALTER TABLE artifact ADD FOREIGN KEY (target) REFERENCES delivery_target (code);

-- datovy-model.md 4 „Doručení“, CAP-023-R09, CAP-023-R28, CAP-029-R16
ALTER TABLE delivery_instance DROP CONSTRAINT delivery_instance_state_check;
ALTER TABLE delivery_instance ADD CONSTRAINT delivery_instance_state_check CHECK (state IN (
	'waiting',
	'sending',
	'pending_verification',
	'confirmed',
	'temporarily_failed',
	'permanently_failed',
	'held_for_review',
	'closed_by_administrator'
));

-- datovy-model.md 4 „Doručení“, integrace-dicom.md 8, CAP-023-R09, CAP-023-R10, CAP-023-R15, CAP-023-R26
ALTER TABLE delivery_instance
	ADD COLUMN attempts                  integer      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
	ADD COLUMN accepted_transfer_syntax  text
		CHECK (accepted_transfer_syntax ~ '^[0-9]+(\.[0-9]+)*$' AND length(accepted_transfer_syntax) <= 64),
	ADD COLUMN verification_rejections   integer      NOT NULL DEFAULT 0 CHECK (verification_rejections >= 0),
	ADD COLUMN verification_on_hold_at   timestamptz,
	ADD COLUMN held_for_review_cause     text
		CHECK (held_for_review_cause IN ('dimse_status', 'artifact_sha256_mismatch', 'study_identity_conflict')),
	ADD CONSTRAINT delivery_instance_dimse_status_check CHECK (last_dimse_status ~ '^[0-9A-F]{4}$'),
	ADD CONSTRAINT delivery_instance_retention_anchor_check CHECK ((state = 'confirmed') = (retention_anchor IS NOT NULL)),
	ADD CONSTRAINT delivery_instance_verification_hold_check
		CHECK (verification_on_hold_at IS NULL OR state = 'pending_verification'),
	ADD CONSTRAINT delivery_instance_held_cause_check
		CHECK ((held_for_review_cause IS NOT NULL) = (state = 'held_for_review'));

-- datovy-model.md 4 „Upozornění správce“, administration.yaml AdministratorAlertKind, CAP-023-R09, CAP-023-R11,
-- CAP-023-R12, CAP-023-R17, CAP-023-R26, CAP-023-R27
ALTER TABLE administrator_alert DROP CONSTRAINT administrator_alert_kind_check;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_kind_check CHECK (kind IN (
	'clinical_record_write_failed',
	'stale_acquisition_drafts',
	'clinical_record_binary_upload_failed',
	'viewing_copy_generation_failed',
	'audit_chain_broken',
	'clinical_record_store_unavailable',
	'assembly_failed',
	'assembly_paused',
	'permanent_delivery_failure',
	'held_for_review',
	'stored_with_warning',
	'verification_rejected',
	'target_paused',
	'target_unavailability'
));
ALTER TABLE administrator_alert
	ADD COLUMN delivery_instance_id uuid REFERENCES delivery_instance (id),
	ADD COLUMN target_code text REFERENCES delivery_target (code),
	ADD CONSTRAINT administrator_alert_delivery_instance_check CHECK (
		kind NOT IN ('permanent_delivery_failure', 'held_for_review', 'stored_with_warning', 'verification_rejected')
		OR (delivery_id IS NOT NULL AND delivery_instance_id IS NOT NULL)
	),
	ADD CONSTRAINT administrator_alert_target_check
		CHECK (kind NOT IN ('target_paused', 'target_unavailability') OR target_code IS NOT NULL);
CREATE UNIQUE INDEX administrator_alert_active_instance_uniq ON administrator_alert (kind, delivery_instance_id)
	WHERE resolved_at IS NULL AND delivery_instance_id IS NOT NULL;
CREATE UNIQUE INDEX administrator_alert_active_target_uniq ON administrator_alert (kind, target_code)
	WHERE resolved_at IS NULL AND target_code IS NOT NULL;

-- datovy-model.md 8, CAP-023-R07, CAP-025-R14, CAP-028-R15
ALTER TABLE audit DROP CONSTRAINT audit_system_job_check;
ALTER TABLE audit ADD CONSTRAINT audit_system_job_check CHECK (system_job IN (
	'registry_sync',
	'retention',
	'orphan_cleanup',
	'buffer_cleanup',
	'audit_export',
	'clinical_record_installation',
	'clinical_record_write',
	'draft_reminder',
	'dependency_monitoring',
	'assembly',
	'delivery'
));
