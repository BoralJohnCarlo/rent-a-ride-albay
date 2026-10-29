import { validationResult } from "express-validator";

import {
    getPublicTestimonials,
    getAllTestimonials,
    createTestimonial,
    createTestimonialFromReview,
    updateTestimonial,
    deleteTestimonial,
} from "../services/testimonialService.js";

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

const handleError = (res, error) =>
    errorResponse(
        res,
        error.message,
        error.statusCode || 400
    );

export const getPublic = async (req, res) => {
    try {
        const testimonials = await getPublicTestimonials();

        return successResponse(
            res,
            "Testimonials retrieved successfully.",
            testimonials
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const getAll = async (req, res) => {
    try {
        const testimonials = await getAllTestimonials();

        return successResponse(
            res,
            "Testimonials retrieved successfully.",
            testimonials
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const create = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const testimonial = await createTestimonial(req.body);

        return successResponse(
            res,
            "Testimonial added successfully.",
            testimonial,
            201
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const createFromReview = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const testimonial = await createTestimonialFromReview(
            req.params.reviewId
        );

        return successResponse(
            res,
            "Review added as a testimonial.",
            testimonial,
            201
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const update = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const testimonial = await updateTestimonial(
            req.params.id,
            req.body
        );

        return successResponse(
            res,
            "Testimonial updated successfully.",
            testimonial
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const remove = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        await deleteTestimonial(req.params.id);

        return successResponse(
            res,
            "Testimonial removed successfully."
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const uploadPhoto = async (req, res) =>
    successResponse(
        res,
        "Testimonial image uploaded successfully.",
        req.testimonialImage,
        201
    );
