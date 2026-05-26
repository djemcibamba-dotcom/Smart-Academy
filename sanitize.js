import validator from "validator";
import xss from "xss";

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
};

export function cleanText(str, maxLen = 5000) {
  if (typeof str !== "string") return "";
  const trimmed = str.trim().slice(0, maxLen);
  return xss(trimmed, xssOptions);
}

export function cleanEmail(email) {
  const e = (email || "").trim().toLowerCase();
  if (!validator.isEmail(e, { allow_utf8_local_part: false })) return null;
  return validator.normalizeEmail(e) || e;
}

export function cleanRole(role) {
  const allowed = ["etudiant", "professeur", "assistant", "universite"];
  return allowed.includes(role) ? role : null;
}

export function cleanNiveau(n) {
  const allowed = ["l1", "l2", "l3", "master1", "master2", "doctorat"];
  return allowed.includes(n) ? n : null;
}

export function cleanMediaCategory(m) {
  const allowed = ["info", "document", "image", "audio", "video"];
  return allowed.includes(m) ? m : "document";
}

export function cleanReactionType(t) {
  return ["useful", "question", "thanks"].includes(t) ? t : null;
}

export function validatePassword(password) {
  if (typeof password !== "string") return false;
  if (password.length < 8 || password.length > 128) return false;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return false;
  if (/\s/.test(password)) return false;
  return true;
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "yopmail.com",
  "10minutemail.com",
]);

const FAKE_EMAIL_LOCAL = /^(test|fake|faux|demo|noreply|xxx|null|asdf|qwerty|123)$/i;

export function cleanPhone(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("243") && d.length >= 12) d = d.slice(0, 12);
  else if (d.startsWith("00243")) d = d.slice(2, 14);
  else if (d.startsWith("0") && d.length >= 10) d = "243" + d.slice(1, 10);
  else if (d.length === 9) d = "243" + d;
  if (d.length !== 12 || !d.startsWith("243")) return null;
  const local = d.slice(3);
  if (!/^[89][0-9]{8}$/.test(local)) return null;
  if (/^(\d)\1{8}$/.test(local)) return null;
  return d;
}

export function validateEmailStrict(email) {
  const e = cleanEmail(email);
  if (!e) return null;
  const [local, domain] = e.split("@");
  if (FAKE_EMAIL_LOCAL.test(local) || DISPOSABLE_DOMAINS.has(domain)) return null;
  return e;
}

/** Nom complet sans répéter le prénom */
export function formatFullName(prenom, nom) {
  const p = String(prenom || "").trim();
  const n = String(nom || "").trim();
  if (!p && !n) return "";
  if (!p) return n;
  if (!n) return p;
  const pl = p.toLowerCase();
  const nl = n.toLowerCase();
  if (nl === pl) return p;
  if (nl.startsWith(pl + " ")) return n;
  return `${p} ${n}`;
}

export function getDisplayName(user) {
  if (!user) return "";
  if (user.nomUniversite) return user.nomUniversite;
  return formatFullName(user.prenom, user.nom) || user.email || "";
}

export function normPersonKey(prenom, nom) {
  const n = (s) =>
    (s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");
  return `${n(prenom)}|${n(nom)}`;
}

export function validatePersonNameText(name, minLen = 2) {
  const v = (name || "").trim();
  if (v.length < minLen || v.length > 80) return false;
  if (/[0-9@<>]/.test(v)) return false;
  if (/^(.)\1{4,}$/i.test(v.replace(/\s/g, ""))) return false;
  return true;
}
