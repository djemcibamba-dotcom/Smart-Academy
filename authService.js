import { v4 as uuidv4 } from "uuid";
import { getDb, rowToUser } from "../db/database.js";
import { signAccessToken, hashToken, generateRefreshTokenRaw } from "../utils/tokens.js";
import {
  findUserByIdentifier,
  verifyPassword,
  recordFailedLogin,
  clearFailedLogins,
  isAccountLocked,
  userToSession,
} from "./userService.js";

const REFRESH_DAYS = 7;

function storeRefreshToken(userId, refreshRaw) {
  const db = getDb();
  const expiresAt = new Date(
    Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    userId,
    hashToken(refreshRaw),
    expiresAt,
    new Date().toISOString()
  );
  return refreshRaw;
}

export function issueTokens(user) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshRaw = generateRefreshTokenRaw();
  storeRefreshToken(user.id, refreshRaw);
  return { accessToken, refreshRaw, session: userToSession(user) };
}

export async function login(identifier, password, expectedRole, options = {}) {
  const user = findUserByIdentifier(identifier);
  if (!user) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    throw new Error("INVALID_CREDENTIALS");
  }

  if (expectedRole && user.role !== expectedRole) {
    throw new Error("ROLE_MISMATCH");
  }

  const registeredUni =
    user.role === "universite"
      ? user.universite || user.sigle || user.codeUni
      : user.universite;
  if (
    options.universite &&
    registeredUni &&
    ["etudiant", "professeur", "assistant"].includes(user.role) &&
    options.universite !== registeredUni
  ) {
    throw new Error("UNIVERSITY_MISMATCH");
  }
  if (
    options.codeUni &&
    user.role === "universite" &&
    user.codeUni &&
    options.codeUni.trim().toUpperCase() !== user.codeUni.trim().toUpperCase()
  ) {
    throw new Error("CODE_UNI_MISMATCH");
  }

  if (isAccountLocked(user)) {
    throw new Error("ACCOUNT_LOCKED");
  }

  const ok = await verifyPassword(user, password);
  if (!ok) {
    recordFailedLogin(user.id);
    throw new Error("INVALID_CREDENTIALS");
  }

  clearFailedLogins(user.id);
  return issueTokens(user);
}

export function refreshSession(refreshRaw) {
  if (!refreshRaw || typeof refreshRaw !== "string") {
    throw new Error("INVALID_REFRESH");
  }

  const db = getDb();
  const tokenHash = hashToken(refreshRaw);
  const stored = db
    .prepare(
      `SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > ?`
    )
    .get(tokenHash, new Date().toISOString());

  if (!stored) throw new Error("INVALID_REFRESH");

  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(stored.user_id);
  if (!userRow) throw new Error("INVALID_REFRESH");

  db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(stored.id);

  const user = rowToUser(userRow);
  return issueTokens(user);
}

export function logout(refreshRaw) {
  if (!refreshRaw) return;
  getDb()
    .prepare("DELETE FROM refresh_tokens WHERE token_hash = ?")
    .run(hashToken(refreshRaw));
}
