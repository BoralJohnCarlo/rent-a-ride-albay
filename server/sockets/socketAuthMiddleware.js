import jwt from "jsonwebtoken";

import User from "../models/User.js";

/*
 * Socket.IO equivalent of authMiddleware.js's `protect` - same JWT cookie,
 * same JWT_SECRET, same User lookup, same stale-token (password changed)
 * and suspension checks. This is the
 * ONLY place a socket gets authenticated; connection is rejected (via
 * next(error)) rather than allowed through unauthenticated.
 *
 * Relies on `io.engine.use(cookieParser())` (see index.js) populating
 * `socket.request.cookies` exactly like cookie-parser does for Express.
 */
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.request.cookies?.token;

        if (!token) {
            return next(new Error("Not authorized. Please log in."));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return next(new Error("User not found."));
        }

        if (user.isTokenStale(decoded.iat)) {
            return next(new Error("Your password was changed. Please log in again."));
        }

        if (user.isSuspended) {
            return next(new Error("Your account has been suspended."));
        }

        socket.user = user;

        next();
    } catch (error) {
        next(new Error("Invalid or expired token."));
    }
};

export default authenticateSocket;
