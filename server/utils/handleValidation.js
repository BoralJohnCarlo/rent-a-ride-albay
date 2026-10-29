import { validationResult } from "express-validator";

import { errorResponse } from "./response.js";

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

export default handleValidation;