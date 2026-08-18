import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth.js";

export const childrenRouter = Router();

childrenRouter.use(requireAuth);

childrenRouter.get("/", (req: AuthedRequest, res) => {
  if (req.user!.role !== "parent") {
    res.status(403).json({ error: "Only parents have children" });
    return;
  }
  const children = db
    .prepare("SELECT id, name, email FROM users WHERE parent_id = ?")
    .all(req.user!.id);
  res.json({ children });
});

childrenRouter.post("/", (req: AuthedRequest, res) => {
  if (req.user!.role !== "parent") {
    res.status(403).json({ error: "Only parents can add children" });
    return;
  }
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role, parent_id) VALUES (?, ?, ?, 'child', ?)")
    .run(name, email, passwordHash, req.user!.id);

  res.status(201).json({ id: result.lastInsertRowid, name, email });
});
