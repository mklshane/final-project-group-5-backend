import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { syncRequestSchema } from "../schemas/sync.schema.js";
import { handleSync, handleSyncStatus } from "../controllers/sync.controller.js";

const router = Router();

router.post("/", auth, validate(syncRequestSchema), handleSync);
router.get("/status", auth, handleSyncStatus);

export default router;
