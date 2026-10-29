const createError = (
    message,
    statusCode = 500,
    errors = null
) => {
    const error = new Error(message);

    error.statusCode = statusCode;
    error.errors = errors;

    return error;
};

export default createError;