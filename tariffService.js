import { getDb, rowToUser } from "../db/database.js";

export const CDF_PER_USD = 2800;

export const DEFAULT_CAMPUS_TARIFFS = {
  etudiant: { amount: 1, currency: "USD", label: "Étudiant" },
  assistant: { amount: 5, currency: "USD", label: "Assistant" },
  professeur: { amount: 10, currency: "USD", label: "Professeur" },
};

const ROLES_WITH_CAMPUS_TARIFF = ["etudiant", "professeur", "assistant"];

function toCdf(amountUsd) {
  return Math.round(Number(amountUsd) * CDF_PER_USD);
}

export function normalizeTariffEntry(role, raw) {
  if (!ROLES_WITH_CAMPUS_TARIFF.includes(role)) return null;
  const def = DEFAULT_CAMPUS_TARIFFS[role];
  if (!raw || typeof raw !== "object") {
    return {
      amount: def.amount,
      currency: "USD",
      cdf: toCdf(def.amount),
      label: def.label,
    };
  }
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 0.5 || amount > 500) {
    throw new Error("INVALID_TARIFF_AMOUNT");
  }
  return {
    amount: Math.round(amount * 100) / 100,
    currency: "USD",
    cdf: toCdf(amount),
    label: def.label,
  };
}

export function parseCampusTariffs(json) {
  if (!json) return null;
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || typeof data !== "object") return null;
    const out = {};
    for (const role of ROLES_WITH_CAMPUS_TARIFF) {
      if (data[role]) out[role] = normalizeTariffEntry(role, data[role]);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export function findUniversityByCode(code) {
  if (!code || typeof code !== "string") return null;
  const id = code.trim().toLowerCase();
  const rows = getDb()
    .prepare("SELECT * FROM users WHERE role = 'universite'")
    .all();
  for (const row of rows) {
    const u = rowToUser(row);
    const keys = [u.universite, u.sigle, u.codeUni]
      .filter(Boolean)
      .map((k) => String(k).trim().toLowerCase());
    if (keys.includes(id)) return u;
  }
  return null;
}

export function getCampusTariffsForUniversity(universiteCode) {
  const uni = findUniversityByCode(universiteCode);
  const custom = uni?.campusTariffs;
  const merged = {};
  for (const role of ROLES_WITH_CAMPUS_TARIFF) {
    merged[role] = custom?.[role]
      ? normalizeTariffEntry(role, custom[role])
      : normalizeTariffEntry(role, null);
  }
  return {
    universite: universiteCode,
    universityName: uni?.nomUniversite || null,
    configured: !!custom,
    tariffs: merged,
  };
}

export function getCampusFee(universiteCode, role) {
  const pack = getCampusTariffsForUniversity(universiteCode);
  return pack.tariffs[role] || normalizeTariffEntry("etudiant", null);
}

export function validateTariffsPayload(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_TARIFFS");
  const out = {};
  for (const role of ROLES_WITH_CAMPUS_TARIFF) {
    if (body[role] !== undefined && body[role] !== null) {
      out[role] = normalizeTariffEntry(role, body[role]);
    }
  }
  if (!Object.keys(out).length) throw new Error("INVALID_TARIFFS");
  return out;
}

function normUniCode(code) {
  return String(code || "")
    .trim()
    .toLowerCase();
}

function memberMatchesUniversity(row, universiteCode) {
  const code = normUniCode(universiteCode);
  if (!code) return false;
  const keys = [row.universite, row.sigle, row.code_uni]
    .filter(Boolean)
    .map((k) => String(k).trim().toLowerCase());
  return keys.includes(code);
}

/** Applique les tarifs campus sur tous les étudiants / profs / assistants de l'université */
export function syncCampusTariffsToMembers(universiteCode, tariffs) {
  const code = universiteCode || "";
  if (!code || !tariffs) return 0;

  const db = getDb();
  const now = new Date().toISOString();
  const roles = ["etudiant", "professeur", "assistant"];
  const rows = db
    .prepare(
      "SELECT id, role, universite, sigle, code_uni, payment FROM users WHERE role IN ('etudiant','professeur','assistant')"
    )
    .all();

  let updated = 0;
  const updateStmt = db.prepare(
    "UPDATE users SET inscription_fee = ?, updated_at = ? WHERE id = ?"
  );

  for (const row of rows) {
    if (!memberMatchesUniversity(row, code)) continue;
    const fee = tariffs[row.role];
    if (!fee) continue;
    updateStmt.run(JSON.stringify(fee), now, row.id);
    updated++;
  }
  return updated;
}

export function updateUniversityCampusTariffs(userId, partialTariffs) {
  const user = rowToUser(
    getDb().prepare("SELECT * FROM users WHERE id = ?").get(userId)
  );
  if (!user || user.role !== "universite") throw new Error("FORBIDDEN");

  const existing = parseCampusTariffs(
    getDb().prepare("SELECT campus_tariffs FROM users WHERE id = ?").get(userId)
      ?.campus_tariffs
  ) || {};

  const next = { ...existing };
  for (const [role, fee] of Object.entries(partialTariffs)) {
    next[role] = fee;
  }

  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE users SET campus_tariffs = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(next), now, userId);

  const uniCode = user.universite || user.sigle || user.codeUni;
  const pack = getCampusTariffsForUniversity(uniCode);
  const membersUpdated = syncCampusTariffsToMembers(uniCode, pack.tariffs);
  return { ...pack, membersUpdated };
}
