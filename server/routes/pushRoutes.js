import express from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";
import { getPushConfig, getPushStatus, subscribePush, unsubscribePush } from "../controllers/pushController.js";

const router = express.Router();
router.use(protect);
const pushLimit = rateLimit({
    windowMs: 60_000, limit: 20,
    keyGenerator: (req) => String(req.user._id),
    message: { message: "Too many notification changes. Please try again in a minute." },
});
router.get("/config", getPushConfig);
router.post("/status", getPushStatus);
router.post("/subscription", pushLimit, subscribePush);
router.delete("/subscription", pushLimit, unsubscribePush);
export default router;
