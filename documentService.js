import { v4 as uuidv4 } from "uuid";
import { getDb, rowToDocument } from "../db/database.js";
import {
  cleanText,
  cleanMediaCategory,
  cleanNiveau,
  cleanReactionType,
} from "../utils/sanitize.js";
import { studentSeesDocument, SOURCE_BY_ROLE } from "../utils/visibility.js";

export function getAllDocuments() {
  const rows = getDb()
    .prepare("SELECT * FROM documents ORDER BY created_at DESC")
    .all();
  return rows.map(rowToDocument);
}

export function getDocumentById(id) {
  const row = getDb().prepare("SELECT * FROM documents WHERE id = ?").get(id);
  return rowToDocument(row);
}

export function getDocumentsForStudent(student) {
  return getAllDocuments().filter((d) => studentSeesDocument(student, d));
}

export function getMyDocuments(user) {
  const source = SOURCE_BY_ROLE[user.role];
  if (!source) return [];
  if (user.role === "universite") {
    return getAllDocuments().filter((d) => d.source === "administration");
  }
  return getAllDocuments().filter(
    (d) => d.source === source && d.authorId === user.id
  );
}

export function canEdit(user, doc) {
  if (!user || !doc) return false;
  if (user.role === "universite") return doc.source === "administration";
  const src = SOURCE_BY_ROLE[user.role];
  return src === doc.source && doc.authorId === user.id;
}

export function createDocument(user, data) {
  const source = SOURCE_BY_ROLE[user.role];
  if (!source) throw new Error("FORBIDDEN");

  const isCampus = user.role === "universite";
  const isSection = data.audienceType === "section" && data.sectionId;
  const id = uuidv4();
  const now = new Date().toISOString();
  const audienceType = isSection ? "section" : isCampus ? "campus" : "ma_classe";

  getDb()
    .prepare(
      `INSERT INTO documents (
        id, title, description, source, author, author_id, date,
        media_category, type, size, media_url, media_path, attachments, audience_type,
        section_id, section_name, universite, filiere, niveau, course_code, course_name, classe,
        allow_reactions, reactions, created_at, updated_at
      ) VALUES (
        @id, @title, @description, @source, @author, @author_id, @date,
        @media_category, @type, @size, @media_url, @media_path, @attachments, @audience_type,
        @section_id, @section_name, @universite, @filiere, @niveau, @course_code, @course_name, @classe,
        @allow_reactions, @reactions, @created_at, @updated_at
      )`
    )
    .run({
      id,
      title: cleanText(data.title, 300),
      description: cleanText(data.description, 5000),
      source,
      author: cleanText(data.author, 150) || user.email,
      author_id: user.id,
      date: now.slice(0, 10),
      media_category: cleanMediaCategory(data.mediaCategory),
      type: cleanText(data.type, 20) || "PDF",
      size: cleanText(data.size, 30) || "—",
      media_url: data.mediaUrl && !String(data.mediaUrl).startsWith("data:")
        ? cleanText(data.mediaUrl, 2000)
        : "",
      media_path: data.mediaPath || null,
      attachments: JSON.stringify(data.attachments || []),
      audience_type: audienceType,
      section_id: isSection ? cleanText(data.sectionId, 80) : null,
      section_name: isSection ? cleanText(data.sectionName, 200) : null,
      universite: cleanText(data.universite || user.universite, 50),
      filiere: cleanText(data.filiere, 200),
      niveau: cleanNiveau(data.niveau) || data.niveau,
      course_code: cleanText(data.courseCode, 30),
      course_name: cleanText(data.courseName, 200),
      classe: cleanText(data.classe, 150),
      allow_reactions: isCampus ? 0 : data.allowReactions ? 1 : 0,
      reactions: JSON.stringify({ useful: [], question: [], thanks: [] }),
      created_at: now,
      updated_at: now,
    });

  return getDocumentById(id);
}

export function updateDocument(user, id, data) {
  const doc = getDocumentById(id);
  if (!doc || !canEdit(user, doc)) throw new Error("FORBIDDEN");

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE documents SET
        title = COALESCE(@title, title),
        description = COALESCE(@description, description),
        media_category = COALESCE(@media_category, media_category),
        type = COALESCE(@type, type),
        size = COALESCE(@size, size),
        media_url = COALESCE(@media_url, media_url),
        filiere = COALESCE(@filiere, filiere),
        niveau = COALESCE(@niveau, niveau),
        course_code = COALESCE(@course_code, course_code),
        course_name = COALESCE(@course_name, course_name),
        classe = COALESCE(@classe, classe),
        allow_reactions = COALESCE(@allow_reactions, allow_reactions),
        updated_at = @updated_at
      WHERE id = @id`
    )
    .run({
      id,
      title: data.title != null ? cleanText(data.title, 300) : null,
      description:
        data.description != null ? cleanText(data.description, 5000) : null,
      media_category:
        data.mediaCategory != null
          ? cleanMediaCategory(data.mediaCategory)
          : null,
      type: data.type != null ? cleanText(data.type, 20) : null,
      size: data.size != null ? cleanText(data.size, 30) : null,
      media_url:
        data.mediaUrl != null && !String(data.mediaUrl).startsWith("data:")
          ? cleanText(data.mediaUrl, 2000)
          : data.mediaUrl === ""
            ? ""
            : null,
      filiere: data.filiere != null ? cleanText(data.filiere, 200) : null,
      niveau: data.niveau != null ? cleanNiveau(data.niveau) || data.niveau : null,
      course_code:
        data.courseCode != null ? cleanText(data.courseCode, 30) : null,
      course_name:
        data.courseName != null ? cleanText(data.courseName, 200) : null,
      classe: data.classe != null ? cleanText(data.classe, 150) : null,
      allow_reactions:
        data.allowReactions != null ? (data.allowReactions ? 1 : 0) : null,
      updated_at: now,
    });

  return getDocumentById(id);
}

export function deleteDocument(user, id) {
  const doc = getDocumentById(id);
  if (!doc || !canEdit(user, doc)) throw new Error("FORBIDDEN");
  getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
  return true;
}

export function addReaction(docId, type, studentId) {
  const reactionType = cleanReactionType(type);
  if (!reactionType) throw new Error("INVALID_REACTION");

  const doc = getDocumentById(docId);
  if (!doc) throw new Error("NOT_FOUND");
  if (
    !doc.allowReactions ||
    (doc.source !== "professeur" && doc.source !== "assistant")
  ) {
    throw new Error("FORBIDDEN");
  }

  const reactions = doc.reactions || { useful: [], question: [], thanks: [] };
  ["useful", "question", "thanks"].forEach((t) => {
    reactions[t] = (reactions[t] || []).filter((id) => id !== studentId);
  });
  if (!reactions[reactionType].includes(studentId)) {
    reactions[reactionType].push(studentId);
  }

  getDb()
    .prepare("UPDATE documents SET reactions = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(reactions), new Date().toISOString(), docId);

  return getDocumentById(docId);
}
