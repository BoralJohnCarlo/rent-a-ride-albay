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
    resolveConsignmentVehicleOwner,
} from "./vehicleOwner/index.js";

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
            $regex: filters.applicantName,
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
        consignment.application.status !==
        CONSIGNMENT_STATUS.DRAFT
    ) {
        throw createError(
            "Only draft consignments can be modified.",
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

        [CONSIGNMENT_STATUS.PENDING]: [
            CONSIGNMENT_STATUS.UNDER_REVIEW,
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

const createConsignment = async (
    consignmentData,
    currentUserId
) => {
    await ensureUserExists(
        currentUserId
    );

    const consignmentCode =
        await generateConsignmentCode();

    const consignment =
        new Consignment({
            consignmentCode,

            snapshots:
                consignmentData.snapshots,

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
    ).sort(sort);
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
        .sort(sort);
};

const getConsignmentById = async (
    consignmentId
) => {
    return await findConsignmentById(
        consignmentId
    );
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

    ensureEditableDraft(
        consignment
    );

    validateWorkflowTransition(
        consignment.application.status,
        CONSIGNMENT_STATUS.PENDING
    );

    consignment.application.submitted = {
        ...consignment.application.submitted.toObject(),
        submittedBy:
            currentUserId,
        submittedAt: new Date(),
        remarks,
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

    return await saveConsignment(
        consignment
    );
};

const reviewConsignment = async (
    consignmentId,
    reviewData,
    currentUserId
) => {
    await ensureUserExists(currentUserId);

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

    return await saveConsignment(
        consignment
    );
};

const inspectConsignment = async (
    consignmentId,
    inspectionData,
    currentUserId
) => {
    await ensureUserExists(
        currentUserId
    );

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
            event:
                inspectionData.status ===
                INSPECTION_STATUS.PASSED
                    ? "Inspection Passed"
                    : "Inspection Failed",

            title:
                inspectionData.status ===
                INSPECTION_STATUS.PASSED
                    ? "Inspection Passed"
                    : "Inspection Failed",

            description:
                inspectionData.status ===
                INSPECTION_STATUS.PASSED
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

    return await saveConsignment(
        consignment
    );
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
        consignment.application.inspection
            .status !==
        INSPECTION_STATUS.PASSED
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

const vehicleOwner =
    await resolveConsignmentVehicleOwner(
        consignment,
        currentUserId
    );

consignment.generatedEntities.vehicleOwner =
    vehicleOwner._id;

const vehicle =
    await createVehicleFromConsignment(
        consignment,
        vehicleOwner._id,
        currentUserId
    );

consignment.generatedEntities.vehicle =
    vehicle._id;

    consignment.application.approval = {
    ...consignment.application.approval.toObject(),
    approvedBy: currentUserId,
    approvedAt: new Date(),
    agreementType:
        approvalData.agreementType,
    remarks: approvalData.remarks,
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

    return await saveConsignment(
        consignment
    );
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

    return await saveConsignment(
        consignment
    );
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