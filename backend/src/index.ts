import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { childrenRouter } from "./routes/children.js";
import { tasksRouter } from "./routes/tasks.js";
import { initSchema } from "./db.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/children", childrenRouter);
app.use("/api/tasks", tasksRouter);

initSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`OnTrack API listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database schema", err);
    process.exit(1);
  });
