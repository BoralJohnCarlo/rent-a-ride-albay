import createError from "./createError.js";

export const assertConsignmentWriteAccess = (consignment, user) => {
    if (user?.role === "admin") return;
    const owner = consignment.audit?.createdBy;
    const ownerId = owner?._id ?? owner;
    if (user?.role !== "operator" || !ownerId || !user?._id || String(ownerId) !== String(user._id)) {
        throw createError("You do not have permission to modify this consignment.", 403);
    }
};
