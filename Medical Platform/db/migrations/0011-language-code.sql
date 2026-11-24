-- the stored choice takes the instance form, index.yaml LanguageCode
ALTER TABLE app_user DROP CONSTRAINT app_user_preferred_language_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_preferred_language_check
	CHECK (preferred_language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$');
