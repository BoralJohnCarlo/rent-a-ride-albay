// ===============================
// File: middleware/notFoundMiddleware.js
// Purpose: Handle Unknown Routes
// ===============================

const notFoundMiddleware = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.originalUrl}`,
        data: null
    });
};

export default notFoundMiddleware;