-- datovy-model.md 11, CAP-014-R16
CREATE INDEX encounter_date_scheduled_idx ON encounter (date, scheduled_time);

-- datovy-model.md 11, CAP-014-R24, ADR-012
CREATE INDEX encounter_patient_days_idx ON encounter (patient_id, date DESC, (COALESCE(started_at, created_at)) DESC, id DESC);
