import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth.js";

export const childrenRouter = Router();

childrenRouter.use(requireAuth);

childrenRouter.get("/", async (req: AuthedRequest, res) => {
  if (req.user!.role !== "parent") {
    res.status(403).json({ error: "Only parents have children" });
    return;
  }
  const result = await pool.query("SELECT id, name, email FROM users WHERE parent_id = $1", [req.user!.id]);
  res.json({ children: result.rows });
});

childrenRouter.post("/", async (req: AuthedRequest, res) => {
  if (req.user!.role !== "parent") {
    res.status(403).json({ error: "Only parents can add children" });
    return;
  }
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }

  const existing = await pool.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE email = $1",
    [email]
  );
  if (existing.rows.some((row) => bcrypt.compareSync(password, row.password_hash))) {
    res.status(409).json({ error: "An account with this email and password already exists" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await pool.query<{ id: number }>(
    "INSERT INTO users (name, email, password_hash, role, parent_id) VALUES ($1, $2, $3, 'child', $4) RETURNING id",
    [name, email, passwordHash, req.user!.id]
  );

  res.status(201).json({ id: result.rows[0].id, name, email });
});
