import { verifyAccessToken } from "../utils/tokens.js";
import { findUserById, userToSession } from "../services/userService.js";

export function authenticate(req, res, next) {
  const token =
    req.cookies?.sac_access ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: "AUTH_REQUIRED", message: "Connexion requise" });
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = findUserById(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: "USER_NOT_FOUND" });
    }
    req.user = user;
    req.session = userToSession(user);
    next();
  } catch {
    return res.status(401).json({ error: "TOKEN_EXPIRED", message: "Session expirée" });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Accès refusé" });
    }
    next();
  };
}
