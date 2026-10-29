import "dotenv/config";

import { parse as parseQueryString } from "node:querystring";
import http from "node:http";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";

import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import errorMiddleware from "./middleware/errorMiddleware.js";
import { startScheduledJobs } from "./cron/index.js";
import { initSocketServer } from "./sockets/index.js";

connectDB();

// (cron disabled for UI testing)

const app = express();

/*
 * Behind a hosting proxy / load balancer every request arrives from the
 * proxy's address, so without this all visitors would share one bucket in
 * every rate limit (and per-IP registration limits). Set TRUST_PROXY to the
 * number of proxy hops in front of the app (usually 1), or to an Express
 * trust value such as "loopback". Left unset it stays off, because trusting
 * X-Forwarded-For with no proxy lets clients spoof their IP.
 */
const trustProxy = process.env.TRUST_PROXY?.trim();

if (trustProxy) {
    app.set(
        "trust proxy",
        /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy
    );
}

/*
 * express-mongo-sanitize's own middleware does `req.query = ...`, which
 * throws in Express 5 (req.query is a getter-only accessor there, recomputed
 * from the raw URL on every access - there's no stable object to mutate in
 * place either). Strip `$`/`.`-prefixed keys at the source instead, inside
 * the query parser itself, and sanitize req.body (still a plain writable
 * property) separately below.
 */
app.set(
    "query parser",
    (queryString) =>
        mongoSanitize.sanitize(
            parseQueryString(queryString)
        )
);

app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    })
);

app.use(
    express.json({
        // Keep the exact bytes so webhook handlers can verify HMAC signatures
        // against the raw payload (re-serialized JSON never byte-matches).
        verify: (req, _res, buf) => {
            if (buf && buf.length) {
                req.rawBody = buf;
            }
        },
    })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
    if (req.body) {
        mongoSanitize.sanitize(req.body);
    }

    next();
});

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Rent-A-Ride Albay API is running.",
    });
});

app.use("/api", routes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found.",
        data: null,
    });
});

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

initSocketServer(httpServer);

httpServer.listen(PORT, () => {
    console.log(
        `🚗 Rent-A-Ride Albay API running on port ${PORT}`
    );
});
