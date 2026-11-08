import createError from "./createError.js";

export const PASSWORD_BYTE_LIMIT = 72;
export const PASSWORD_BYTE_LIMIT_MESSAGE =
    "Password must not exceed 72 UTF-8 bytes. Accented letters and emoji may use more than one byte.";

export const isPasswordWithinByteLimit = (value) =>
    typeof value === "string" && Buffer.byteLength(value, "utf8") <= PASSWORD_BYTE_LIMIT;

export const assertPasswordByteLimit = (value) => {
    if (!isPasswordWithinByteLimit(value)) {
        throw createError(PASSWORD_BYTE_LIMIT_MESSAGE, 400);
    }
};
