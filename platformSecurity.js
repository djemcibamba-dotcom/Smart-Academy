import crypto from "crypto";
import { config } from "../config.js";

const PLATFORM_SECRET =
  process.env.SAC_PLATFORM_SECRET || config.jwtAccessSecret + ":platform";

export function uid(prefix = "id") {
  return prefix + "-" + crypto.randomUUID();
}

export function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHmac("sha256", PLATFORM_SECRET).update(ip).digest("hex").slice(0, 16);
}

export function signDiploma(payload) {
  const raw = JSON.stringify(payload);
  return crypto.createHmac("sha256", PLATFORM_SECRET).update(raw).digest("hex");
}

export function generateVerificationCode() {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
}

export function generateDiplomaNumber(universite, year) {
  const code = String(universite || "UNK").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const seq = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `SAC-${code}-${year}-${seq}`;
}

export function assertCampusAccess(user, universite) {
  if (!user) throw new Error("AUTH_REQUIRED");
  if (user.role === "universite") {
    const code = user.universite || user.codeUni || user.sigle;
    if (code && universite && code !== universite) throw new Error("FORBIDDEN_CAMPUS");
    return code || universite;
  }
  if (!universite || user.universite !== universite) throw new Error("FORBIDDEN_CAMPUS");
  return universite;
}

export function canRoleAccessModule(role, moduleId) {
  const matrix = {
    inscription: ["etudiant", "professeur", "assistant", "universite"],
    resultats: ["etudiant", "professeur", "assistant", "universite"],
    frais: ["etudiant", "assistant", "universite"],
    bibliotheque: ["etudiant", "professeur", "assistant", "universite"],
    orientation_ia: ["etudiant"],
    stages_emplois: ["etudiant", "professeur", "assistant", "universite"],
    reseau: ["etudiant", "professeur", "assistant"],
    cours_ligne: ["etudiant", "professeur", "universite"],
    verification_diplome: ["etudiant", "universite", "public"],
  };
  return (matrix[moduleId] || []).includes(role) || moduleId === "verification_diplome" && role === "public";
}
