import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import express from "express";
import rateLimit from "express-rate-limit";

test("verification permits a fresh code after five failures and still caps IP traffic", async () => {
    const source = readFileSync(new URL("../../routes/authRoutes.js", import.meta.url), "utf8");
    const start = source.indexOf("const verifyEmailRateLimiter =");
    const end = source.indexOf("const registrationRateLimiter =", start);
    const limiter = new Function("rateLimit", `${source.slice(start, end)}; return verifyEmailRateLimiter;`)(rateLimit);
    const app = express();
    app.use(express.json());
    app.post("/verify-email", limiter, (req, res) => {
        res.status(req.body.code === "fresh-code" ? 200 : 400).json({});
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    try {
        const verify = async code => {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/verify-email`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
            });
            await response.json();
            return response.status;
        };
        for (let i = 0; i < 5; i++) assert.equal(await verify("wrong"), 400);
        assert.equal(await verify("fresh-code"), 200);
        // Other customers using the same connection still have room.
        assert.equal(await verify("fresh-code"), 200);
        for (let i = 7; i < 30; i++) assert.equal(await verify("wrong"), 400);
        assert.equal(await verify("fresh-code"), 429);
    } finally {
        limiter.resetKey("127.0.0.1");
        await new Promise(resolve => server.close(resolve));
    }
});
