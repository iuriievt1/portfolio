-- CAP-003-R13: roles and their permissions are data seeded here, the catalog is code
CREATE TABLE role (
	code  text  PRIMARY KEY CHECK (length(code) BETWEEN 1 AND 64),
	name  text  NOT NULL CHECK (length(name) BETWEEN 1 AND 128)
);

-- CAP-029-R33: only permissions the code knows
CREATE TABLE role_permission (
	role_code   text  NOT NULL REFERENCES role (code),
	permission  text  NOT NULL CHECK (permission IN (
		'administration.access',
		'users.manage',
		'credentials.manage',
		'devices.manage',
		'configuration.manage'
	)),
	PRIMARY KEY (role_code, permission)
);

INSERT INTO role (code, name) VALUES
	('clinician', 'Zdravotník'),
	('administrator', 'Správce');

-- CAP-003-R02, CAP-003-R09
INSERT INTO role_permission (role_code, permission) VALUES
	('administrator', 'administration.access'),
	('administrator', 'users.manage'),
	('administrator', 'credentials.manage'),
	('administrator', 'devices.manage'),
	('administrator', 'configuration.manage');

ALTER TABLE user_role DROP CONSTRAINT user_role_role_check;
ALTER TABLE user_role ADD CONSTRAINT user_role_role_fkey FOREIGN KEY (role) REFERENCES role (code);

REVOKE ALL ON TABLE role, role_permission FROM vulna_api, vulna_worker;
GRANT SELECT ON TABLE role, role_permission TO vulna_api;
