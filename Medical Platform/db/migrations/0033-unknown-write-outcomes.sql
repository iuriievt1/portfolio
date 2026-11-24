-- CAP-021-R27, datovy-model.md 4 „Úloha fronty“
ALTER TABLE queue_task ADD COLUMN unknown_outcomes integer NOT NULL DEFAULT 0 CHECK (unknown_outcomes >= 0);
