// Use on any route that reads or writes a user's own data. After it runs,
// req.user._id is the logged-in user's ObjectId.
export function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Log in to continue." });
}
