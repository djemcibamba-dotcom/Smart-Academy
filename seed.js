import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./database.js";

const DEMO_PASSWORD = "Demo2025!";

export async function seedIfEmpty() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (count > 0) return;

  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date().toISOString();

  const users = [
    {
      id: uuidv4(),
      email: "etu.demo@unikin.cd",
      role: "etudiant",
      prenom: "Marie",
      nom: "Kabongo",
      universite: "unkin",
      filiere: "Sciences économiques — Gestion",
      niveau: "l2",
      matricule: "ETU-2024-08452",
    },
    {
      id: uuidv4(),
      email: "prof.demo@unikin.cd",
      role: "professeur",
      prenom: "Jean",
      nom: "Mukendi",
      universite: "unkin",
      departement: "Faculté des Sciences",
      cours_classes: JSON.stringify([
        {
          courseCode: "ECO101",
          courseName: "Introduction à l'économie",
          filiere: "Sciences économiques — Gestion",
          niveau: "l2",
          classe: "L2 Gestion — Groupe A",
          universite: "unkin",
        },
      ]),
    },
    {
      id: uuidv4(),
      email: "assist.demo@unikin.cd",
      role: "assistant",
      prenom: "Grace",
      nom: "Ilunga",
      universite: "unkin",
      service: "scolarite",
      cours_classes: JSON.stringify([
        {
          courseCode: "ADM-SCO",
          courseName: "Scolarité L2",
          filiere: "Toutes filières",
          niveau: "l2",
          classe: "L2 — Toutes classes",
          universite: "unkin",
        },
      ]),
    },
  ];

  const insert = db.prepare(
    `INSERT INTO users (id, email, password_hash, role, prenom, nom, universite, filiere, niveau, matricule, departement, service, cours_classes, created_at, updated_at)
     VALUES (@id, @email, @hash, @role, @prenom, @nom, @universite, @filiere, @niveau, @matricule, @departement, @service, @cours_classes, @now, @now)`
  );

  for (const u of users) {
    insert.run({
      id: u.id,
      email: u.email,
      hash,
      role: u.role,
      prenom: u.prenom,
      nom: u.nom,
      universite: u.universite,
      filiere: u.filiere || null,
      niveau: u.niveau || null,
      matricule: u.matricule || null,
      departement: u.departement || null,
      service: u.service || null,
      cours_classes: u.cours_classes || "[]",
      now,
    });
  }

  const prof = users.find((u) => u.role === "professeur");
  const docs = [
    {
      id: uuidv4(),
      title: "Syllabus — Introduction à l'économie",
      description: "Programme ECO101 — L2 Gestion",
      source: "professeur",
      author: "Dr. Mukendi",
      author_id: prof.id,
      media_category: "document",
      type: "PDF",
      audience_type: "ma_classe",
      universite: "unkin",
      filiere: "Sciences économiques — Gestion",
      niveau: "l2",
      course_code: "ECO101",
      course_name: "Introduction à l'économie",
      classe: "L2 Gestion — Groupe A",
      allow_reactions: 1,
    },
    {
      id: uuidv4(),
      title: "Calendrier examens — Campus",
      description: "Tous les étudiants UNIKIN",
      source: "administration",
      author: "Secrétariat",
      author_id: prof.id,
      media_category: "document",
      type: "PDF",
      audience_type: "campus",
      universite: "unkin",
      allow_reactions: 0,
    },
  ];

  const docInsert = db.prepare(
    `INSERT INTO documents (id, title, description, source, author, author_id, date, media_category, type, audience_type, universite, filiere, niveau, course_code, course_name, classe, allow_reactions, reactions, created_at, updated_at)
     VALUES (@id, @title, @description, @source, @author, @author_id, @date, @media_category, @type, @audience_type, @universite, @filiere, @niveau, @course_code, @course_name, @classe, @allow_reactions, '{}', @now, @now)`
  );

  for (const d of docs) {
    docInsert.run({ ...d, date: now.slice(0, 10), now });
  }

  console.log("[SAC] Base démo initialisée. Comptes : etu.demo@unikin.cd / prof.demo@unikin.cd — mot de passe:", DEMO_PASSWORD);
}
