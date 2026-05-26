import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getDb, rowToUser } from "../db/database.js";
import { config } from "../config.js";
import {
  cleanEmail,
  cleanText,
  cleanRole,
  cleanPhone,
  validateEmailStrict,
  normPersonKey,
  validatePersonNameText,
  getDisplayName,
} from "../utils/sanitize.js";

const BCRYPT_ROUNDS = 12;

export function findUserByEmail(email) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email);
  return rowToUser(row);
}

export function findUserByPhone(phone) {
  const normalized = cleanPhone(phone);
  if (!normalized) return null;
  const rows = getDb().prepare("SELECT * FROM users WHERE telephone IS NOT NULL").all();
  for (const row of rows) {
    if (cleanPhone(row.telephone) === normalized) return rowToUser(row);
  }
  return null;
}

function assertUniqueIdentity(profile, email) {
  const existingEmail = findUserByEmail(email);
  if (existingEmail) {
    if (existingEmail.role === profile.role) throw new Error("EMAIL_EXISTS");
    throw new Error("IDENTITY_CONFLICT");
  }

  const phone = cleanPhone(profile.telephone);
  if (!phone) throw new Error("INVALID_PHONE");
  if (findUserByPhone(phone)) throw new Error("PHONE_EXISTS");

  const role = cleanRole(profile.role);
  if (role === "universite") {
    if (!validatePersonNameText(profile.nomUniversite, 3)) throw new Error("INVALID_PROFILE");
    if (!validatePersonNameText(profile.responsable, 3)) throw new Error("INVALID_PROFILE");
    const uniKey = `uni:${normPersonKey(profile.nomUniversite, profile.responsable)}`;
    const rows = getDb().prepare("SELECT * FROM users WHERE role = 'universite'").all();
    for (const row of rows) {
      const k = `uni:${normPersonKey(row.nom_universite, row.responsable)}`;
      if (k === uniKey) throw new Error("IDENTITY_CONFLICT");
    }
    return phone;
  }

  if (!validatePersonNameText(profile.prenom) || !validatePersonNameText(profile.nom)) {
    throw new Error("INVALID_PROFILE");
  }

  const key = normPersonKey(profile.prenom, profile.nom);
  const all = getDb().prepare("SELECT email, role, prenom, nom FROM users").all();
  for (const row of all) {
    if (row.role === "universite") continue;
    const rowKey = normPersonKey(row.prenom, row.nom);
    if (rowKey === key && row.role !== role) {
      throw new Error("MULTI_ROLE");
    }
  }
  return phone;
}

export function findUserById(id) {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return rowToUser(row);
}

export function findUserByIdentifier(identifier) {
  const db = getDb();
  const id = cleanEmail(identifier) || identifier.trim();
  let row = db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(id);
  if (!row) {
    row = db.prepare("SELECT * FROM users WHERE matricule = ?").get(id);
  }
  if (!row) {
    row = db.prepare("SELECT * FROM users WHERE num_employe = ?").get(id);
  }
  if (!row) {
    row = db.prepare("SELECT * FROM users WHERE num_assist = ?").get(id);
  }
  return rowToUser(row);
}

export async function createUser(profile) {
  const email = validateEmailStrict(profile.email) || cleanEmail(profile.email);
  const role = cleanRole(profile.role);
  if (!email || !role) throw new Error("INVALID_PROFILE");

  const phoneNormalized = assertUniqueIdentity(profile, email);

  const passwordHash = await bcrypt.hash(profile.password, BCRYPT_ROUNDS);
  const universiteLocked =
    role === "universite"
      ? cleanText(profile.universite || profile.sigle, 50) || cleanText(profile.codeUni, 50)
      : cleanText(profile.universite, 50) || null;
  const id = uuidv4();
  const now = new Date().toISOString();

  const db = getDb();
  db.prepare(
    `INSERT INTO users (
      id, email, password_hash, role, prenom, nom, telephone, universite,
      filiere, niveau, matricule, date_naissance, departement, grade, service,
      fonction, num_employe, num_assist, nom_universite, sigle, ville, adresse,
      nb_etudiants, site_web, responsable, code_uni, cours_classes, payment,
      inscription_fee, created_at, updated_at
    ) VALUES (
      @id, @email, @password_hash, @role, @prenom, @nom, @telephone, @universite,
      @filiere, @niveau, @matricule, @date_naissance, @departement, @grade, @service,
      @fonction, @num_employe, @num_assist, @nom_universite, @sigle, @ville, @adresse,
      @nb_etudiants, @site_web, @responsable, @code_uni, @cours_classes, @payment,
      @inscription_fee, @created_at, @updated_at
    )`
  ).run({
    id,
    email,
    password_hash: passwordHash,
    role,
    prenom: cleanText(profile.prenom, 100) || null,
    nom: cleanText(profile.nom, 150) || null,
    telephone: phoneNormalized,
    universite: universiteLocked,
    filiere: cleanText(profile.filiere, 200) || null,
    niveau: profile.niveau || null,
    matricule: cleanText(profile.matricule, 50) || null,
    date_naissance: profile.dateNaissance || null,
    departement: cleanText(profile.departement, 200) || null,
    grade: cleanText(profile.grade, 50) || null,
    service: cleanText(profile.service, 50) || null,
    fonction: cleanText(profile.fonction, 50) || null,
    num_employe: cleanText(profile.numEmploye, 50) || null,
    num_assist: cleanText(profile.numAssist, 50) || null,
    nom_universite: cleanText(profile.nomUniversite, 200) || null,
    sigle: cleanText(profile.sigle, 30) || null,
    ville: cleanText(profile.ville, 100) || null,
    adresse: cleanText(profile.adresse, 300) || null,
    nb_etudiants: cleanText(profile.nbEtudiants, 20) || null,
    site_web: profile.siteWeb ? cleanText(profile.siteWeb, 200) : null,
    responsable: cleanText(profile.responsable, 150) || null,
    code_uni: cleanText(profile.codeUni, 50) || null,
    cours_classes: JSON.stringify(profile.coursClasses || []),
    payment: profile.payment ? JSON.stringify(profile.payment) : null,
    inscription_fee: profile.inscriptionFee
      ? JSON.stringify(profile.inscriptionFee)
      : null,
    created_at: now,
    updated_at: now,
  });

  return findUserById(id);
}

export function userToSession(user) {
  const uni =
    user.role === "universite"
      ? user.universite || user.sigle || user.codeUni || null
      : user.universite || null;
  const isUni = user.role === "universite";

  return {
    role: user.role,
    identifiant: user.email,
    userId: user.id,
    nom: isUni ? user.nomUniversite || user.email : user.nom || "",
    prenom: user.prenom,
    displayName: getDisplayName(user),
    universite: uni,
    universiteLocked: uni,
    filiere: user.filiere,
    niveau: user.niveau,
    coursClasses: user.coursClasses,
    departement: user.departement,
    service: user.service,
    codeUni: user.codeUni,
    sigle: user.sigle,
    matricule: user.matricule,
    campusTariffs: user.campusTariffs || null,
  };
}

export function recordFailedLogin(userId) {
  const db = getDb();
  const row = db.prepare("SELECT failed_login_attempts FROM users WHERE id = ?").get(userId);
  const attempts = (row?.failed_login_attempts || 0) + 1;
  let lockedUntil = null;
  if (attempts >= config.maxLoginAttempts) {
    lockedUntil = new Date(
      Date.now() + config.lockoutMinutes * 60 * 1000
    ).toISOString();
  }
  db.prepare(
    "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?"
  ).run(attempts, lockedUntil, new Date().toISOString(), userId);
  return { attempts, lockedUntil };
}

export function clearFailedLogins(userId) {
  getDb()
    .prepare(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?"
    )
    .run(new Date().toISOString(), userId);
}

export function isAccountLocked(user) {
  if (!user) return false;
  const row = getDb()
    .prepare("SELECT locked_until FROM users WHERE id = ?")
    .get(user.id);
  if (!row?.locked_until) return false;
  if (new Date(row.locked_until) > new Date()) return true;
  clearFailedLogins(user.id);
  return false;
}

export async function verifyPassword(user, password) {
  const row = getDb()
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(user.id);
  if (!row) return false;
  return bcrypt.compare(password, row.password_hash);
}
