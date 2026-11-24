-- datovy-model.md 4 „Artefakt“, 11, dorucovaci-jadro.md 3, integrace-dicom.md 5.8, 5.9, CAP-021-R06, CAP-023-R15
ALTER TABLE artifact
	ALTER COLUMN binary_store_key DROP NOT NULL,
	ADD COLUMN source_kind                   text         NOT NULL CHECK (source_kind IN ('image', 'document')),
	ADD COLUMN source_id                     uuid         NOT NULL,
	ADD COLUMN target                        text         NOT NULL CHECK (length(target) BETWEEN 1 AND 100),
	ADD COLUMN text_language                 text         CHECK (text_language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$'),
	ADD COLUMN series_description_written    text         CHECK (length(series_description_written) BETWEEN 1 AND 64),
	ADD COLUMN instance_title_written        text         CHECK (length(instance_title_written) BETWEEN 1 AND 1024),
	ADD COLUMN instance_description_written  text         CHECK (length(instance_description_written) BETWEEN 1 AND 1024),
	ADD COLUMN created_at                    timestamptz  NOT NULL DEFAULT now(),
	ADD CONSTRAINT artifact_sop_instance_uid_check CHECK (sop_instance_uid ~ '^[0-9]+(\.[0-9]+)*$' AND length(sop_instance_uid) <= 64),
	ADD CONSTRAINT artifact_source_uniq UNIQUE (source_kind, source_id, target, sop_class_uid);
CREATE INDEX artifact_acquisition_idx ON artifact (acquisition_id);

-- datovy-model.md 4 „Artefakt“, ADR-005 ř. 22, 23, CAP-023-R15
CREATE TABLE artifact_variant (
	artifact_id       uuid  NOT NULL REFERENCES artifact (id),
	transfer_syntax   text  NOT NULL CHECK (transfer_syntax ~ '^[0-9]+(\.[0-9]+)*$' AND length(transfer_syntax) <= 64),
	dataset_sha256    text  NOT NULL CHECK (dataset_sha256 ~ '^[0-9a-f]{64}$'),
	binary_object_id  uuid  NOT NULL UNIQUE REFERENCES binary_object (id),
	PRIMARY KEY (artifact_id, transfer_syntax)
);

-- datovy-model.md 4 „Doručení“, CAP-021-R03, CAP-022-R11, Q-065
ALTER TABLE delivery
	ADD COLUMN reason text CHECK (reason ~ '^[a-z0-9]+(_[a-z0-9]+)*$' AND length(reason) <= 64),
	ADD CONSTRAINT delivery_acquisition_target_uniq UNIQUE (acquisition_id, target),
	ADD CONSTRAINT delivery_failure_reason_check CHECK ((state = 'assembly_failed') = (reason IS NOT NULL));

-- datovy-model.md 4 „Doručení“, 11, CAP-023-R15
ALTER TABLE delivery_instance ADD CONSTRAINT delivery_instance_artifact_uniq UNIQUE (delivery_id, artifact_id);
CREATE INDEX delivery_instance_artifact_idx ON delivery_instance (artifact_id);

-- CAP-021-R03, CAP-021-R29, datovy-model.md 4 „Pořízení“
INSERT INTO delivery (id, acquisition_id, target, state)
SELECT gen_random_uuid(), acquisition.id, 'pacs', 'waiting_for_assembly'
FROM acquisition
WHERE acquisition.state <> 'draft'
	AND NOT EXISTS (SELECT 1 FROM delivery WHERE delivery.acquisition_id = acquisition.id);

-- CAP-021-R04, dorucovaci-jadro.md 3, ADR-016
INSERT INTO queue_task (id, kind, object_kind, object_id, state)
SELECT gen_random_uuid(), 'assembly', 'acquisition', acquisition.id, 'waiting'
FROM acquisition
WHERE acquisition.state = 'received'
	AND NOT EXISTS (
		SELECT 1 FROM queue_task task
		WHERE task.kind = 'assembly' AND task.object_kind = 'acquisition' AND task.object_id = acquisition.id
			AND task.state IN ('waiting', 'running')
	);

-- CAP-022-R10, CAP-022-R11, dorucovaci-jadro.md 5.2
ALTER TABLE document
	ADD COLUMN text_recognition_failures integer NOT NULL DEFAULT 0 CHECK (text_recognition_failures >= 0);

-- integrace-dicom.md 5.4, CAP-021-R11, CAP-021-R25
ALTER TABLE acquisition ADD COLUMN first_instance_number integer CHECK (first_instance_number >= 1);

UPDATE acquisition SET first_instance_number = numbered.first_instance_number
FROM (
	SELECT id, 1 + coalesce(sum(file_count) OVER (
		PARTITION BY encounter_id, finding_id
		ORDER BY closed_at, id
		ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
	), 0) AS first_instance_number
	FROM acquisition
	WHERE state <> 'draft' AND kind = 'photo' AND finding_id IS NOT NULL
) numbered
WHERE acquisition.id = numbered.id;

UPDATE acquisition SET first_instance_number = 1 WHERE state <> 'draft' AND kind = 'scan';

ALTER TABLE acquisition ADD CONSTRAINT acquisition_closed_first_instance_number_check CHECK (
	state = 'draft' OR first_instance_number IS NOT NULL OR (kind = 'photo' AND finding_id IS NULL)
);

CREATE FUNCTION acquisition_first_instance_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.kind = 'scan' THEN
		NEW.first_instance_number := 1;
		RETURN NEW;
	END IF;
	PERFORM 1 FROM finding WHERE id = NEW.finding_id FOR NO KEY UPDATE;
	SELECT 1 + coalesce(sum(earlier.file_count), 0) INTO NEW.first_instance_number
	FROM acquisition earlier
	WHERE earlier.encounter_id = NEW.encounter_id
		AND earlier.finding_id = NEW.finding_id
		AND earlier.id <> NEW.id
		AND earlier.state <> 'draft';
	RETURN NEW;
END;
$$;

CREATE TRIGGER acquisition_numbers_instances
	BEFORE INSERT OR UPDATE OF state, finding_id ON acquisition
	FOR EACH ROW WHEN (
		NEW.state <> 'draft' AND NEW.first_instance_number IS NULL AND (NEW.kind = 'scan' OR NEW.finding_id IS NOT NULL)
	)
	EXECUTE FUNCTION acquisition_first_instance_number();

CREATE TRIGGER acquisition_first_instance_number_unchanged
	BEFORE UPDATE OF first_instance_number ON acquisition
	FOR EACH ROW WHEN (OLD.first_instance_number IS NOT NULL AND OLD.first_instance_number IS DISTINCT FROM NEW.first_instance_number)
	EXECUTE FUNCTION assigned_number_reject_change();

-- datovy-model.md 4 „Upozornění správce“, administration.yaml AdministratorAlert, CAP-022-R11, CAP-028-R15
ALTER TABLE administrator_alert DROP CONSTRAINT administrator_alert_kind_check;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_kind_check CHECK (kind IN (
	'clinical_record_write_failed',
	'stale_acquisition_drafts',
	'clinical_record_binary_upload_failed',
	'viewing_copy_generation_failed',
	'audit_chain_broken',
	'clinical_record_store_unavailable',
	'assembly_failed',
	'assembly_paused'
));
ALTER TABLE administrator_alert
	ADD COLUMN delivery_id uuid REFERENCES delivery (id),
	ADD CONSTRAINT administrator_alert_delivery_check
		CHECK (kind <> 'assembly_failed' OR (delivery_id IS NOT NULL AND queue_task_id IS NOT NULL));
CREATE INDEX administrator_alert_delivery_idx ON administrator_alert (delivery_id) WHERE delivery_id IS NOT NULL;
-- CAP-021-R41, datovy-model.md 4 „Upozornění správce“
CREATE UNIQUE INDEX administrator_alert_assembly_paused_uniq ON administrator_alert (kind)
	WHERE kind = 'assembly_paused' AND resolved_at IS NULL;

-- datovy-model.md 8, CAP-025-R14, CAP-028-R15
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
	'assembly'
));

-- CAP-021-R26, CAP-017-R18
GRANT SELECT ON TABLE code_list_item, code_list_item_name TO vulna_worker;
