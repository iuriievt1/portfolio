-- CAP-004-R06
ALTER TABLE administration_session ADD COLUMN confirmed_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE administration_session ALTER COLUMN confirmed_at DROP DEFAULT;

ALTER TABLE administration_session DROP CONSTRAINT administration_session_end_reason_check;
ALTER TABLE administration_session ADD CONSTRAINT administration_session_end_reason_check
	CHECK (end_reason IN ('logout', 'idle', 'expired', 'access_revoked', 'provider_rejected'));
