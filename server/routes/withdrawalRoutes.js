import express from "express";

import {
    create,
    getMine,
    getAll,
    webhook,
} from "../controllers/withdrawalController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Webhook Routes (No Auth)
|--------------------------------------------------------------------------
*/

router.post(
    "/webhooks/xendit-payout",
    webhook
);

router.use(protect);

// Operator routes
router.post("/", authorize("operator"), create);
router.get("/mine", authorize("operator"), getMine);

// Admin routes
router.get("/", authorize("admin"), getAll);

export default router;
