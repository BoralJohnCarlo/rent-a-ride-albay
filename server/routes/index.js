import inspectionSettingRoutes from './inspectionSettingRoutes.js';
import pendingVehicleRoutes from './pendingVehicleRoutes.js';
import express from "express";

import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import vehicleRoutes from "./vehicleRoutes.js";
import vehicleCategoryRoutes from "./vehicleCategoryRoutes.js";
import consignmentRoutes from "./consignmentRoutes.js";
import driverRoutes from "./driverRoutes.js";
import serviceLocationRoutes from "./serviceLocationRoutes.js";
import distanceFeeRuleRoutes from "./distanceFeeRuleRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import refundRoutes from "./refundRoutes.js";
import earlyReturnRoutes from "./earlyReturnRoutes.js";
import rentalRoutes from "./rentalRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import statisticsRoutes from "./statisticsRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import reviewRoutes from "./reviewRoutes.js";
import testimonialRoutes from "./testimonialRoutes.js";
import destinationRoutes from "./destinationRoutes.js";
import voucherRoutes from "./voucherRoutes.js";
import discountRoutes from "./discountRoutes.js";
import favoriteRoutes from "./favoriteRoutes.js";
import payoutRoutes from "./payoutRoutes.js";
import supportTicketRoutes from "./supportTicketRoutes.js";
import walletRoutes from "./walletRoutes.js";
import withdrawalRoutes from "./withdrawalRoutes.js";
import vehicleAvailabilityRequestRoutes from "./vehicleAvailabilityRequestRoutes.js";
import trackerRoutes from "./trackerRoutes.js";
import telemetryRoutes from "./telemetryRoutes.js";
import alertRoutes from "./alertRoutes.js";
import receiptRoutes from "./receiptRoutes.js";
import exportRoutes from "./exportRoutes.js";
import legalDocumentRoutes from "./legalDocumentRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/vehicles", vehicleRoutes);
router.use(
    "/vehicle-categories",
    vehicleCategoryRoutes
);
router.use(
    "/consignments",
    consignmentRoutes
);
router.use("/drivers", driverRoutes);
router.use(
    "/service-locations",
    serviceLocationRoutes
);
router.use(
    "/distance-fee-rules",
    distanceFeeRuleRoutes
);
router.use("/bookings", bookingRoutes);
router.use("/refunds", refundRoutes);
router.use("/early-returns", earlyReturnRoutes);
router.use("/rentals", rentalRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/statistics", statisticsRoutes);
router.use("/notifications", notificationRoutes);
router.use("/payments", paymentRoutes);
router.use("/settings", settingsRoutes);
router.use("/payouts", payoutRoutes);
router.use("/inspection-settings", inspectionSettingRoutes);
router.use("/reviews", reviewRoutes);
router.use("/testimonials", testimonialRoutes);
router.use("/destinations", destinationRoutes);
router.use("/vouchers", voucherRoutes);
router.use("/discounts", discountRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/pending-vehicles", pendingVehicleRoutes);
router.use(
    "/support-tickets",
    supportTicketRoutes
);
router.use("/wallet", walletRoutes);
router.use("/withdrawals", withdrawalRoutes);
router.use(
    "/availability-requests",
    vehicleAvailabilityRequestRoutes
);
router.use("/trackers", trackerRoutes);
router.use("/telemetry", telemetryRoutes);
router.use("/alerts", alertRoutes);
router.use("/receipts", receiptRoutes);
router.use("/exports", exportRoutes);
router.use("/legal-documents", legalDocumentRoutes);

export default router;