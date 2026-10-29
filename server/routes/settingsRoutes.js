import express from "express";

import {
    getSettings,
    getPublicSettings,
    updateSettings,
    uploadHeroVideoCtrl,
    resetHeroVideoCtrl,
    uploadHeroImageCtrl,
    resetHeroImageCtrl,
} from "../controllers/settingsController.js";

import {
    uploadHeroImage,
    uploadHeroVideo,
} from "../middleware/uploadMiddleware.js";

import { updateSettingsValidator } from "../validators/settingsValidator.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public", getPublicSettings);

router.use(protect);
router.use(authorize("admin"));

router.get("/", getSettings);

router.put("/", updateSettingsValidator, updateSettings);

router.post("/hero-video", uploadHeroVideo, uploadHeroVideoCtrl);
router.delete("/hero-video", resetHeroVideoCtrl);

router.post("/hero-image", uploadHeroImage, uploadHeroImageCtrl);
router.delete("/hero-image", resetHeroImageCtrl);

export default router;
