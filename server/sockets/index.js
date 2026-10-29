import { Server } from "socket.io";
import cookieParser from "cookie-parser";

import authenticateSocket from "./socketAuthMiddleware.js";
import { registerGpsEvents } from "./gpsEvents.js";
import { registerSupportEvents } from "./supportEvents.js";
import { ADMIN_ROOM, userRoom } from "./rooms.js";

let ioInstance = null;

/*
 * Attaches Socket.IO to the app's existing HTTP server - never a second
 * HTTP server. CORS mirrors the app's own cors() config exactly (same
 * CLIENT_URL env var, credentials enabled for the httpOnly auth cookie).
 */
export const initSocketServer = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true,
        },
    });

    // Reuses the app's own cookie-parser so socket.request.cookies is
    // populated exactly like Express req.cookies is for REST requests.
    io.engine.use(cookieParser());

    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        // Fleet-wide alert events (alerts:new/alerts:resolved) target this
        // room in addition to the relevant vehicle's room - admins always
        // see every alert, not just ones for vehicles they've subscribed to
        // on the GPS page. Membership is decided from socket.user (set by
        // authenticateSocket above), never a client-supplied role.
        if (socket.user?.role === "admin") {
            socket.join(ADMIN_ROOM);
        }

        if (socket.user?._id) {
            socket.join(userRoom(String(socket.user._id)));
        }

        registerGpsEvents(socket);
        registerSupportEvents(socket);
    });

    ioInstance = io;

    return io;
};

export const getIO = () => ioInstance;

/*
 * Drops every live socket signed in as this user - used after a password
 * change/reset, since those sockets authenticated with now-stale tokens.
 * Never throws: a socket hiccup mustn't fail the password change itself.
 */
export const disconnectUserSockets = (userId) => {
    try {
        ioInstance?.in(userRoom(String(userId))).disconnectSockets(true);
    } catch (error) {
        console.error("Failed to disconnect user sockets:", error);
    }
};
