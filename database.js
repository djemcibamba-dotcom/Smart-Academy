import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (!db) {
    const dir = path.dirname(config.dbPath);
    fs.mkdirSync(dir, { recursive: true });
    db = new Database(config.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    db.exec(schema);
    const platformSchema = fs.readFileSync(
      path.join(__dirname, "schema-platform.sql"),
      "utf8"
    );
    db.exec(platformSchema);
    try {
      db.exec("CREATE INDEX IF NOT EXISTS idx_users_telephone ON users(telephone)");
    } catch {
      /* déjà présent */
    }
    try {
      db.exec("ALTER TABLE users ADD COLUMN campus_tariffs TEXT");
    } catch {
      /* colonne déjà présente */
    }
    try {
      db.exec("ALTER TABLE documents ADD COLUMN attachments TEXT DEFAULT '[]'");
    } catch {
      /* colonne déjà présente */
    }
    try {
      db.exec("ALTER TABLE documents ADD COLUMN section_id TEXT");
    } catch {
      /* déjà présent */
    }
    try {
      db.exec("ALTER TABLE documents ADD COLUMN section_name TEXT");
    } catch {
      /* déjà présent */
    }
  }
  return db;
}

export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    prenom: row.prenom,
    nom: row.nom,
    telephone: row.telephone,
    universite: row.universite,
    filiere: row.filiere,
    niveau: row.niveau,
    matricule: row.matricule,
    dateNaissance: row.date_naissance,
    departement: row.departement,
    grade: row.grade,
    service: row.service,
    fonction: row.fonction,
    numEmploye: row.num_employe,
    numAssist: row.num_assist,
    nomUniversite: row.nom_universite,
    sigle: row.sigle,
    ville: row.ville,
    adresse: row.adresse,
    nbEtudiants: row.nb_etudiants,
    siteWeb: row.site_web,
    responsable: row.responsable,
    codeUni: row.code_uni,
    coursClasses: JSON.parse(row.cours_classes || "[]"),
    payment: row.payment ? JSON.parse(row.payment) : null,
    inscriptionFee: row.inscription_fee
      ? JSON.parse(row.inscription_fee)
      : null,
    campusTariffs: row.campus_tariffs ? JSON.parse(row.campus_tariffs) : null,
    createdAt: row.created_at,
  };
}

export function rowToDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    source: row.source,
    author: row.author,
    authorId: row.author_id,
    date: row.date,
    mediaCategory: row.media_category,
    type: row.type,
    size: row.size,
    mediaUrl: row.media_url || (row.media_path ? `/uploads/${row.media_path}` : ""),
    attachments: JSON.parse(row.attachments || "[]"),
    audienceType: row.audience_type,
    sectionId: row.section_id,
    sectionName: row.section_name,
    universite: row.universite,
    filiere: row.filiere,
    niveau: row.niveau,
    courseCode: row.course_code,
    courseName: row.course_name,
    classe: row.classe,
    allowReactions: !!row.allow_reactions,
    reactions: JSON.parse(row.reactions || "{}"),
    updatedAt: row.updated_at,
  };
}
