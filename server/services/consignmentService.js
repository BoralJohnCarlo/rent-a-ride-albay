import createError from "../utils/createError.js";

import Consignment from "../models/Consignment.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";

import {
    CONSIGNMENT_STATUS,
    INSPECTION_STATUS,
} from "../constants/consignmentConstants.js";

import {
    createVehicleFromConsignment,
} from "./vehicleService.js";

import {
    getSettingsWithDefaults,
} from "./payoutService.js";

import { assertInspectionSlotAvailable } from "./inspectionSlotService.js";
import { resolveAcceptedLegalVersion } from "./legalDocumentService.js";
import {
    LEGAL_DOCUMENT_TYPES,
    PARTNER_TERMS_OUTDATED_MESSAGE,
} from "../constants/legalDocumentConstants.js";

import {
    notifyAdmins,
    notifyUser,
    hasRecentNotification,
} from "./notificationService.js";

/*
 * Best-effort admin fan-out for consignment lifecycle events driven by the
 * operator. A failure here must never roll back the consignment action.
 */
const notifyAdminsOfConsignmentEvent = async (consignment, { type, title, message, variant = "consignment" }) => {
    try {
        await notifyAdmins({
            type,
            title,
            message,
            variant,
            category: "Consignment",
            metadata: {
                reference: consignment.consignmentCode,
                relatedId: consignment._id,
                relatedModel: "Consignment",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of consignment event:",
            notificationError
        );
    }
};

/*
 * Best-effort notice to the operator who owns a consignment about an admin
 * decision on it. A failure here must never roll back the admin action.
 */
const notifyOperatorOfConsignmentEvent = async (consignment, { type, title, message, variant = "consignment" }) => {
    const operatorId = consignment.audit?.createdBy;

    if (!operatorId) {
        return;
    }

    try {
        await notifyUser(operatorId, {
            type,
            title,
            message,
            variant,
            category: "Consignment",
            metadata: {
                reference: consignment.consignmentCode,
                relatedId: consignment._id,
                relatedModel: "Consignment",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of consignment event:",
            notificationError
        );
    }
};

/*
 * Human-readable summary of the commission rate a just-approved vehicle
 * will actually be paid out under, for the operator-facing approval
 * notification below. Mirrors the same override-vs-default logic as
 * calculateBookingPayout in payoutService.js and formatCommission.js on the
 * client.
 */
const describeCommissionForNotification = async (commission) => {
    if (commission?.mode === "PERCENTAGE") {
        return `Your vehicle was given its own commission rate of ${commission.value}% per booking.`;
    }

    if (commission?.mode === "FIXED") {
        return `Your vehicle was given its own commission of ₱${commission.value.toLocaleString()} per booking.`;
    }

    const settings = await getSettingsWithDefaults();
    const platformCommissionRate =
        settings.commissionSettings.platformCommissionRate;

    return `Your vehicle uses the platform's default commission rate of ${platformCommissionRate}% per booking.`;
};

/* -------------------------------------------------------------------------- */
/*                              Private Helpers                               */
/* -------------------------------------------------------------------------- */

const ensureUserExists = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw createError(
            "User not found.",
            404
        );
    }

    return user;
};

const findConsignmentById = async (
    consignmentId
) => {
    const consignment =
        await Consignment.findById(
            consignmentId
        );

    if (!consignment) {
        throw createError(
            "Consignment not found.",
            404
        );
    }

    return consignment;
};

const saveConsignment = async (
    consignment
) => {
    await consignment.save();

    return await Consignment.findById(
        consignment._id
    );
};

const escapeRegex = (text) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

const buildConsignmentFilters = (
    filters = {}
) => {
    const query = {};

    if (filters.status) {
        query["application.status"] =
            filters.status;
    } else {
        query["application.status"] = {
            $ne: CONSIGNMENT_STATUS.ARCHIVED,
        };
    }

    if (filters.isArchived !== undefined) {
        query["archive.isArchived"] =
            filters.isArchived;
    }

    if (filters.vehicleType) {
        query[
            "snapshots.vehicle.vehicleType"
        ] = filters.vehicleType;
    }

    if (filters.ownership) {
        query[
            "snapshots.vehicle.ownership"
        ] = filters.ownership;
    }

    if (filters.applicantName) {
        query[
            "snapshots.applicant.identity.displayName"
        ] = {
            $regex: escapeRegex(filters.applicantName),
            $options: "i",
        };
    }

    return query;
};

const generateConsignmentCode =
    async () => {
        const latestConsignment =
            await Consignment.findOne()
                .sort({
                    createdAt: -1,
                })
                .select(
                    "consignmentCode"
                );

        if (!latestConsignment) {
            return "CON-000001";
        }

        const currentNumber =
            Number(
                latestConsignment.consignmentCode
                    .replace("CON-", "")
            );

        const nextNumber =
            currentNumber + 1;

        return `CON-${String(
            nextNumber
        ).padStart(6, "0")}`;
    };

// A consignment is editable / re-submittable while it is still a Draft or
// while the reviewer has bounced it back for changes (Revision Requested).
const EDITABLE_STATUSES = [
    CONSIGNMENT_STATUS.DRAFT,
    CONSIGNMENT_STATUS.REVISION_REQUESTED,
];

const ensureEditableDraft = (
    consignment
) => {
    if (
        consignment.archive.isArchived
    ) {
        throw createError(
            "Archived consignments cannot be modified.",
            400
        );
    }

    if (
        !EDITABLE_STATUSES.includes(
            consignment.application.status
        )
    ) {
        throw createError(
            "Only draft or revision-requested consignments can be modified.",
            400
        );
    }
};

    const mergeSnapshotSection = (
    currentSection,
    updates
) => {
    if (!updates) {
        return currentSection;
    }

    const current =
        currentSection.toObject();

    return {
        ...current,
        ...updates,
    };
};

const validateWorkflowTransition = (
    currentStatus,
    nextStatus
) => {
    const transitions = {
        [CONSIGNMENT_STATUS.DRAFT]: [
            CONSIGNMENT_STATUS.PENDING,
            CONSIGNMENT_STATUS.WITHDRAWN,
        ],

        /*
         * Reject and Revision Requested are reachable directly from Pending,
         * not just Under Review — an admin shouldn't have to click "Start
         * Review" first just to reject an obviously incomplete/ineligible
         * application or send it back for changes. Approve/Inspect still
         * require Under Review, since those genuinely depend on the review
         * step having happened.
         */
        [CONSIGNMENT_STATUS.PENDING]: [
            CONSIGNMENT_STATUS.UNDER_REVIEW,
            CONSIGNMENT_STATUS.REJECTED,
            CONSIGNMENT_STATUS.REVISION_REQUESTED,
            CONSIGNMENT_STATUS.WITHDRAWN,
        ],

        [CONSIGNMENT_STATUS.UNDER_REVIEW]:
            [
                CONSIGNMENT_STATUS.APPROVED,
                CONSIGNMENT_STATUS.REVISION_REQUESTED,
                CONSIGNMENT_STATUS.REJECTED,
                CONSIGNMENT_STATUS.WITHDRAWN,
            ],

        [CONSIGNMENT_STATUS.REVISION_REQUESTED]:
            [
                CONSIGNMENT_STATUS.PENDING,
                CONSIGNMENT_STATUS.WITHDRAWN,
            ],
    };

    const allowedTransitions =
        transitions[currentStatus] || [];

    if (
        !allowedTransitions.includes(
            nextStatus
        )
    ) {
        throw createError(
            `Cannot change consignment status from "${currentStatus}" to "${nextStatus}".`,
            400
        );
    }
};

const appendTimelineEvent = (
    consignment,
    {
        event,
        title = "",
        description = "",
        performedBy = null,
        remarks = "",
    }
) => {
    consignment.timeline.events.push({
        event,
        title,
        description,
        performedBy,
        remarks,
        createdAt: new Date(),
    });
};

const updateAudit = (
    consignment,
    updatedBy
) => {
    consignment.audit.updatedBy =
        updatedBy;

    consignment.audit.updatedAt =
        new Date();
};

/* -------------------------------------------------------------------------- */
/*                              Public Services                               */
/* -------------------------------------------------------------------------- */

/*
 * The applicant is simply whichever operator is logged in — the consignment
 * form only asks about the vehicle, not the operator's own identity/contact/
 * address again. Their profile (already verified at registration) is
 * snapshotted here so admin still gets a point-in-time applicant record on
 * the consignment, without asking the operator to retype it every time.
 */
const buildApplicantSnapshotFromUser = (user) => ({
    identity: {
        displayName:
            [user.firstName, user.lastName]
                .filter(Boolean)
                .join(" ") || user.email,
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
    },

    contact: {
        phoneNumber: user.phoneNumber || "",
        alternativePhoneNumber:
            user.alternativeContact || "",
        email: user.email || "",
    },

    address: {
        province: user.address?.province || "",
        city: user.address?.city || "",
        barangay: user.address?.barangay || "",
        street: user.address?.street || "",
        postalCode: user.address?.postalCode || "",
    },

    // fullName/relationship/phoneNumber are all required by the schema —
    // only carry this over if the operator's profile actually has all three.
    emergencyContacts:
        user.emergencyContact?.name &&
        user.emergencyContact?.relationship &&
        user.emergencyContact?.phoneNumber
            ? [
                  {
                      fullName: user.emergencyContact.name,
                      relationship:
                          user.emergencyContact.relationship,
                      phoneNumber:
                          user.emergencyContact.phoneNumber,
                  },
              ]
            : [],
});

const createConsignment = async (
    consignmentData,
    currentUserId
) => {
    const user = await ensureUserExists(
        currentUserId
    );

    const consignmentCode =
        await generateConsignmentCode();

    const consignment =
        new Consignment({
            consignmentCode,

            snapshots: {
                applicant:
                    buildApplicantSnapshotFromUser(
                        user
                    ),
                vehicle:
                    consignmentData.snapshots
                        ?.vehicle,
            },

            application: {
                status:
                    CONSIGNMENT_STATUS.DRAFT,
            },

            generatedEntities: {},

            timeline: {
                events: [],
            },

            archive: {},

            audit: {
                createdBy:
                    currentUserId,
            },
        });

    appendTimelineEvent(
        consignment,
        {
            event: "Draft Created",
            title: "Draft Created",
            description:
                "Consignment application was created.",
            performedBy:
                currentUserId,
        }
    );

    return await saveConsignment(
        consignment
    );
};

const getConsignments = async (
    filters = {},
    sort = { createdAt: -1 }
) => {
    const query =
        buildConsignmentFilters(
            filters
        );

    return await Consignment.find(
        query
    )
        .sort(sort)
        .populate("generatedEntities.vehicle", "pricing")
        .populate(
            "snapshots.vehicle.category",
            "name"
        )
        .populate(
            "audit.createdBy",
            "firstName lastName email isVerified validIdType validIdImage validIdBack validIdExpirationDate"
        );
};

const getOperatorConsignments = async (
    currentUserId,
    filters = {},
    sort = { createdAt: -1 }
) => {
    await ensureUserExists(currentUserId);

    const query =
        buildConsignmentFilters(filters);

    query["audit.createdBy"] =
        currentUserId;

    return await Consignment.find(query)
        .sort(sort)
        .populate("generatedEntities.vehicle", "pricing")
        .populate(
            "snapshots.vehicle.category",
            "name"
        )
        .populate(
            "audit.createdBy",
            "firstName lastName email isVerified validIdType validIdImage validIdBack validIdExpirationDate"
        );
};

const getConsignmentById = async (
    consignmentId
) => {
    const consignment =
        await findConsignmentById(
            consignmentId
        );

    await consignment.populate(
        "snapshots.vehicle.category",
        "name"
    );

    await consignment.populate(
        "generatedEntities.vehicle",
        "pricing"
    );

    await consignment.populate(
        "audit.createdBy",
        "firstName lastName email isVerified validIdType validIdImage validIdBack validIdExpirationDate"
    );

    return consignment;
};

const updateDraftConsignment = async (
    consignmentId,
    updateData,
    currentUserId
) => {
    await ensureUserExists(
        currentUserId
    );

    const consignment =
        await findConsignmentById(
            consignmentId
        );

    ensureEditableDraft(
        consignment
    );

    if (
        updateData.snapshots
            ?.applicant
    ) {
        consignment.snapshots.applicant =
        mergeSnapshotSection(
        consignment.snapshots.applicant,
        updateData.snapshots.applicant
    );
    }

    if (
        updateData.snapshots
            ?.vehicle
    ) {
        consignment.snapshots.vehicle =
        mergeSnapshotSection(
        consignment.snapshots.vehicle,
        updateData.snapshots.vehicle
    );
    }

    updateAudit(
        consignment,
        currentUserId
    );

    return await saveConsignment(
        consignment
    );
};

const submitConsignment = async (
    consignmentId,
    { remarks, termsAgreed, termsVersionId } = {},
    currentUserId
) => {
    await ensureUserExists(
        currentUserId
    );

    const consignment =
        await findConsignmentById(
            consignmentId
        );

    ensureEditableDraft(
        consignment
    );

    validateWorkflowTransition(
        consignment.application.status,
        CONSIGNMENT_STATUS.PENDING
    );

    // The Partner Terms version shown when they ticked the box.
    const acceptedTerms =
        termsAgreed === true
            ? await resolveAcceptedLegalVersion(
                  LEGAL_DOCUMENT_TYPES.PARTNER_TERMS,
                  termsVersionId,
                  {
                      outdatedMessage:
                          PARTNER_TERMS_OUTDATED_MESSAGE,
                  }
              )
            : null;

    const previous =
        consignment.application.submitted.toObject();

    consignment.application.submitted = {
        ...previous,
        submittedBy:
            currentUserId,
        submittedAt: new Date(),
        remarks,
        termsAgreed:
            typeof termsAgreed === "boolean"
                ? termsAgreed
                : previous.termsAgreed || false,
        termsDocument:
            typeof termsAgreed === "boolean"
                ? acceptedTerms?.document ?? null
                : previous.termsDocument ?? null,
        termsVersion:
            typeof termsAgreed === "boolean"
                ? acceptedTerms?.version ?? null
                : previous.termsVersion ?? null,
    };

    consignment.application.status =
        CONSIGNMENT_STATUS.PENDING;

    appendTimelineEvent(
        consignment,
        {
            event:
                "Application Submitted",
            title:
                "Application Submitted",
            description:
                "Consignment application was submitted for review.",
            performedBy:
                currentUserId,
            remarks,
        }
    );

    updateAudit(
        consignment,
        currentUserId
    );

    const submitted = await saveConsignment(
        consignment
    );

    await notifyAdminsOfConsignmentEvent(consignment, {
        type: "Consignment Submitted",
        title: "New Consignment Submitted",
        message: `Consignment ${consignment.consignmentCode} (${consignment.snapshots?.vehicle?.brand} ${consignment.snapshots?.vehicle?.model}) from ${consignment.snapshots?.applicant?.identity?.displayName} was submitted and is awaiting review.`,
        variant: "consignment",
    });

    return submitted;
};

const reviewConsignment = async (
    consignmentId,
    reviewData,
    currentUserId
) => {
    const user = await ensureUserExists(currentUserId);

    if (user.role !== "admin") {
        throw createError(
            "Only administrators can review consignments.",
            403
        );
    }

    const consignment =
        await findConsignmentById(
            consignmentId
        );

    const decision =
        reviewData.decision?.trim().toLowerCase();

    let nextStatus;
    let event;
    let title;
    let description;

    switch (decision) {
        case "review":
            nextStatus =
                CONSIGNMENT_STATUS.UNDER_REVIEW;

            event = "Application Reviewed";
            title = "Application Reviewed";
            description =
                "Application successfully passed the review stage.";
            break;

        case "revision":
            nextStatus =
                CONSIGNMENT_STATUS.REVISION_REQUESTED;

            event = "Revision Requested";
            title = "Revision Requested";
            description =
                "Reviewer requested revisions before the application can proceed.";
            break;

        case "reject":
            nextStatus =
                CONSIGNMENT_STATUS.REJECTED;

            event = "Application Rejected";
            title = "Application Rejected";
            description =
                "Consignment application was rejected.";
            break;

        default:
            throw createError(
                "Invalid review decision.",
                400
            );
    }

    validateWorkflowTransition(
        consignment.application.status,
        nextStatus
    );

    consignment.application.review = {
        ...consignment.application.review.toObject(),
        reviewedBy: currentUserId,
        reviewedAt: new Date(),
        remarks: reviewData.remarks,
        revisionRequested:
            decision === "revision",
    };

    if (decision === "reject") {
        consignment.application.rejection = {
            ...consignment.application.rejection.toObject(),
            rejectedBy: currentUserId,
            rejectedAt: new Date(),
            remarks: reviewData.remarks,
        };
    }

    consignment.application.status =
        nextStatus;

    appendTimelineEvent(
        consignment,
        {
            event,
            title,
            description,
            performedBy:
                currentUserId,
            remarks:
                reviewData.remarks,
        }
    );

    updateAudit(
        consignment,
        currentUserId
    );

    const reviewed = await saveConsignment(
        consignment
    );

    await notifyOperatorOfConsignmentEvent(consignment, {
        type: "Consignment Reviewed",
        title:
            decision === "reject"
                ? "Consignment Rejected"
                : decision === "revision"
                    ? "Consignment Revision Requested"
                    : "Consignment Passed Review",
        message: `${description} (Consignment ${consignment.consignmentCode})${
            reviewData.remarks ? ` Remarks: ${String(reviewData.remarks).slice(0, 300)}` : ""
        }`,
        variant:
            decision === "reject"
                ? "rejected"
                : decision === "revision"
                    ? "warning"
                    : "consignment",
    });

    return reviewed;
};

const inspectConsignment = async (
    consignmentId,
    inspectionData,
    currentUserId
) => {
    const user = await ensureUserExists(
        currentUserId
    );

    if (user.role !== "admin") {
        throw createError(
            "Only administrators can inspect consignments.",
            403
        );
    }

    const consignment =
        await findConsignmentById(
            consignmentId
        );

        if (
    consignment.application.status !==
    CONSIGNMENT_STATUS.UNDER_REVIEW
) {
    throw createError(
        "Only consignments under review can be inspected.",
        400
    );
}

    const inspectionPassed =
        inspectionData.status === INSPECTION_STATUS.PASSED ||
        inspectionData.status === INSPECTION_STATUS.CONDITIONAL_PASS;

    consignment.application.inspection = {
        ...consignment.application.inspection.toObject(),
        inspectedBy:
            currentUserId,
        inspectedAt:
            new Date(),
        status:
            inspectionData.status,
        remarks:
            inspectionData.remarks,
    };

    if (
    inspectionData.status ===
    INSPECTION_STATUS.FAILED
) {
    consignment.application.status =
        CONSIGNMENT_STATUS.REVISION_REQUESTED;
}

    appendTimelineEvent(
        consignment,
        {
            event: `Inspection ${inspectionData.status}`,

            title: `Inspection ${inspectionData.status}`,

            description: inspectionPassed
                ? "Vehicle inspection completed successfully."
                : "Vehicle inspection failed and revisions are required.",

            performedBy:
                currentUserId,

            remarks:
                inspectionData.remarks,
        }
    );

    updateAudit(
        consignment,
        currentUserId
    );

    const inspected = await saveConsignment(
        consignment
    );

    await notifyOperatorOfConsignmentEvent(consignment, {
        type: "Consignment Inspection Updated",
        title: `Vehicle Inspection ${inspectionData.status}`,
        message: `The inspection for consignment ${consignment.consignmentCode} (${consignment.snapshots?.vehicle?.brand} ${consignment.snapshots?.vehicle?.model}) was marked "${inspectionData.status}".${
            inspectionData.status === INSPECTION_STATUS.FAILED
                ? " Revisions are required before it can proceed."
                : ""
        }${inspectionData.remarks ? ` Remarks: ${String(inspectionData.remarks).slice(0, 300)}` : ""}`,
        variant:
            inspectionData.status === INSPECTION_STATUS.FAILED
                ? "warning"
                : "consignment",
    });

    return inspected;
};

const approveConsignment = async (
    consignmentId,
    approvalData,
    currentUserId
) => {
    const user =
    await ensureUserExists(
        currentUserId
    );

if (user.role !== "admin") {
    throw createError(
        "Only administrators can approve consignments.",
        403
    );
}

    const consignment =
        await findConsignmentById(
            consignmentId
        );

    if (
        consignment.application.status !==
        CONSIGNMENT_STATUS.UNDER_REVIEW
    ) {
        throw createError(
            "Only consignments under review can be approved.",
            400
        );
    }

    if (
        ![
            INSPECTION_STATUS.PASSED,
            INSPECTION_STATUS.CONDITIONAL_PASS,
        ].includes(
            consignment.application.inspection
                .status
        )
    ) {
        throw createError(
            "Vehicle inspection must pass before approval.",
            400
        );
    }

    validateWorkflowTransition(
    consignment.application.status,
    CONSIGNMENT_STATUS.APPROVED
);

if (consignment.generatedEntities.vehicle) {
    throw createError(
        "This consignment has already generated a vehicle.",
        409
    );
}

// The operator who created the application becomes the vehicle's owner of
// record (Vehicle.operator).
const operatorId =
    consignment.audit?.createdBy ||
    consignment.application?.submitted?.submittedBy;

if (!operatorId) {
    throw createError(
        "Consignment has no operator to assign the vehicle to.",
        400
    );
}

/*
 * No platform-wide mode to consult anymore — whether this vehicle gets an
 * individually-negotiated commission is decided per-approval by whether the
 * admin submitted one here at all. Omitting it (the default, "use global")
 * leaves commission null, and payouts fall back to
 * Settings.commissionSettings.platformCommissionRate (see
 * calculateBookingPayout in payoutService.js).
 */
let commission = null;

if (approvalData.commission) {
    const submittedCommission = approvalData.commission;

    if (
        !["PERCENTAGE", "FIXED"].includes(
            submittedCommission.mode
        ) ||
        !Number.isFinite(
            Number(submittedCommission.value)
        ) ||
        Number(submittedCommission.value) < 0 ||
        (submittedCommission.mode === "PERCENTAGE" &&
            Number(submittedCommission.value) > 100)
    ) {
        throw createError(
            "A valid commission rate (percentage or fixed amount) is required when setting an individual commission for this vehicle.",
            400
        );
    }

    commission = {
        mode: submittedCommission.mode,
        value: Number(submittedCommission.value),
    };
}

let vehicle;
try {
    vehicle = await createVehicleFromConsignment(
        consignment,
        operatorId,
        currentUserId,
        commission,
        approvalData.pricing
    );
} catch (error) {
    if (error?.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || "value";
        throw createError(
            field === "plateNumber"
                ? `A vehicle with plate number "${consignment.snapshots?.vehicle?.plateNumber}" already exists. Resolve the duplicate before approving.`
                : `Cannot approve: a vehicle with this ${field} already exists.`,
            409
        );
    }
    throw error;
}

consignment.generatedEntities.vehicle =
    vehicle._id;

consignment.snapshots.vehicle.pricing = {
    dailyRate: Number(approvalData.pricing?.dailyRate),
    reservationFee: Number(approvalData.pricing?.reservationFee),
};

    consignment.application.approval = {
    ...consignment.application.approval.toObject(),
    approvedBy: currentUserId,
    approvedAt: new Date(),
    remarks: approvalData.remarks,
    commission,
};

    consignment.application.status =
        CONSIGNMENT_STATUS.APPROVED;

    appendTimelineEvent(
        consignment,
        {
            event:
                "Application Approved",
            title:
                "Application Approved",
            description:
                "Consignment application was approved and the vehicle was registered.",
            performedBy:
                currentUserId,
            remarks:
                approvalData.remarks,
        }
    );

    updateAudit(
        consignment,
        currentUserId
    );

    const approved = await saveConsignment(
        consignment
    );

    const commissionNote = await describeCommissionForNotification(
        commission
    ).catch(() => "");

    const approvalMessageParts = [
        `Consignment ${consignment.consignmentCode} (${consignment.snapshots?.vehicle?.brand} ${consignment.snapshots?.vehicle?.model}) was approved and your vehicle is now registered on the platform.`,
        commissionNote,
        approvalData.remarks
            ? `Remarks: ${String(approvalData.remarks).slice(0, 300)}`
            : "",
    ].filter(Boolean);

    await notifyOperatorOfConsignmentEvent(consignment, {
        type: "Consignment Approved",
        title: "Consignment Approved",
        message: approvalMessageParts.join(" "),
        variant: "success",
    });

    return approved;
};

const withdrawConsignment = async (
    consignmentId,
    remarks,
    currentUserId
) => {
    await ensureUserExists(
        currentUserId
    );

    const consignment =
        await findConsignmentById(
            consignmentId
        );

    validateWorkflowTransition(
        consignment.application.status,
        CONSIGNMENT_STATUS.WITHDRAWN
    );

    consignment.application.withdrawal = {
        ...consignment.application.withdrawal.toObject(),
        withdrawnBy:
            currentUserId,
        withdrawnAt:
            new Date(),
        remarks,
    };

    consignment.application.status =
        CONSIGNMENT_STATUS.WITHDRAWN;

    appendTimelineEvent(
        consignment,
        {
            event:
                "Application Withdrawn",

            title:
                "Application Withdrawn",

            description:
                "Consignment application was withdrawn.",

            performedBy:
                currentUserId,

            remarks,
        }
    );

    updateAudit(
        consignment,
        currentUserId
    );

    const withdrawn = await saveConsignment(
        consignment
    );

    await notifyAdminsOfConsignmentEvent(consignment, {
        type: "Consignment Withdrawn",
        title: "Consignment Withdrawn",
        message: `The operator withdrew consignment ${consignment.consignmentCode} (${consignment.snapshots?.vehicle?.brand} ${consignment.snapshots?.vehicle?.model}).${remarks ? ` Reason: ${String(remarks).slice(0, 300)}` : ""}`,
        variant: "rejected",
    });

    return withdrawn;
};

const archiveConsignment = async (
    consignmentId,
    remarks,
    currentUserId
) => {
    const user =
    await ensureUserExists(
        currentUserId
    );

if (user.role !== "admin") {
    throw createError(
        "Only administrators can archive consignments.",
        403
    );
}

    const consignment =
        await findConsignmentById(
            consignmentId
        );

    if (
        consignment.archive.isArchived
    ) {
        throw createError(
            "Consignment is already archived.",
            400
        );
    }

    consignment.archive = {
    ...consignment.archive.toObject(),

    isArchived: true,

    previousStatus:
        consignment.application.status,

    archivedAt: new Date(),

    archivedBy: currentUserId,

    remarks,
};

    consignment.application.status =
        CONSIGNMENT_STATUS.ARCHIVED;

    appendTimelineEvent(
        consignment,
        {
            event:
                "Application Archived",
            title:
                "Application Archived",
            description:
                "Consignment application was archived.",
            performedBy:
                currentUserId,
            remarks,
        }
    );

    updateAudit(
        consignment,
        currentUserId
    );

    return await saveConsignment(
        consignment
    );
};

const restoreConsignment = async (
    consignmentId,
    currentUserId
) => {
    const user =
    await ensureUserExists(
        currentUserId
    );

if (user.role !== "admin") {
    throw createError(
        "Only administrators can restore consignments.",
        403
    );
}

    const consignment =
        await findConsignmentById(
            consignmentId
        );

    if (
        !consignment.archive.isArchived
    ) {
        throw createError(
            "Consignment is not archived.",
            400
        );
    }

    const previousStatus =
        consignment.archive
            .previousStatus;

    consignment.archive = {
        ...consignment.archive.toObject(),
        isArchived: false,
        previousStatus: null,
        archivedAt: null,
        archivedBy: null,
        remarks: "",
    };

    consignment.application.status =
        previousStatus ??
        CONSIGNMENT_STATUS.DRAFT;

    appendTimelineEvent(
        consignment,
        {
            event:
                "Application Restored",

            title:
                "Application Restored",

            description:
                "Archived consignment was restored.",

            performedBy:
                currentUserId,
        }
    );

    updateAudit(
        consignment,
        currentUserId
    );

    return await saveConsignment(
        consignment
    );
};

export const bookInspectionAppointment = async (
    consignmentId,
    { date, time },
    currentUserId
) => {
    await ensureUserExists(currentUserId);
    const consignment = await findConsignmentById(consignmentId);

    if (
        ![
            CONSIGNMENT_STATUS.PENDING,
            CONSIGNMENT_STATUS.UNDER_REVIEW,
        ].includes(consignment.application.status)
    ) {
        throw createError(
            "An inspection can only be scheduled while the application is pending or under review.",
            400
        );
    }

    await assertInspectionSlotAvailable(date, time, {
        excludeConsignmentId: consignment._id,
    });

    const isReschedule = Boolean(
        consignment.application.inspection.scheduledDate
    );

    consignment.application.inspection = {
        ...consignment.application.inspection.toObject(),
        scheduledDate: date,
        scheduledTime: time,
        scheduledAt: new Date(),
    };

    appendTimelineEvent(consignment, {
        event: isReschedule
            ? "Inspection Rescheduled"
            : "Inspection Scheduled",
        title: isReschedule
            ? "Inspection Rescheduled"
            : "Inspection Scheduled",
        description: `Inspection appointment set for ${date} at ${time}.`,
        performedBy: currentUserId,
    });

    updateAudit(consignment, currentUserId);
    const saved = await saveConsignment(consignment);

    await notifyAdminsOfConsignmentEvent(consignment, {
        type: "Consignment Inspection Scheduled",
        title: isReschedule
            ? "Inspection Rescheduled"
            : "Inspection Scheduled",
        message: `The inspection for consignment ${consignment.consignmentCode} (${consignment.snapshots?.vehicle?.brand} ${consignment.snapshots?.vehicle?.model}) is set for ${date} at ${time}.`,
        variant: "consignment",
    });

    /*
     * The operator only heard back from admins before (via the
     * notification above) - never a confirmation of their own booking.
     * This route also allows an admin to book on the operator's behalf,
     * so notify whoever actually submitted the application rather than
     * assuming currentUserId is the operator.
     */
    const applicantId = consignment.application?.submitted?.submittedBy;

    if (applicantId) {
        try {
            await notifyUser(applicantId, {
                type: "Consignment Inspection Scheduled",
                title: isReschedule
                    ? "Inspection Rescheduled"
                    : "Inspection Appointment Confirmed",
                message: `Your inspection appointment for ${consignment.snapshots?.vehicle?.brand} ${consignment.snapshots?.vehicle?.model} (${consignment.consignmentCode}) is set for ${date} at ${time}. This appointment covers discussing partnership terms and commission rates, plus inspecting and setting up your vehicle.`,
                variant: "consignment",
                category: "Consignment",
                metadata: {
                    reference: consignment.consignmentCode,
                    relatedId: consignment._id,
                    relatedModel: "Consignment",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify applicant of inspection appointment:",
                notificationError
            );
        }
    }

    return saved;
};

/*
 * Cron sweep: reminds an operator (and admins) about a vehicle inspection
 * appointment coming up within the next 24 hours, same window/dedup
 * approach as sendRentalReturnReminders in rentalService.js. Only fires for
 * appointments still Pending inspection on a still-open application - once
 * either moves on (inspected, approved/rejected, withdrawn) there's nothing
 * left to remind anyone about.
 */
export const sendInspectionAppointmentReminders = async () => {
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const consignments = await Consignment.find({
        "application.status": {
            $in: [
                CONSIGNMENT_STATUS.PENDING,
                CONSIGNMENT_STATUS.UNDER_REVIEW,
            ],
        },
        "application.inspection.status": INSPECTION_STATUS.PENDING,
        "application.inspection.scheduledDate": { $nin: [null, ""] },
    }).select(
        "consignmentCode application.inspection application.submitted snapshots.vehicle"
    );

    for (const consignment of consignments) {
        try {
            const inspection = consignment.application.inspection;

            const appointmentAt = inspection.scheduledAt
                ? new Date(inspection.scheduledAt)
                : new Date(
                      `${inspection.scheduledDate}T${
                          inspection.scheduledTime || "00:00"
                      }:00`
                  );

            if (Number.isNaN(appointmentAt.getTime())) {
                continue;
            }

            const isDueSoon =
                appointmentAt.getTime() >= now.getTime() &&
                appointmentAt.getTime() <= reminderCutoff.getTime();

            if (!isDueSoon) {
                continue;
            }

            const applicantId =
                consignment.application?.submitted?.submittedBy;

            if (!applicantId) {
                continue;
            }

            const alreadySent = await hasRecentNotification({
                recipient: applicantId,
                type: "Inspection Appointment Reminder",
                relatedId: consignment._id,
                since: startOfDay,
            });

            if (alreadySent) {
                continue;
            }

            const vehicleLabel =
                [
                    consignment.snapshots?.vehicle?.brand,
                    consignment.snapshots?.vehicle?.model,
                ]
                    .filter(Boolean)
                    .join(" ") || "your vehicle";

            await notifyUser(applicantId, {
                type: "Inspection Appointment Reminder",
                title: "Inspection Appointment Tomorrow",
                message: `Reminder: your inspection appointment for ${vehicleLabel} (${consignment.consignmentCode}) is on ${inspection.scheduledDate} at ${inspection.scheduledTime}. We'll discuss partnership terms and commission rates, and inspect and set up your vehicle then.`,
                variant: "consignment",
                category: "Consignment",
                metadata: {
                    reference: consignment.consignmentCode,
                    relatedId: consignment._id,
                    relatedModel: "Consignment",
                },
            });
        } catch (error) {
            console.error(
                `Inspection appointment reminder failed for consignment ${consignment?._id}:`,
                error
            );
        }
    }
};

export const requestReschedule = async (
    consignmentId,
    rescheduleData,
    requestedById
) => {
    await ensureUserExists(requestedById);
    const consignment = await findConsignmentById(consignmentId);

    if (
        ![
            CONSIGNMENT_STATUS.PENDING,
            CONSIGNMENT_STATUS.UNDER_REVIEW,
        ].includes(consignment.application.status)
    ) {
        throw createError(
            "An inspection can only be rescheduled while the application is pending or under review.",
            400
        );
    }

    if (
        consignment.reschedule?.status === "Pending"
    ) {
        throw createError(
            "A reschedule request is already pending.",
            400
        );
    }

    consignment.reschedule = {
        status: "Pending",
        requestedBy: requestedById,
        requestedAt: new Date(),
        proposedDate: new Date(rescheduleData.proposedDate),
        proposedTime: rescheduleData.proposedTime,
        reason: rescheduleData.reason,
        reviewedBy: null,
        reviewedAt: null,
        reviewRemarks: "",
    };

    await appendTimelineEvent(
        consignment,
        {
            event: "Reschedule Requested",
            title: "Reschedule Requested",
            description: `Operator requested rescheduling to ${rescheduleData.proposedDate} ${rescheduleData.proposedTime}. Reason: ${rescheduleData.reason}`,
            performedBy: requestedById,
        }
    );

    await updateAudit(consignment, requestedById);
    const rescheduled = await saveConsignment(consignment);

    await notifyAdminsOfConsignmentEvent(consignment, {
        type: "Consignment Reschedule Requested",
        title: "Inspection Reschedule Requested",
        message: `The operator requested to reschedule the inspection for consignment ${consignment.consignmentCode} to ${rescheduleData.proposedDate} ${rescheduleData.proposedTime}. Reason: ${String(rescheduleData.reason || "").slice(0, 300)}`,
        variant: "warning",
    });

    return rescheduled;
};

export const approveReschedule = async (
    consignmentId,
    approveData,
    approvedById
) => {
    const approver = await ensureUserExists(approvedById);
    const consignment = await findConsignmentById(consignmentId);

    if (approver.role !== "admin") {
        throw createError(
            "Only administrators can review reschedule requests.",
            403
        );
    }

    if (consignment.reschedule?.status !== "Pending") {
        throw createError(
            "No pending reschedule request found.",
            400
        );
    }

    consignment.reschedule.status = "Approved";
    consignment.reschedule.reviewedBy = approvedById;
    consignment.reschedule.reviewedAt = new Date();
    consignment.reschedule.reviewRemarks = approveData.remarks || "";

    // Apply the operator's proposed slot as the actual inspection appointment.
    const proposed = consignment.reschedule.proposedDate;
    const proposedDateStr = proposed
        ? new Date(proposed).toISOString().slice(0, 10)
        : "";

    if (proposedDateStr) {
        consignment.application.inspection = {
            ...consignment.application.inspection.toObject(),
            scheduledDate: proposedDateStr,
            scheduledTime: consignment.reschedule.proposedTime || "",
            scheduledAt: new Date(),
        };
    }

    await appendTimelineEvent(
        consignment,
        {
            event: "Reschedule Approved",
            title: "Reschedule Approved",
            description: `Admin approved the reschedule to ${proposedDateStr} ${consignment.reschedule.proposedTime || ""}. Remarks: ${approveData.remarks || ""}`,
            performedBy: approvedById,
        }
    );

    await updateAudit(consignment, approvedById);
    const rescheduleApproved = await saveConsignment(consignment);

    await notifyOperatorOfConsignmentEvent(consignment, {
        type: "Consignment Reschedule Approved",
        title: "Inspection Reschedule Approved",
        message: `Your request to reschedule the inspection for consignment ${consignment.consignmentCode} was approved.${
            approveData.remarks ? ` Remarks: ${String(approveData.remarks).slice(0, 300)}` : ""
        }`,
        variant: "success",
    });

    return rescheduleApproved;
};

export const rejectReschedule = async (
    consignmentId,
    rejectData,
    rejectedById
) => {
    const rejecter = await ensureUserExists(rejectedById);
    const consignment = await findConsignmentById(consignmentId);

    if (rejecter.role !== "admin") {
        throw createError(
            "Only administrators can review reschedule requests.",
            403
        );
    }

    if (consignment.reschedule?.status !== "Pending") {
        throw createError(
            "No pending reschedule request found.",
            400
        );
    }

    consignment.reschedule.status = "Rejected";
    consignment.reschedule.reviewedBy = rejectedById;
    consignment.reschedule.reviewedAt = new Date();
    consignment.reschedule.reviewRemarks = rejectData.remarks || "";

    await appendTimelineEvent(
        consignment,
        {
            event: "Reschedule Rejected",
            title: "Reschedule Rejected",
            description: `Admin rejected reschedule. Remarks: ${rejectData.remarks || ""}`,
            performedBy: rejectedById,
        }
    );

    await updateAudit(consignment, rejectedById);
    const rescheduleRejected = await saveConsignment(consignment);

    await notifyOperatorOfConsignmentEvent(consignment, {
        type: "Consignment Reschedule Rejected",
        title: "Inspection Reschedule Rejected",
        message: `Your request to reschedule the inspection for consignment ${consignment.consignmentCode} was rejected.${
            rejectData.remarks ? ` Remarks: ${String(rejectData.remarks).slice(0, 300)}` : ""
        }`,
        variant: "rejected",
    });

    return rescheduleRejected;
};

/* -------------------------------------------------------------------------- */
/*                                   Exports                                  */
/* -------------------------------------------------------------------------- */

export {
    createConsignment,
    getConsignments,
    getOperatorConsignments,
    getConsignmentById,
    updateDraftConsignment,
    submitConsignment,
    reviewConsignment,
    inspectConsignment,
    approveConsignment,
    withdrawConsignment,
    archiveConsignment,
    restoreConsignment,
};
