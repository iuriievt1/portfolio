-- datovy-model.md 4 „Doručení“, CAP-023-R28, CAP-023-S24, CAP-023-S26
ALTER TABLE delivery_instance
	ADD COLUMN closed_from_state  text         CHECK (closed_from_state IN ('held_for_review', 'permanently_failed')),
	ADD COLUMN closed_at          timestamptz,
	ADD COLUMN closed_by_user_id  uuid         REFERENCES app_user (id),
	ADD COLUMN closure_reason     text         CHECK (closure_reason IN (
		'documentation_reacquired',
		'archived_by_other_means',
		'wrong_patient_or_encounter',
		'not_required'
	)),
	ADD CONSTRAINT delivery_instance_closure_check CHECK (
		(state = 'closed_by_administrator') = (closed_from_state IS NOT NULL)
		AND (closed_from_state IS NULL) = (closed_at IS NULL)
		AND (closed_from_state IS NULL) = (closed_by_user_id IS NULL)
		AND (closed_from_state IS NULL) = (closure_reason IS NULL)
	);

-- datovy-model.md 4 „Doručení“ held_for_review_cause, CAP-023-R09, CAP-023-R28
ALTER TABLE delivery_instance
	DROP CONSTRAINT delivery_instance_held_cause_check,
	ADD CONSTRAINT delivery_instance_held_cause_check CHECK (
		(held_for_review_cause IS NOT NULL)
		= (state = 'held_for_review' OR closed_from_state IS NOT DISTINCT FROM 'held_for_review')
	);

-- administration.yaml acknowledgeAdministratorAlert, CAP-023-R12, CHG-189
ALTER TABLE administrator_alert
	ADD COLUMN acknowledged_at          timestamptz,
	ADD COLUMN acknowledged_by_user_id  uuid  REFERENCES app_user (id),
	ADD CONSTRAINT administrator_alert_acknowledgement_check CHECK (
		(acknowledged_at IS NULL) = (acknowledged_by_user_id IS NULL)
		AND (acknowledged_at IS NULL OR kind = 'stored_with_warning')
		AND (kind <> 'stored_with_warning' OR resolved_at IS NOT DISTINCT FROM acknowledged_at)
	);

-- administration.yaml listDeliveries, ADR-012
CREATE INDEX delivery_listing_idx ON delivery (created_at DESC, id DESC);

-- administration.yaml listDeliveries instance_state, getOperationalMetricsForAdministration delivery_queue
CREATE INDEX delivery_instance_state_idx ON delivery_instance (state, delivery_id);
