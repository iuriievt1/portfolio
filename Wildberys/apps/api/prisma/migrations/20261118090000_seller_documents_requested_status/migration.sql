-- A new status of a seller: the team asked for documents and waits for them.
-- It has a migration of its own: PostgreSQL does not let a new value of an enum be used
-- in the transaction that adds it, and the next migration uses it in a constraint.
ALTER TYPE "seller_status" ADD VALUE 'DOCUMENTS_REQUESTED' AFTER 'PENDING_REVIEW';
