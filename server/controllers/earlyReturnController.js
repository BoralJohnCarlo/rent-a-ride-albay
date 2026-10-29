import { validationResult } from "express-validator";
import {
    approveEarlyReturnCredit as approveEarlyReturnCreditService,
    rejectEarlyReturnCredit as rejectEarlyReturnCreditService,
    listEarlyReturnCredits as listEarlyReturnCreditsService,
} from "../services/earlyReturnService.js";

const handleValidation = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: errors.array(),
            data: null,
        });
        return false;
    }

    return true;
};

export const listEarlyReturnCredits = async (req, res, next) => {
    try {
        const { status, search, page, limit } = req.query;

        const result = await listEarlyReturnCreditsService({
            status,
            search,
            page,
            limit,
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const approveEarlyReturnCredit = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const { rentalId } = req.params;

        const rental = await approveEarlyReturnCreditService(
            rentalId,
            req.user.id,
            req.body?.unusedDays
        );

        res.json({
            success: true,
            message: "Early-return credit approved successfully.",
            data: rental,
        });
    } catch (err) {
        next(err);
    }
};

export const rejectEarlyReturnCredit = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const { rentalId } = req.params;

        const rental = await rejectEarlyReturnCreditService(
            rentalId,
            req.user.id,
            req.body?.note
        );

        res.json({
            success: true,
            message: "Early-return credit rejected successfully.",
            data: rental,
        });
    } catch (err) {
        next(err);
    }
};
