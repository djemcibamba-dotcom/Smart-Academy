import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import {
  getCampusTariffsForUniversity,
  getCampusFee,
  updateUniversityCampusTariffs,
  validateTariffsPayload,
} from "../services/tariffService.js";

const router = Router();

const ERROR_MAP = {
  INVALID_TARIFF_AMOUNT: {
    status: 400,
    message: "Montant invalide (entre 0,50 et 500 USD)",
  },
  INVALID_TARIFFS: {
    status: 400,
    message: "Tarifs invalides",
  },
  FORBIDDEN: { status: 403, message: "Accès réservé aux universités partenaires" },
};

function mapError(err, res) {
  const mapped = ERROR_MAP[err.message];
  if (mapped) {
    return res.status(mapped.status).json({ error: err.message, message: mapped.message });
  }
  throw err;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const universite = String(req.query.universite || "").trim();
    const role = String(req.query.role || "").trim();
    if (!universite) {
      return res.status(400).json({ error: "MISSING_UNIVERSITE" });
    }
    if (role) {
      const fee = getCampusFee(universite, role);
      return res.json({ ok: true, universite, role, fee });
    }
    const pack = getCampusTariffsForUniversity(universite);
    res.json({ ok: true, ...pack });
  })
);

router.patch(
  "/campus",
  authenticate,
  requireRoles("universite"),
  asyncHandler(async (req, res) => {
    try {
      const partial = validateTariffsPayload(req.body?.tariffs || req.body);
      const pack = updateUniversityCampusTariffs(req.user.id, partial);
      res.json({
        ok: true,
        ...pack,
        membersUpdated: pack.membersUpdated ?? 0,
      });
    } catch (e) {
      mapError(e, res);
    }
  })
);

export default router;
