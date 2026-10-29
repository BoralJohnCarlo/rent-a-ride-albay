import { body } from "express-validator";

export const updateSettingsValidator = [
    body("allowOnlyDefaultLocation")
        .optional()
        .isBoolean()
        .withMessage(
            "allowOnlyDefaultLocation must be a boolean."
        ),

    body("enableDistanceFeeCalculation")
        .optional()
        .isBoolean()
        .withMessage(
            "enableDistanceFeeCalculation must be a boolean."
        ),

    body("penaltySettings.gracePeriodMinutes")
        .optional()
        .isInt({ min: 0 })
        .withMessage(
            "gracePeriodMinutes must be a non-negative integer."
        ),

    body("penaltySettings.chargingUnit")
        .optional()
        .isIn(["Hour", "Day"])
        .withMessage(
            "chargingUnit must be either Hour or Day."
        ),

    body("penaltySettings.rateType")
        .optional()
        .isIn([
            "derived",
            "custom",
            "multiplier",
        ])
        .withMessage(
            "rateType must be derived, custom, or multiplier."
        ),

    body("penaltySettings.customRate")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "customRate must be a non-negative number."
        ),

    body("penaltySettings.rateMultiplier")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "rateMultiplier must be a non-negative number."
        ),

    body("penaltySettings.maximumCap")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "maximumCap must be a non-negative number."
        ),

    body("penaltySettings.autoApply")
        .optional()
        .isBoolean()
        .withMessage(
            "autoApply must be a boolean."
        ),

    body("refundSettings.requireCancellationReason")
        .optional()
        .isBoolean()
        .withMessage(
            "requireCancellationReason must be a boolean."
        ),

    body("refundSettings.autoApproveRefundThreshold")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "autoApproveRefundThreshold must be a non-negative number."
        ),

    body("refundSettings.gracePeriodHours")
        .optional()
        .isInt({ min: 0, max: 72 })
        .withMessage(
            "gracePeriodHours must be an integer between 0 and 72."
        ),

    body("refundSettings.cancellationPolicy.fullRefundBeforeApproval")
        .optional()
        .isBoolean()
        .withMessage(
            "fullRefundBeforeApproval must be a boolean."
        ),

    body("refundSettings.cancellationPolicy.approvalGraceHours")
        .optional()
        .isInt({ min: 0, max: 168 })
        .withMessage(
            "approvalGraceHours must be a whole number between 0 and 168."
        ),

    body("refundSettings.cancellationPolicy.approvalGraceMinLeadHours")
        .optional()
        .isInt({ min: 0, max: 720 })
        .withMessage(
            "approvalGraceMinLeadHours must be a whole number between 0 and 720."
        ),

    body("refundSettings.cancellationPolicy.tiers")
        .optional()
        .isArray({ max: 6 })
        .withMessage(
            "tiers must be a list of at most 6 entries."
        ),

    body("refundSettings.cancellationPolicy.tiers.*.hoursBefore")
        .isInt({ min: 1, max: 720 })
        .withMessage(
            "Each tier's hours must be a whole number between 1 and 720."
        ),

    body("refundSettings.cancellationPolicy.tiers.*.refundPercent")
        .isInt({ min: 0, max: 100 })
        .withMessage(
            "Each tier's refund percentage must be a whole number between 0 and 100."
        ),

    body("earlyReturnSettings.enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "earlyReturnSettings.enabled must be a boolean."
        ),

    body("earlyReturnSettings.autoApprove")
        .optional()
        .isBoolean()
        .withMessage(
            "earlyReturnSettings.autoApprove must be a boolean."
        ),

    body("earlyReturnSettings.voucherValidityMonths")
        .optional()
        .isInt({ min: 6, max: 12 })
        .withMessage(
            "voucherValidityMonths must be an integer between 6 and 12."
        ),

    body("earlyReturnSettings.minUnusedDaysToQualify")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "minUnusedDaysToQualify must be a positive integer."
        ),

    body("bookingSettings.turnaroundBufferMinutes")
        .optional()
        .isInt({ min: 120, max: 1440 })
        .withMessage(
            "turnaroundBufferMinutes must be a whole number of minutes between 120 and 1440."
        ),

    body("driverAssignmentSettings.requireAdminDriverAssignment")
        .optional()
        .isBoolean({ strict: true })
        .withMessage(
            "requireAdminDriverAssignment must be true or false."
        ),

    body("driverAssignmentSettings.motorcycleDriversEnabled")
        .optional()
        .isBoolean({ strict: true })
        .withMessage(
            "motorcycleDriversEnabled must be true or false."
        ),

    body("driverPricingSettings.mode")
        .optional()
        .isIn(["global", "individual"])
        .withMessage(
            "Driver pricing mode must be 'global' or 'individual'."
        ),

    body("driverPricingSettings.globalDailyRate")
        .optional()
        .isFloat({ min: 0, max: 1000000 })
        .withMessage(
            "The global driver rate must be a number from 0 to 1,000,000."
        )
        .toFloat(),

    body("customerBookingSettings.maxConcurrentBookings")
        .optional()
        .isInt({ min: 0 })
        .withMessage(
            "maxConcurrentBookings must be a non-negative integer."
        ),

    body("customerBookingSettings.licenseRestrictionEnabled")
        .optional()
        .isBoolean()
        .withMessage(
            "licenseRestrictionEnabled must be a boolean."
        ),

    body("validIdRenewalSettings.maxUploadsPerYear")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "maxUploadsPerYear must be a positive integer."
        ),

    body("validIdRenewalSettings.renewalPeriodYears")
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage(
            "renewalPeriodYears must be between 1 and 5."
        ),

    body("validIdRenewalSettings.maxAttempts")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "maxAttempts must be a positive integer."
        ),

    body("validIdExpirationSettings.enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "validIdExpirationSettings.enabled must be a boolean."
        ),

    body("validIdExpirationSettings.firstReminderDays")
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage(
            "firstReminderDays must be between 1 and 365."
        ),

    body("validIdExpirationSettings.secondReminderDays")
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage(
            "secondReminderDays must be between 1 and 365."
        ),

    body("validIdExpirationSettings.thirdReminderDays")
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage(
            "thirdReminderDays must be between 1 and 365."
        ),

    body("validIdExpirationSettings.notifyOnExpired")
        .optional()
        .isBoolean()
        .withMessage(
            "notifyOnExpired must be a boolean."
        ),

    body("vehicleRegistrationRenewalSettings.maxRenewalsPerPeriod")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "maxRenewalsPerPeriod must be a positive integer."
        ),

    body("vehicleRegistrationRenewalSettings.renewalPeriodValue")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "renewalPeriodValue must be a positive integer."
        ),

    body("vehicleRegistrationRenewalSettings.renewalPeriodUnit")
        .optional()
        .isIn(["Month", "Year"])
        .withMessage(
            "renewalPeriodUnit must be Month or Year."
        ),

    body("vehicleRegistrationRenewalSettings.maxAttempts")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "maxAttempts must be a positive integer."
        ),

    body("vehicleRegistrationExpirationSettings.enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "vehicleRegistrationExpirationSettings.enabled must be a boolean."
        ),

    body("vehicleRegistrationExpirationSettings.firstReminderDays")
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage(
            "firstReminderDays must be between 1 and 365."
        ),

    body("vehicleRegistrationExpirationSettings.secondReminderDays")
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage(
            "secondReminderDays must be between 1 and 365."
        ),

    body("vehicleRegistrationExpirationSettings.thirdReminderDays")
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage(
            "thirdReminderDays must be between 1 and 365."
        ),

    body("vehicleRegistrationExpirationSettings.notifyOnExpired")
        .optional()
        .isBoolean()
        .withMessage(
            "notifyOnExpired must be a boolean."
        ),

    body("themeSettings.christmas.enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "themeSettings.christmas.enabled must be a boolean."
        ),

    body([
        "themeSettings.christmas.startMonth",
        "themeSettings.christmas.endMonth",
    ])
        .optional()
        .isInt({ min: 1, max: 12 })
        .withMessage(
            "Christmas theme months must be between 1 and 12."
        ),

    body([
        "themeSettings.christmas.startDay",
        "themeSettings.christmas.endDay",
    ])
        .optional()
        .isInt({ min: 1, max: 31 })
        .withMessage(
            "Christmas theme days must be between 1 and 31."
        ),

    body("themeSettings.heroMediaType")
        .optional()
        .isIn(["video", "image"])
        .withMessage(
            "themeSettings.heroMediaType must be \"video\" or \"image\"."
        ),

    body("themeSettings.featuredImageFrame")
        .optional()
        .isBoolean()
        .withMessage(
            "themeSettings.featuredImageFrame must be true or false."
        ),

    body("themeSettings.navbarStyle")
        .optional()
        .isIn(["default", "pill"])
        .withMessage(
            "themeSettings.navbarStyle must be \"default\" or \"pill\"."
        ),

    body("themeSettings.cardHoverMode")
        .optional()
        .isIn(["neon", "spotlight"])
        .withMessage(
            "themeSettings.cardHoverMode must be \"neon\" or \"spotlight\"."
        ),

    body("themeSettings.cardHoverColor")
        .optional()
        .isIn(["yellow", "blue", "purple", "green", "red", "white"])
        .withMessage(
            "themeSettings.cardHoverColor must be one of: yellow, blue, purple, green, red, white."
        ),
];
