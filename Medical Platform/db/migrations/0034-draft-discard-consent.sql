-- datovy-model.md 4 „Souhlas správce se zahozením rozpracovaného záznamu“, CAP-015-R19, CAP-015-R20
CREATE TABLE draft_discard_consent (
	id                     uuid         PRIMARY KEY,
	operator_user_id       uuid         NOT NULL REFERENCES app_user (id),
	administrator_user_id  uuid         NOT NULL REFERENCES app_user (id),
	reason                 text         NOT NULL CHECK (reason IN ('operator_revoked', 'operator_departed', 'long_absence', 'device_reassigned')),
	granted_at             timestamptz  NOT NULL DEFAULT now(),
	discarded_count        integer      NOT NULL CHECK (discarded_count >= 0),
	refused_count          integer      NOT NULL CHECK (refused_count >= 0)
);

-- ADR-021
REVOKE ALL ON TABLE draft_discard_consent FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE draft_discard_consent TO vulna_api;

-- datovy-model.md 4 „Upozornění pořizovatele“, CAP-015-R18, CAP-015-R20, CAP-026-R16
CREATE TABLE operator_notification (
	id                        uuid         PRIMARY KEY,
	user_id                   uuid         NOT NULL REFERENCES app_user (id),
	kind                      text         NOT NULL CHECK (kind IN ('draft_discarded_by_administrator', 'draft_reminder')),
	created_at                timestamptz  NOT NULL DEFAULT now(),
	acknowledged_at           timestamptz,
	draft_discard_consent_id  uuid         REFERENCES draft_discard_consent (id),
	acquisition_id            uuid         REFERENCES acquisition (id) ON DELETE CASCADE,
	acquisition_updated_at    timestamptz,
	discarded_count           integer      CHECK (discarded_count >= 1),
	discarded_at              timestamptz,
	CONSTRAINT operator_notification_kind_fields_check CHECK (
		(kind = 'draft_discarded_by_administrator'
			AND draft_discard_consent_id IS NOT NULL AND discarded_count IS NOT NULL AND discarded_at IS NOT NULL
			AND acquisition_id IS NULL AND acquisition_updated_at IS NULL)
		OR (kind = 'draft_reminder'
			AND acquisition_id IS NOT NULL AND acquisition_updated_at IS NOT NULL
			AND draft_discard_consent_id IS NULL AND discarded_count IS NULL AND discarded_at IS NULL)
	)
);

-- datovy-model.md 11
CREATE INDEX operator_notification_user_idx ON operator_notification (user_id, acknowledged_at, created_at);

-- CAP-026-R16
CREATE UNIQUE INDEX operator_notification_reminder_uniq ON operator_notification (acquisition_id, acquisition_updated_at)
	WHERE kind = 'draft_reminder';

-- ADR-021
REVOKE ALL ON TABLE operator_notification FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE operator_notification TO vulna_api, vulna_worker;
GRANT UPDATE (acknowledged_at) ON TABLE operator_notification TO vulna_api;

-- CAP-004-R14, CAP-026-R16
CREATE INDEX acquisition_draft_updated_idx ON acquisition (updated_at DESC, id DESC) WHERE state = 'draft';

-- datovy-model.md 4 „Upozornění správce“, CAP-026-R16, CAP-028-R15
ALTER TABLE administrator_alert DROP CONSTRAINT administrator_alert_kind_check;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_kind_check
	CHECK (kind IN ('clinical_record_write_failed', 'stale_acquisition_drafts'));

-- CAP-026-R16
CREATE UNIQUE INDEX administrator_alert_active_stale_drafts_uniq ON administrator_alert (kind)
	WHERE resolved_at IS NULL AND kind = 'stale_acquisition_drafts';

-- CAP-003-R13, CAP-029-R33
ALTER TABLE role_permission DROP CONSTRAINT role_permission_permission_check;
ALTER TABLE role_permission ADD CONSTRAINT role_permission_permission_check CHECK (permission IN (
	'administration.access',
	'users.manage',
	'credentials.manage',
	'devices.manage',
	'configuration.manage',
	'audit.read',
	'audit.export',
	'monitoring.manage',
	'drafts.manage'
));

-- CAP-003-R02, CAP-004-R14
INSERT INTO role_permission (role_code, permission) VALUES ('administrator', 'drafts.manage');
