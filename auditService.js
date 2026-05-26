import { getDb } from "../db/database.js";
import { uid, hashIp } from "../utils/platformSecurity.js";

export function logAudit(req, { action, resource, resourceId, universite, meta }) {
  const db = getDb();
  const user = req.user;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO audit_log (id, actor_email, actor_role, action, resource, resource_id, universite, ip_hash, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uid("aud"),
    user?.email || null,
    user?.role || "public",
    action,
    resource,
    resourceId || null,
    universite || user?.universite || null,
    hashIp(req.ip || req.socket?.remoteAddress),
    JSON.stringify(meta || {}),
    now
  );
}
