// Records an administrator change in the activity log (inside the caller's transaction)
export const audit = (client, admin, action, module, recordId) =>
  client.query('INSERT INTO audit_logs(admin_id,action,module,record_id) VALUES($1,$2,$3,$4)', [
    admin.id,
    action,
    module,
    String(recordId),
  ])
