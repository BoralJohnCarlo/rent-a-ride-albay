import { validationResult } from "express-validator";

import {
    createTicket,
    getCustomerTickets,
    getAdminTickets,
    getTicketById,
    addReply,
    markTicketRead,
    getUnreadSummary,
    getTicketCustomerContext,
    updateTicketStatus,
} from "../services/supportTicketService.js";

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

const paginationOf = (req) => ({
    page: Math.max(
        1,
        parseInt(req.query.page, 10) || 1
    ),
    limit: Math.min(
        100,
        Math.max(
            1,
            parseInt(req.query.limit, 10) || 20
        )
    ),
});

export const create = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const ticket = await createTicket(
            req.user._id,
            req.body
        );

        return successResponse(
            res,
            "Support ticket submitted successfully.",
            ticket,
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

export const getMine = async (req, res) => {
    try {
        const { page, limit } = paginationOf(req);

        const { tickets, total } =
            await getCustomerTickets(
                req.user._id,
                {
                    status: req.query.status,
                    search: req.query.search,
                    page,
                    limit,
                }
            );

        res.status(200).json({
            success: true,
            message:
                "Support tickets retrieved successfully.",
            data: tickets,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
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
        const { page, limit } = paginationOf(req);

        const { tickets, total, counts } =
            await getAdminTickets({
                status: req.query.status,
                category: req.query.category,
                search: req.query.search,
                unreadOnly: req.query.unread === "true",
                page,
                limit,
            });

        res.status(200).json({
            success: true,
            message:
                "Support tickets retrieved successfully.",
            data: tickets,
            counts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getOne = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const ticket = await getTicketById(
            req.params.id,
            {
                userId: req.user._id,
                role: req.user.role,
            }
        );

        return successResponse(
            res,
            "Support ticket retrieved successfully.",
            ticket
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 404
        );
    }
};

export const reply = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const ticket = await addReply(
            req.params.id,
            req.body.message,
            {
                userId: req.user._id,
                role: req.user.role,
            }
        );

        return successResponse(
            res,
            "Reply added successfully.",
            ticket
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const updateStatus = async (
    req,
    res
) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const ticket = await updateTicketStatus(
            req.params.id,
            req.body.status,
            { userId: req.user._id }
        );

        return successResponse(
            res,
            "Ticket status updated successfully.",
            ticket
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const markRead = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const result = await markTicketRead(
            req.params.id,
            {
                userId: req.user._id,
                role: req.user.role,
            }
        );

        return successResponse(
            res,
            "Conversation marked as read.",
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getUnread = async (req, res) => {
    try {
        const result = await getUnreadSummary({
            userId: req.user._id,
            role: req.user.role,
        });

        return successResponse(
            res,
            "Unread support messages retrieved successfully.",
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getContext = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const context = await getTicketCustomerContext(
            req.params.id
        );

        return successResponse(
            res,
            "Customer context retrieved successfully.",
            context
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 404
        );
    }
};
