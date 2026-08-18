import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { childrenRouter } from "./routes/children.js";
import { tasksRouter } from "./routes/tasks.js";
import "./db.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/children", childrenRouter);
app.use("/api/tasks", tasksRouter);

app.listen(port, () => {
  console.log(`OnTrack API listening on http://localhost:${port}`);
});
