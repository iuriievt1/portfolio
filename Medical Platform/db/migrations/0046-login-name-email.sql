-- administration.yaml User login_name, email
ALTER TABLE app_user
	ADD COLUMN login_name  text  CHECK (length(login_name) BETWEEN 1 AND 256),
	ADD COLUMN email       text  CHECK (length(email) BETWEEN 1 AND 254);

CREATE UNIQUE INDEX app_user_login_name_uniq ON app_user (lower(login_name)) WHERE login_name IS NOT NULL;
