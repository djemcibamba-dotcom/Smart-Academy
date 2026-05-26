import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth.js";
import { logAudit } from "../services/auditService.js";
import * as platform from "../services/platformService.js";

const router = Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "VERIFY_RATE_LIMIT", message: "Trop de vérifications. Réessayez plus tard." },
});

function handle(fn) {
  return async (req, res, next) => {
    try {
      const data = await fn(req, res);
      if (data !== undefined) res.json(data);
    } catch (e) {
      const code = e.message;
      if (code === "AUTH_REQUIRED") return res.status(401).json({ error: code });
      if (code === "FORBIDDEN" || code === "FORBIDDEN_CAMPUS")
        return res.status(403).json({ error: code, message: "Accès refusé." });
      if (code === "NOT_FOUND") return res.status(404).json({ error: code });
      next(e);
    }
  };
}

/* Public — vérification officielle diplôme */
router.post(
  "/diplomas/verify",
  verifyLimiter,
  handle((req) => {
    const { verificationCode, diplomaNumber } = req.body || {};
    if (!verificationCode || !diplomaNumber) {
      return { valid: false, message: "Code et numéro de diplôme requis." };
    }
    logAudit(req, { action: "verify_diploma", resource: "diploma", meta: { number: diplomaNumber.slice(0, 12) } });
    return platform.verifyDiploma(verificationCode, diplomaNumber);
  })
);

router.use(authenticate);

router.get(
  "/grades/me",
  handle((req) => {
    const u = req.user;
    if (u.role === "professeur") return platform.listGradesForProfessor(u.email, u.universite);
    return platform.listGradesForStudent(u.email, u.universite);
  })
);

router.post(
  "/grades",
  handle((req) => {
    const row = platform.upsertGrade(req.user, req.body);
    logAudit(req, { action: "upsert_grade", resource: "grade", resourceId: row.id, universite: req.body.universite });
    return { grade: row };
  })
);

router.get(
  "/library",
  handle((req) => {
    const items = platform.listLibrary(req.user.universite, req.user.role);
    return { items };
  })
);

router.post(
  "/library",
  handle((req) => {
    const item = platform.createLibraryItem(req.user, req.body);
    logAudit(req, { action: "create_library", resource: "library", resourceId: item.id, universite: item.universite });
    return { item };
  })
);

router.get(
  "/careers",
  handle((req) => {
    const scope = req.query.scope;
    const items = platform.listCareers(req.user.universite, scope);
    return { items };
  })
);

router.post(
  "/careers",
  handle((req) => {
    const item = platform.createCareerPost(req.user, req.body);
    logAudit(req, { action: "create_career", resource: "career", resourceId: item.id });
    return { item };
  })
);

router.get(
  "/courses",
  handle((req) => {
    const u = req.user;
    const items = platform.listCourses(u.universite, u.filiere, u.niveau);
    return { items };
  })
);

router.post(
  "/courses",
  handle((req) => {
    const item = platform.createCourse(req.user, req.body);
    logAudit(req, { action: "create_course", resource: "course", resourceId: item.id });
    return { item };
  })
);

router.post(
  "/courses/:id/enroll",
  handle((req) => {
    if (req.user.role !== "etudiant") throw new Error("FORBIDDEN");
    const enrollment = platform.enrollCourse(req.user.email, req.params.id);
    logAudit(req, { action: "enroll_course", resource: "course", resourceId: req.params.id });
    return { enrollment };
  })
);

router.get(
  "/social",
  handle((req) => {
    const u = req.user;
    const posts = platform.listSocialPosts(u.universite, u.filiere);
    return { posts };
  })
);

router.post(
  "/social",
  handle((req) => {
    const post = platform.createSocialPost(req.user, req.body);
    logAudit(req, { action: "create_social", resource: "social", resourceId: post.id });
    return { post };
  })
);

router.post(
  "/social/:id/like",
  handle((req) => {
    const result = platform.toggleSocialLike(req.params.id, req.user.email);
    return result;
  })
);

router.get(
  "/diplomas/me",
  handle((req) => {
    if (req.user.role !== "etudiant") throw new Error("FORBIDDEN");
    return { diplomas: platform.listDiplomasForStudent(req.user.email) };
  })
);

router.post(
  "/diplomas/issue",
  handle((req) => {
    const diploma = platform.issueDiploma(req.user, req.body);
    logAudit(req, { action: "issue_diploma", resource: "diploma", resourceId: diploma.id, universite: req.body.universite });
    return { diploma };
  })
);

router.post(
  "/orientation",
  handle((req) => {
    if (req.user.role !== "etudiant") throw new Error("FORBIDDEN");
    const advice = platform.getOrientationAdvice({
      filiere: req.body.filiere || req.user.filiere,
      niveau: req.body.niveau || req.user.niveau,
      universite: req.user.universite,
      interests: req.body.interests,
    });
    logAudit(req, { action: "orientation_ia", resource: "orientation", meta: { domain: advice.domain } });
    return { advice };
  })
);

export default router;
