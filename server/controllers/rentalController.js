import { validationResult } from "express-validator";

import {
    createRental,
    processPickup,
    getRentals,
    getRental,
    reassignDriver,
    processReturn,
    addDamageIssue,
    addCharge,
    addAdjustment,
    recordPayment,
    verifyPayment,
    holdSecurityDeposit,
    deductSecurityDeposit,
    releaseSecurityDeposit,
    updateVehicleOutcome,
    completeRental,
    completeRentalAsCustomer,
    getCustomerRentals,
    getOperatorRentals,
    getAdminRentals,
    addOperationalEvent,
    updateRental,
    waivePenalty,
    adjustPenalty,
    addPenaltyNote,
    applyPenalty,
} from "../services/rentalService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

const handleValidation = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        errorResponse(
            res,
            "Validation failed.",
            400,
            errors.array()
        );

        return false;
    }

    return true;
};

export const create = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental = await createRental(
            req.body.booking,
            req.user._id,
            { releaseEarly: req.body.releaseEarly === true }
        );

        return successResponse(
            res,
            "Rental created successfully.",
            rental,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getAll = async (req, res) => {
    try {
        const includeCompleted =
            req.query.includeCompleted !==
            "false";

        const rentals = await getRentals({
            currentUserId: req.user._id,
            role: req.user.role,
            includeCompleted,
        });

        return successResponse(
            res,
            "Rentals retrieved successfully.",
            rentals
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getById = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental = await getRental(
            req.params.rentalId,
            {
                currentUserId: req.user._id,
                role: req.user.role,
            }
        );

        return successResponse(
            res,
            "Rental retrieved successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 404
        );
    }
};

export const pickup = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental = await processPickup(
            req.params.rentalId,
            req.body,
            req.user._id
        );

        return successResponse(
            res,
            "Rental pickup processed successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const returnVehicle = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental = await processReturn(
            req.params.rentalId,
            req.body,
            req.user._id
        );

        return successResponse(
            res,
            "Rental return processed successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const update = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental = await updateRental(
            req.params.rentalId,
            req.body,
            req.user._id
        );

        return successResponse(
            res,
            "Rental updated successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const reassign = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await reassignDriver(
                req.params.rentalId,
                req.body.newDriver,
                req.body.reason,
                req.user._id
            );

        return successResponse(
            res,
            "Rental driver reassigned successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const addDamage = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await addDamageIssue(
                req.params.rentalId,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Rental damage issue added successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const addRentalCharge = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental = await addCharge(
            req.params.rentalId,
            req.body,
            req.user._id
        );

        return successResponse(
            res,
            "Rental charge added successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const addRentalAdjustment =
    async (req, res) => {
        try {
            if (!handleValidation(req, res)) {
                return;
            }

            const rental =
                await addAdjustment(
                    req.params.rentalId,
                    req.body,
                    req.user._id
                );

            return successResponse(
                res,
                "Rental adjustment added successfully.",
                rental
            );
        } catch (error) {
            return errorResponse(
                res,
                error.message,
                error.statusCode || 400
            );
        }
    };

export const payment = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await recordPayment(
                req.params.rentalId,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Rental payment recorded successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const verifyRentalPayment = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await verifyPayment(
                req.params.rentalId,
                req.body.paymentId,
                req.body.status,
                req.body.rejectionReason,
                req.user._id
            );

        return successResponse(
            res,
            "Rental payment verification processed successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const holdDeposit = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await holdSecurityDeposit(
                req.params.rentalId,
                req.user._id
            );

        return successResponse(
            res,
            "Security deposit held successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const deductDeposit = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await deductSecurityDeposit(
                req.params.rentalId,
                req.body.amount,
                req.body.reason,
                req.user._id
            );

        return successResponse(
            res,
            "Security deposit deduction recorded successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const releaseDeposit = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await releaseSecurityDeposit(
                req.params.rentalId,
                req.user._id
            );

        return successResponse(
            res,
            "Security deposit released successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const vehicleOutcome = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const { rental, conflicts } =
            await updateVehicleOutcome(
                req.params.rentalId,
                req.body.vehicleOutcome,
                req.user._id,
                req.body.maintenancePlan ?? null
            );

        return successResponse(
            res,
            conflicts.length
                ? `Vehicle outcome saved. ${conflicts.length} upcoming booking(s) overlap the maintenance and were flagged — send those customers their options from each booking.`
                : "Rental vehicle outcome updated successfully.",
            {
                ...rental.toObject(),
                maintenanceConflicts: conflicts,
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const complete = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await completeRental(
                req.params.rentalId,
                req.body.notes,
                req.user._id,
                req.body.overrideOutstandingBalance === true
            );

        return successResponse(
            res,
            "Rental completed successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const customerComplete = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await completeRentalAsCustomer(
                req.params.rentalId,
                req.user._id
            );

        return successResponse(
            res,
            "Rental completed successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getCustomer = async (
    req,
    res
) => {
    try {
        const customerId =
            req.params.customerId ||
            req.user._id;

        const rentals =
            await getCustomerRentals(
                customerId
            );

        return successResponse(
            res,
            "Customer rentals retrieved successfully.",
            rentals
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getOperator = async (
    req,
    res
) => {
    try {
        const operatorId =
            req.params.operatorId ||
            req.user._id;

        const rentals =
            await getOperatorRentals(
                operatorId
            );

        return successResponse(
            res,
            "Operator rentals retrieved successfully.",
            rentals
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getAdmin = async (
    req,
    res
) => {
    try {
        const rentals =
            await getAdminRentals();

        return successResponse(
            res,
            "Admin rentals retrieved successfully.",
            rentals
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const addEvent = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await addOperationalEvent(
                req.params.rentalId,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Rental operational event added successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const waivePenaltyController = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await waivePenalty(
                req.params.rentalId,
                req.body.reason || "",
                req.user._id
            );

        return successResponse(
            res,
            "Penalty waived successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const adjustPenaltyController = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await adjustPenalty(
                req.params.rentalId,
                req.body.newAmount,
                req.body.reason || "",
                req.user._id
            );

        return successResponse(
            res,
            "Penalty adjusted successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const addPenaltyNoteController = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await addPenaltyNote(
                req.params.rentalId,
                req.body.reason || "",
                req.user._id
            );

    return successResponse(
        res,
        "Penalty note added successfully.",
        rental
    );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const applyPenaltyController = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const rental =
            await applyPenalty(
                req.params.rentalId,
                req.body.reason || "",
                req.user._id
            );

        return successResponse(
            res,
            "Penalty applied successfully.",
            rental
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};
