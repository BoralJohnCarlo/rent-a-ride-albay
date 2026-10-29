/*
 * One-time fix for the payments `paymongo.checkoutSessionId` unique index.
 *
 * The index used to be unique + sparse, but every payment stores "" there
 * until a PayMongo checkout opens. `sparse` only skips documents where the
 * field is MISSING, so every not-yet-checked-out payment collided with the
 * others: wherever the index actually got built, the second pending payment
 * failed with E11000. It is now a partial index over non-empty values (see
 * CHECKOUT_SESSION_INDEX_OPTIONS in models/Payment.js); Mongoose won't swap an
 * existing index whose options changed, so this script does.
 *
 * Report only (changes nothing):   node scripts/fixCheckoutSessionIndex.js
 * Apply the change:                node scripts/fixCheckoutSessionIndex.js --apply
 *
 * Safe to run more than once.
 */

import "dotenv/config";
import mongoose from "mongoose";

import { CHECKOUT_SESSION_INDEX_OPTIONS } from "../models/Payment.js";

const APPLY = process.argv.includes("--apply");
const FIELD = "paymongo.checkoutSessionId";

const sameOptions = (index) =>
    index.unique === true &&
    !index.sparse &&
    JSON.stringify(index.partialFilterExpression) ===
        JSON.stringify(
            CHECKOUT_SESSION_INDEX_OPTIONS.partialFilterExpression
        );

const run = async () => {
    // autoIndex off: this script decides what happens to the index, not the
    // model import.
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

    const payments = mongoose.connection.db.collection("payments");

    console.log(
        `Mode: ${APPLY ? "APPLY (will change the index)" : "REPORT ONLY (no changes)"}\n`
    );

    const indexes = await payments.indexes();
    const current = indexes.find(
        (index) =>
            Object.keys(index.key).length === 1 && index.key[FIELD] === 1
    );

    console.log("Current checkout-session index:");
    console.log(
        current
            ? `  ${current.name} ${JSON.stringify({
                  unique: current.unique ?? false,
                  sparse: current.sparse ?? false,
                  partialFilterExpression:
                      current.partialFilterExpression ?? null,
              })}`
            : "  (none - it was never built on this database)"
    );

    const emptyCount = await payments.countDocuments({
        [FIELD]: { $in: ["", null] },
    });

    console.log(
        `\nPayments without a checkout session yet: ${emptyCount}` +
            (emptyCount > 1
                ? " (these are what the old index treated as duplicates)"
                : "")
    );

    // Real duplicates would make the new unique index fail to build - and
    // would mean two payments point at one PayMongo checkout, a data problem
    // to look at by hand rather than paper over.
    const duplicates = await payments
        .aggregate([
            { $match: { [FIELD]: { $type: "string", $gt: "" } } },
            {
                $group: {
                    _id: `$${FIELD}`,
                    count: { $sum: 1 },
                    payments: { $push: "$_id" },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

    if (duplicates.length) {
        console.log(
            `\nSTOP: ${duplicates.length} checkout session(s) are shared by more than one payment:`
        );

        duplicates.forEach((duplicate) =>
            console.log(
                `  ${duplicate._id}: payments ${duplicate.payments.join(", ")}`
            )
        );

        console.log(
            "\nResolve these by hand first; nothing was changed."
        );

        return;
    }

    console.log("Payments sharing a real checkout session: none");

    if (current && sameOptions(current)) {
        console.log("\nThe index is already correct. Nothing to do.");
        return;
    }

    const plan = [
        current ? `drop index ${current.name}` : null,
        `create unique partial index on ${FIELD} (non-empty values only)`,
    ].filter(Boolean);

    console.log(`\nPlan:\n${plan.map((step) => `  - ${step}`).join("\n")}`);

    if (!APPLY) {
        console.log("\nReport only - run again with --apply to make these changes.");
        return;
    }

    if (current) {
        await payments.dropIndex(current.name);
        console.log(`\nDropped ${current.name}.`);
    }

    const name = await payments.createIndex(
        { [FIELD]: 1 },
        CHECKOUT_SESSION_INDEX_OPTIONS
    );

    console.log(`Created ${name}. Done.`);
};

run()
    .catch((error) => {
        console.error("\nFailed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
