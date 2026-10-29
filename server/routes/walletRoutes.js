import express from "express";

import {
    getMyWallet,
    getOperatorWallet,
} from "../controllers/walletController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
    "/",
    protect,
    authorize("operator"),
    getMyWallet
);

router.get(
    "/:operatorId",
    protect,
    authorize("admin"),
    getOperatorWallet
);

export default router;
