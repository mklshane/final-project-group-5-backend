export function adminGuard(req, res, next) {
  if (req.userProfile?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
