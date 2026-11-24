-- CAP-001-R07, CAP-002-R03
ALTER TABLE login_challenge ADD COLUMN confirmed_user_id uuid REFERENCES app_user (id) ON DELETE SET NULL;
