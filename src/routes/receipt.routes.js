import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { parseReceiptSchema } from "../schemas/receipt.schema.js";
import { handleParseReceipt } from "../controllers/receipt.controller.js";

const router = Router();

router.post("/parse", auth, validate(parseReceiptSchema), handleParseReceipt);

export default router;
