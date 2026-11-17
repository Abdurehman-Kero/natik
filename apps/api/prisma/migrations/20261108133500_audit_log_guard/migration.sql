-- Activity log is append-only (SRS FR-REP-004): block UPDATE and DELETE at the database level,
-- so no application bug or manual query can rewrite history.

CREATE OR REPLACE FUNCTION natik_audit_log_read_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is read-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_read_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION natik_audit_log_read_only();

-- TRUNCATE skips row triggers, so block it with a statement trigger too.
CREATE TRIGGER "AuditLog_no_truncate"
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION natik_audit_log_read_only();
