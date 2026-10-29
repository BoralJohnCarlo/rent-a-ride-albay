/*
 * Development-only Socket.IO test client (not a production endpoint).
 *
 * Logs in as an existing user over the real REST API, then connects to the
 * real Socket.IO server using the resulting httpOnly auth cookie (exactly
 * like a browser would - never a second auth mechanism), subscribes to a
 * vehicle's GPS room, and logs every event so Milestone 3's realtime
 * pipeline can be verified without a browser.
 *
 * Usage:
 *   node simulators/socketTestClient.js --email=... --password=... --vehicle=<id>
 *   node simulators/socketTestClient.js --email=... --password=... --vehicle=<id> --api=http://localhost:5000/api
 *   node simulators/socketTestClient.js --cookie="token=..." --vehicle=<id>   (reuse a cookie, skip login)
 *   node simulators/socketTestClient.js --unauthenticated   (verify rejection with no cookie)
 */

import { io } from "socket.io-client";

const parseArgs = (argv) => {
    const args = {};

    for (const raw of argv) {
        const match = raw.match(/^--([^=]+)=(.*)$/);

        if (match) {
            args[match[1]] = match[2];
            continue;
        }

        const flag = raw.match(/^--([^=]+)$/);

        if (flag) {
            args[flag[1]] = true;
        }
    }

    return args;
};

const args = parseArgs(process.argv.slice(2));

const apiBaseUrl = (args.api || "http://localhost:5000/api").replace(
    /\/$/,
    ""
);
const socketUrl = apiBaseUrl.replace(/\/api\/?$/, "");
const vehicleId = args.vehicle || null;

const log = (...parts) => console.log(`[socketTestClient]`, ...parts);

const login = async (email, password) => {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const body = await response.json();

    if (!response.ok) {
        throw new Error(
            `Login failed (${response.status}): ${body?.message || "unknown error"}`
        );
    }

    const setCookie = response.headers.get("set-cookie");

    if (!setCookie) {
        throw new Error(
            "Login succeeded but no Set-Cookie header was returned."
        );
    }

    // Only need the `token=...` pair for the handshake - drop attributes
    // like Path/HttpOnly/SameSite that aren't valid in a request Cookie header.
    const tokenCookie = setCookie.split(",").find((c) => c.trim().startsWith("token="));
    const cookiePair = (tokenCookie || setCookie).split(";")[0];

    return { cookiePair, user: body.data };
};

const run = async () => {
    let cookieHeader = null;

    if (args.cookie) {
        cookieHeader = args.cookie;
        log("Using provided --cookie=, skipping login.");
    } else if (!args.unauthenticated) {
        if (!args.email || !args.password) {
            console.error(
                "Missing --email= / --password= (or pass --unauthenticated to test rejection)."
            );
            process.exit(1);
        }

        try {
            const result = await login(args.email, args.password);
            cookieHeader = result.cookiePair;
            log(`Logged in as ${result.user.email} (role: ${result.user.role}).`);
        } catch (error) {
            console.error(`[socketTestClient] Login error: ${error.message}`);
            process.exit(1);
        }
    } else {
        log("Connecting WITHOUT credentials (expecting rejection)...");
    }

    log(`Connecting to ${socketUrl} ...`);

    const socket = io(socketUrl, {
        withCredentials: true,
        extraHeaders: cookieHeader ? { Cookie: cookieHeader } : {},
    });

    socket.on("connect", () => {
        log(`Connected. socket.id=${socket.id}`);

        if (vehicleId) {
            socket.emit("gps:subscribe", { vehicleId }, (result) => {
                log("gps:subscribe ack:", JSON.stringify(result));
            });
        } else {
            log("No --vehicle= given, skipping subscribe.");
        }
    });

    socket.on("gps:telemetry", (payload) => {
        log("gps:telemetry received:", JSON.stringify(payload));
    });

    // Communication without a newer position (e.g. an out-of-order reading).
    socket.on("gps:heartbeat", (payload) => {
        log("gps:heartbeat received:", JSON.stringify(payload));
    });

    // Fleet alert events (Milestone 11) - admins receive these regardless of
    // gps:subscribe state (see server/sockets/index.js's ADMIN_ROOM join).
    socket.on("alerts:new", (payload) => {
        log("alerts:new received:", JSON.stringify(payload));
    });

    socket.on("alerts:resolved", (payload) => {
        log("alerts:resolved received:", JSON.stringify(payload));
    });

    socket.on("connect_error", (error) => {
        log(`connect_error: ${error.message}`);
    });

    socket.on("disconnect", (reason) => {
        log(`disconnected: ${reason}`);
    });

    process.on("SIGINT", () => {
        if (vehicleId) {
            socket.emit("gps:unsubscribe", { vehicleId }, () => {
                socket.close();
                process.exit(0);
            });
        } else {
            socket.close();
            process.exit(0);
        }
    });
};

run();
