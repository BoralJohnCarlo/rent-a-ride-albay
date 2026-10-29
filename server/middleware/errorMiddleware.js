import multer from "multer";

const errorMiddleware = (
    err,
    req,
    res,
    next
) => {
    let statusCode =
        err.statusCode || 500;

    let message =
        err.message ||
        "Internal Server Error";

    let errors = err.errors || null;

    if (err.code === 11000) {
        statusCode = 409;

        if (err.keyPattern?.email) {
            message =
                "Driver email already exists.";
        } else if (
            err.keyPattern?.[
                "license.licenseNumber"
            ]
        ) {
            message =
                "Driver's license number already exists.";
        } else if (
            err.keyPattern?.driverCode
        ) {
            message =
                "Driver code already exists.";
        } else if (
            err.keyPattern?.imei
        ) {
            message =
                "A tracker with this Device ID / IMEI is already registered.";
        } else {
            message =
                "A record with the same unique value already exists.";
        }
    }

    if (err instanceof multer.MulterError) {
        statusCode = 400;

        if (err.code === "LIMIT_FILE_SIZE") {
            message =
                "File is too large. Maximum size is 5MB.";
        } else if (err.code === "LIMIT_FILE_COUNT") {
            message =
                "Too many files uploaded.";
        } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
            message =
                "Unexpected file field.";
        } else {
            message = err.message || "File upload error.";
        }
    }

    const response = {
        success: false,
        message,
        errors,
        data: null,
    };

    if (
        process.env.NODE_ENV ===
        "development"
    ) {
        response.stack = err.stack;
    }

    res.status(statusCode).json(
        response
    );
};

export default errorMiddleware;