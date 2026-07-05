// ===============================
// File: middleware/errorMiddleware.js
// Purpose: Global Error Handler
// ===============================

const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        data: null,
        ...(process.env.NODE_ENV === "development" && {
            stack: err.stack
        })
    });
};

export default errorMiddleware;