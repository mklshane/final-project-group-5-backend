import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { adminGuard } from "../middleware/adminGuard.js";
import {
  getUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
  getAnalytics,
} from "../controllers/admin.controller.js";

const router = Router();

router.use(auth, adminGuard);

router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id", updateUserStatus);
router.delete("/users/:id", deleteUser);
router.get("/analytics", getAnalytics);

export default router;
