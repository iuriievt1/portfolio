-- identity.yaml loginWithBarcode
ALTER TABLE login_attempt DROP CONSTRAINT login_attempt_method_check;
ALTER TABLE login_attempt ADD CONSTRAINT login_attempt_method_check
	CHECK (method IN ('oidc', 'card', 'qr', 'barcode', 'pin'));
