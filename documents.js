import { Router } from "express";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { upload, verifyUploadedFile, MAX_FILES } from "../middleware/upload.js";
import {
  getDocumentsForStudent,
  getMyDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  addReaction,
  getDocumentById,
} from "../services/documentService.js";
import { SOURCE_BY_ROLE, studentSeesDocument } from "../utils/visibility.js";

const router = Router();
const PUBLISH_ROLES = ["professeur", "assistant", "universite"];

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user.role === "etudiant") {
      const student = {
        universite: req.user.universite,
        filiere: req.user.filiere,
        niveau: req.user.niveau,
        email: req.user.email,
      };
      return res.json({ documents: getDocumentsForStudent(student) });
    }
    if (PUBLISH_ROLES.includes(req.user.role)) {
      return res.json({ documents: getMyDocuments(req.user) });
    }
    res.json({ documents: [] });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const doc = getDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });

    if (req.user.role === "etudiant") {
      const student = {
        universite: req.user.universite,
        filiere: req.user.filiere,
        niveau: req.user.niveau,
      };
      if (!studentSeesDocument(student, doc)) {
        return res.status(403).json({ error: "FORBIDDEN" });
      }
    } else if (PUBLISH_ROLES.includes(req.user.role)) {
      const src = SOURCE_BY_ROLE[req.user.role];
      if (doc.source !== src && req.user.role !== "universite") {
        if (doc.authorId !== req.user.id) {
          return res.status(403).json({ error: "FORBIDDEN" });
        }
      }
    }

    res.json({ document: doc });
  })
);

async function handleCreate(req, res) {
    const uploaded = req.files?.length
      ? req.files
      : req.file
        ? [req.file]
        : [];
    const attachments = [];
    for (const f of uploaded) {
      await verifyUploadedFile(f.path);
      attachments.push({
        name: f.originalname,
        mediaPath: f.filename,
        mediaUrl: `/uploads/${f.filename}`,
        size: `${(f.size / 1024).toFixed(0)} Ko`,
        type: (f.mimetype || "").split("/")[1]?.toUpperCase() || "FILE",
      });
    }
    const primary = attachments[0];
    const mediaPath = primary?.mediaPath || null;

    const body = req.body || {};
    const data = {
      title: body.title,
      description: body.description,
      mediaCategory: body.mediaCategory,
      type: body.type,
      size: primary?.size || body.size,
      mediaUrl: primary?.mediaUrl || body.mediaUrl,
      mediaPath,
      attachments: attachments.length > 1 ? attachments.slice(1) : [],
      universite: body.universite,
      filiere: body.filiere,
      niveau: body.niveau,
      courseCode: body.courseCode,
      courseName: body.courseName,
      classe: body.classe,
      allowReactions: body.allowReactions === "true" || body.allowReactions === true,
      author: body.author || req.session.nom,
      audienceType: body.audienceType,
      sectionId: body.sectionId,
      sectionName: body.sectionName,
    };

    if (!data.title) {
      return res.status(400).json({ error: "TITLE_REQUIRED" });
    }

    const doc = createDocument(req.user, data);
    res.status(201).json({ document: doc });
}

router.post(
  "/",
  requireRoles(...PUBLISH_ROLES),
  (req, res, next) => {
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      return upload.array("files", MAX_FILES)(req, res, (err) => {
        if (err) return next(err);
        handleCreate(req, res).catch(next);
      });
    }
    handleCreate(req, res).catch(next);
  }
);

router.patch(
  "/:id",
  requireRoles(...PUBLISH_ROLES),
  asyncHandler(async (req, res) => {
    try {
      const doc = updateDocument(req.user, req.params.id, req.body || {});
      res.json({ document: doc });
    } catch (e) {
      if (e.message === "FORBIDDEN") {
        return res.status(403).json({ error: "FORBIDDEN" });
      }
      throw e;
    }
  })
);

router.delete(
  "/:id",
  requireRoles(...PUBLISH_ROLES),
  asyncHandler(async (req, res) => {
    try {
      deleteDocument(req.user, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      if (e.message === "FORBIDDEN") {
        return res.status(403).json({ error: "FORBIDDEN" });
      }
      throw e;
    }
  })
);

router.post(
  "/:id/reactions",
  requireRoles("etudiant"),
  asyncHandler(async (req, res) => {
    const { type } = req.body || {};
    try {
      const doc = addReaction(req.params.id, type, req.user.id);
      res.json({ document: doc });
    } catch (e) {
      if (e.message === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
      if (e.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      throw e;
    }
  })
);

export default router;
