import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
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

authRouter.post("/signup", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await pool.query<{ id: number }>(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'parent') RETURNING id",
    [name, email, passwordHash]
  );
  const id = result.rows[0].id;

  const token = signToken({ id, role: "parent" });
  res.status(201).json({ token, user: { id, name, email, role: "parent" } });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const result = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
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
