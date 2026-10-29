import express from "express";

import {
    discardDraft,
    getAdminView,
    getCurrent,
    getVersion,
    publish,
    saveDraft,
} from "../controllers/legalDocumentController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

/*
 * Settings → Terms & Policies. `:type` is one of LEGAL_DOCUMENT_TYPES
 * (booking-terms, partner-terms, terms-of-service).
 */
const router = express.Router();

router.get("/public/versions/:id", getVersion);
router.get("/public/:type", getCurrent);

router.use(protect);
router.use(authorize("admin"));

router.get("/:type", getAdminView);
router.put("/:type/draft", saveDraft);
router.delete("/:type/draft", discardDraft);
router.post("/:type/publish", publish);

export default router;
