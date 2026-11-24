-- CAP-016-R04, CAP-016-R08, clinical-workflow.yaml BodyView
ALTER TABLE body_site DROP CONSTRAINT body_site_view_check;
ALTER TABLE body_site ADD CONSTRAINT body_site_view_check CHECK (view IN (
	'anterior',
	'posterior',
	'right_lateral',
	'left_lateral',
	'plantar',
	'dorsal'
));
