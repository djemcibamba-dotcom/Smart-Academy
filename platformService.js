import { getDb } from "../db/database.js";
import {
  uid,
  signDiploma,
  generateVerificationCode,
  generateDiplomaNumber,
  assertCampusAccess,
} from "../utils/platformSecurity.js";

const now = () => new Date().toISOString();

/* ── Grades ── */
export function listGradesForStudent(email, universite) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM grades WHERE student_email = ? COLLATE NOCASE AND universite = ? ORDER BY semester DESC, course_name`
    )
    .all(email, universite)
    .map(rowToGrade);
}

export function listGradesForProfessor(profEmail, universite) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM grades WHERE professor_email = ? COLLATE NOCASE AND universite = ? ORDER BY updated_at DESC`
    )
    .all(profEmail, universite)
    .map(rowToGrade);
}

export function upsertGrade(user, data) {
  assertCampusAccess(user, data.universite);
  if (user.role !== "professeur" && user.role !== "universite") throw new Error("FORBIDDEN");
  const db = getDb();
  const id = data.id || uid("grd");
  const ts = now();
  const avg = Math.round((Number(data.cc) + Number(data.exam)) / 2 * 10) / 10;
  const status = avg >= 10 ? "Validé" : "Rattrapage";
  const existing = db.prepare("SELECT id FROM grades WHERE id = ?").get(id);
  if (existing) {
    db.prepare(
      `UPDATE grades SET cc=?, exam=?, avg=?, status=?, updated_at=? WHERE id=? AND professor_email=? COLLATE NOCASE`
    ).run(data.cc, data.exam, avg, status, ts, id, user.email);
  } else {
    db.prepare(
      `INSERT INTO grades (id, student_email, student_matricule, professor_email, universite, filiere, niveau, semester, course_code, course_name, classe, credits, cc, exam, avg, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      data.studentEmail,
      data.studentMatricule || null,
      user.email,
      data.universite,
      data.filiere || null,
      data.niveau || null,
      data.semester,
      data.courseCode,
      data.courseName,
      data.classe || null,
      data.credits || 3,
      data.cc,
      data.exam,
      avg,
      status,
      ts,
      ts
    );
  }
  return { ...data, id, avg, status, updatedAt: ts };
}

function rowToGrade(r) {
  return {
    id: r.id,
    studentEmail: r.student_email,
    studentMatricule: r.student_matricule,
    professorEmail: r.professor_email,
    universite: r.universite,
    filiere: r.filiere,
    niveau: r.niveau,
    semester: r.semester,
    courseCode: r.course_code,
    courseName: r.course_name,
    classe: r.classe,
    credits: r.credits,
    cc: r.cc,
    exam: r.exam,
    avg: r.avg,
    status: r.status,
    updatedAt: r.updated_at,
  };
}

/* ── Library ── */
export function listLibrary(universite, role) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM library_items WHERE universite = ? AND published = 1 ORDER BY title`
    )
    .all(universite);
  return rows.filter((r) => {
    try {
      const roles = JSON.parse(r.access_roles || "[]");
      return roles.includes(role);
    } catch {
      return true;
    }
  }).map(rowToLibrary);
}

export function createLibraryItem(user, data) {
  const uni = assertCampusAccess(user, data.universite);
  if (!["universite", "professeur", "assistant"].includes(user.role)) throw new Error("FORBIDDEN");
  const db = getDb();
  const id = uid("lib");
  const ts = now();
  db.prepare(
    `INSERT INTO library_items (id, universite, title, author, category, description, file_url, cover_url, year, language, access_roles, published, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    uni,
    data.title,
    data.author || "",
    data.category || "ouvrage",
    data.description || "",
    data.fileUrl || "",
    data.coverUrl || "",
    data.year || null,
    data.language || "fr",
    JSON.stringify(data.accessRoles || ["etudiant", "professeur", "assistant"]),
    data.published !== false ? 1 : 0,
    user.email,
    ts,
    ts
  );
  return { id, ...data, universite: uni, createdAt: ts };
}

function rowToLibrary(r) {
  return {
    id: r.id,
    universite: r.universite,
    title: r.title,
    author: r.author,
    category: r.category,
    description: r.description,
    fileUrl: r.file_url,
    coverUrl: r.cover_url,
    year: r.year,
    language: r.language,
    accessRoles: JSON.parse(r.access_roles || "[]"),
    published: !!r.published,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

/* ── Careers ── */
export function listCareers(universite, scopeFilter) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM career_posts WHERE published = 1 AND (universite = ? OR scope = 'national') ORDER BY created_at DESC`
    )
    .all(universite);
  if (scopeFilter === "national") return rows.filter((r) => r.scope === "national").map(rowToCareer);
  return rows.map(rowToCareer);
}

export function createCareerPost(user, data) {
  const uni = assertCampusAccess(user, data.universite || user.universite);
  if (!["universite", "professeur", "assistant"].includes(user.role)) throw new Error("FORBIDDEN");
  const db = getDb();
  const id = uid("job");
  const ts = now();
  db.prepare(
    `INSERT INTO career_posts (id, universite, scope, type, title, organization, location, description, requirements, deadline, contact_email, published, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    uni,
    data.scope || "campus",
    data.type,
    data.title,
    data.organization,
    data.location || "",
    data.description,
    data.requirements || "",
    data.deadline || null,
    data.contactEmail || null,
    1,
    user.email,
    ts,
    ts
  );
  return { id, ...data, universite: uni, createdAt: ts };
}

function rowToCareer(r) {
  return {
    id: r.id,
    universite: r.universite,
    scope: r.scope,
    type: r.type,
    title: r.title,
    organization: r.organization,
    location: r.location,
    description: r.description,
    requirements: r.requirements,
    deadline: r.deadline,
    contactEmail: r.contact_email,
    createdAt: r.created_at,
  };
}

/* ── Online courses ── */
export function listCourses(universite, filiere, niveau) {
  const db = getDb();
  let q = `SELECT * FROM online_courses WHERE universite = ? AND published = 1`;
  const params = [universite];
  if (filiere) {
    q += ` AND (filiere IS NULL OR filiere = ?)`;
    params.push(filiere);
  }
  if (niveau) {
    q += ` AND (niveau IS NULL OR niveau = ?)`;
    params.push(niveau);
  }
  return db.prepare(q).all(...params).map(rowToCourse);
}

export function enrollCourse(studentEmail, courseId) {
  const db = getDb();
  const course = db.prepare("SELECT id, universite FROM online_courses WHERE id = ?").get(courseId);
  if (!course) throw new Error("NOT_FOUND");
  const id = uid("enr");
  const ts = now();
  try {
    db.prepare(
      `INSERT INTO course_enrollments (id, course_id, student_email, progress, enrolled_at) VALUES (?,?,?,?,?)`
    ).run(id, courseId, studentEmail, 0, ts);
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return { courseId, studentEmail, progress: 0 };
    throw e;
  }
  return { id, courseId, studentEmail, progress: 0, enrolledAt: ts };
}

export function createCourse(user, data) {
  assertCampusAccess(user, data.universite);
  if (user.role !== "professeur" && user.role !== "universite") throw new Error("FORBIDDEN");
  const db = getDb();
  const id = uid("crs");
  const ts = now();
  db.prepare(
    `INSERT INTO online_courses (id, universite, professor_email, title, description, filiere, niveau, modules, published, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    data.universite,
    user.email,
    data.title,
    data.description || "",
    data.filiere || null,
    data.niveau || null,
    JSON.stringify(data.modules || []),
    data.published ? 1 : 0,
    ts,
    ts
  );
  return { id, ...data, professorEmail: user.email, createdAt: ts };
}

function rowToCourse(r) {
  return {
    id: r.id,
    universite: r.universite,
    professorEmail: r.professor_email,
    title: r.title,
    description: r.description,
    filiere: r.filiere,
    niveau: r.niveau,
    modules: JSON.parse(r.modules || "[]"),
    published: !!r.published,
    createdAt: r.created_at,
  };
}

/* ── Social ── */
export function listSocialPosts(universite, filiere, limit = 50) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM social_posts WHERE universite = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(universite, limit);
  return rows
    .filter((r) => r.audience !== "filiere" || !filiere || r.filiere === filiere)
    .map(rowToSocial);
}

export function createSocialPost(user, data) {
  const uni = assertCampusAccess(user, data.universite || user.universite);
  if (!["etudiant", "professeur", "assistant"].includes(user.role)) throw new Error("FORBIDDEN");
  const db = getDb();
  const id = uid("soc");
  const ts = now();
  const name = [user.prenom, user.nom].filter(Boolean).join(" ") || user.email;
  db.prepare(
    `INSERT INTO social_posts (id, universite, author_email, author_name, author_role, content, media_url, audience, filiere, likes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    uni,
    user.email,
    name,
    user.role,
    String(data.content || "").slice(0, 2000),
    data.mediaUrl || null,
    data.audience || "campus",
    data.filiere || user.filiere || null,
    "[]",
    ts,
    ts
  );
  return rowToSocial(
    db.prepare("SELECT * FROM social_posts WHERE id = ?").get(id)
  );
}

export function toggleSocialLike(postId, userEmail) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM social_posts WHERE id = ?").get(postId);
  if (!row) throw new Error("NOT_FOUND");
  let likes = [];
  try {
    likes = JSON.parse(row.likes || "[]");
  } catch {
    likes = [];
  }
  const idx = likes.indexOf(userEmail);
  if (idx >= 0) likes.splice(idx, 1);
  else likes.push(userEmail);
  db.prepare("UPDATE social_posts SET likes = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(likes),
    now(),
    postId
  );
  return { postId, likes };
}

function rowToSocial(r) {
  return {
    id: r.id,
    universite: r.universite,
    authorEmail: r.author_email,
    authorName: r.author_name,
    authorRole: r.author_role,
    content: r.content,
    mediaUrl: r.media_url,
    audience: r.audience,
    filiere: r.filiere,
    likes: JSON.parse(r.likes || "[]"),
    createdAt: r.created_at,
  };
}

/* ── Diplomas ── */
export function issueDiploma(user, data) {
  if (user.role !== "universite") throw new Error("FORBIDDEN");
  const campus = data.universite || user.universite || user.nomUniversite || user.codeUni;
  const uni = assertCampusAccess(user, campus);
  const db = getDb();
  const id = uid("dip");
  const ts = now();
  const year = data.graduationYear || new Date().getFullYear();
  const diplomaNumber = data.diplomaNumber || generateDiplomaNumber(uni, year);
  const verificationCode = generateVerificationCode();
  const payload = {
    diplomaNumber,
    studentEmail: data.studentEmail,
    matricule: data.matricule,
    universite: uni,
    graduationYear: year,
    filiere: data.filiere,
  };
  const hashSignature = signDiploma(payload);
  db.prepare(
    `INSERT INTO diplomas (id, universite, student_email, student_name, matricule, filiere, niveau, diploma_type, graduation_year, diploma_number, verification_code, hash_signature, status, issued_by, issued_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    uni,
    data.studentEmail,
    data.studentName,
    data.matricule,
    data.filiere,
    data.niveau,
    data.diplomaType || "Licence",
    year,
    diplomaNumber,
    verificationCode,
    hashSignature,
    "actif",
    user.email,
    ts,
    ts
  );
  return {
    id,
    diplomaNumber,
    verificationCode,
    hashSignature: hashSignature.slice(0, 16) + "…",
    status: "actif",
    issuedAt: ts,
  };
}

export function verifyDiploma(code, number) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM diplomas WHERE verification_code = ? COLLATE NOCASE AND diploma_number = ? COLLATE NOCASE`
    )
    .get(code.trim(), number.trim());
  if (!row) return { valid: false, message: "Aucun diplôme correspondant." };
  if (row.status !== "actif") {
    return {
      valid: false,
      message: `Diplôme ${row.status}. Contactez l'établissement.`,
      status: row.status,
    };
  }
  const check = signDiploma({
    diplomaNumber: row.diploma_number,
    studentEmail: row.student_email,
    matricule: row.matricule,
    universite: row.universite,
    graduationYear: row.graduation_year,
    filiere: row.filiere,
  });
  if (check !== row.hash_signature) {
    return { valid: false, message: "Signature cryptographique invalide." };
  }
  return {
    valid: true,
    diploma: {
      studentName: row.student_name,
      matricule: row.matricule,
      universite: row.universite,
      filiere: row.filiere,
      niveau: row.niveau,
      diplomaType: row.diploma_type,
      graduationYear: row.graduation_year,
      diplomaNumber: row.diploma_number,
      issuedAt: row.issued_at,
      status: row.status,
    },
  };
}

export function listDiplomasForStudent(email) {
  const db = getDb();
  return db
    .prepare(`SELECT id, diploma_number, verification_code, status, issued_at, universite, diploma_type, graduation_year FROM diplomas WHERE student_email = ? COLLATE NOCASE`)
    .all(email)
    .map((r) => ({
      id: r.id,
      diplomaNumber: r.diploma_number,
      verificationCode: r.verification_code,
      status: r.status,
      issuedAt: r.issued_at,
      universite: r.universite,
      diplomaType: r.diploma_type,
      graduationYear: r.graduation_year,
    }));
}

/* ── AI orientation (rule-based) ── */
const ORIENTATION_DB = {
  informatique: {
    filieres: ["Informatique", "Génie logiciel", "Réseaux"],
    stages: ["Développeur junior", "Admin réseau", "Support IT"],
    skills: ["Programmation", "Bases de données", "Anglais technique"],
  },
  medecine: {
    filieres: ["Médecine", "Sciences infirmières", "Santé publique"],
    stages: ["Hôpital", "ONG santé", "Laboratoire"],
    skills: ["Biologie", "Éthique", "Communication patient"],
  },
  droit: {
    filieres: ["Droit", "Sciences politiques"],
    stages: ["Cabinet juridique", "ONG", "Administration publique"],
    skills: ["Argumentation", "Droit congolais", "Rédaction"],
  },
  commerce: {
    filieres: ["Gestion", "Comptabilité", "Marketing"],
    stages: ["Banque", "Audit", "PME"],
    skills: ["Excel", "Comptabilité", "Négociation"],
  },
};

export function getOrientationAdvice(profile) {
  const filiere = (profile.filiere || "").toLowerCase();
  let key = "commerce";
  if (/info|logiciel|réseau|data/i.test(filiere)) key = "informatique";
  else if (/médec|santé|infirm/i.test(filiere)) key = "medecine";
  else if (/droit|jurid|polit/i.test(filiere)) key = "droit";

  const pack = ORIENTATION_DB[key];
  const niveau = profile.niveau || "L1";
  const nextLevel =
    niveau === "L1" ? "L2" : niveau === "L2" ? "L3" : niveau === "L3" ? "Master" : "Doctorat";

  return {
    domain: key,
    recommendedFilieres: pack.filieres,
    suggestedInternships: pack.stages,
    skillsToDevelop: pack.skills,
    academicPath: `Vous êtes en ${niveau}. Prochaine étape conseillée : ${nextLevel}.`,
    message: `Orientation personnalisée pour ${profile.filiere || "votre filière"} à ${profile.universite || "votre université"}. Consultez aussi le service orientation de votre campus.`,
    disclaimer: "Conseil indicatif — ne remplace pas un conseiller académique officiel.",
  };
}
