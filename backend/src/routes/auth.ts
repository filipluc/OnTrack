import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { signToken } from "../auth.js";

export const authRouter = Router();

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: "parent" | "child";
  parent_id: number | null;
}

authRouter.post("/signup", (req, res) => {
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
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'parent')")
    .run(name, email, passwordHash);

  const token = signToken({ id: result.lastInsertRowid as number, role: "parent" });
  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, name, email, role: "parent" },
  });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ id: user.id, role: user.role });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, parentId: user.parent_id },
  });
});
