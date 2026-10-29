/*
 * One-time repair for booking vouchers that never reached the rental bill.
 *
 * Until 2026-10-01 a booking's voucher only lowered `pricing.totalAmount`:
 * createRental copied the gross prices into the rental and never took the
 * voucher off, so the rental billed the full price (a customer who paid in
 * full was left owing the discount). New rentals now get a "Discount"
 * adjustment for it at pickup. This script handles the rentals created
 * before that:
 *
 *   - ONGOING rentals: adds the missing discount and recomputes the balance
 *     (only with --apply).
 *   - COMPLETED rentals: listed only. The customer may have paid the discount
 *     amount on top — review each one and refund from the Refunds page if so.
 *
 * Report only (changes nothing):   node scripts/fixVoucherRentalDiscounts.js
 * Apply the ONGOING fixes:         node scripts/fixVoucherRentalDiscounts.js --apply
 *
 * Safe to run more than once: a rental that already has the voucher discount
 * is skipped.
 */

import "dotenv/config";
import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import {
    RENTAL_ADJUSTMENT_TYPE,
    RENTAL_STATUS,
} from "../constants/rentalConstants.js";
import { calculateFinancials } from "../services/rentalService.js";

const APPLY = process.argv.includes("--apply");

const voucherReason = (booking) =>
    booking.voucher?.code
        ? `Voucher ${booking.voucher.code} applied to the booking.`
        : "Voucher applied to the booking.";

const hasVoucherDiscount = (rental) =>
    (rental.adjustments || []).some(
        (adjustment) =>
            adjustment.type === RENTAL_ADJUSTMENT_TYPE.DISCOUNT &&
            /^Voucher\b/.test(adjustment.reason || "")
    );

const peso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
    })}`;

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

    console.log(
        `Mode: ${APPLY ? "APPLY (ONGOING rentals will be fixed)" : "REPORT ONLY (no changes)"}\n`
    );

    const bookings = await Booking.find({
        "voucher.discountAmount": { $gt: 0 },
    })
        .select("bookingCode voucher")
        .lean();

    const bookingById = new Map(
        bookings.map((booking) => [String(booking._id), booking])
    );

    const rentals = await Rental.find({
        booking: { $in: bookings.map((booking) => booking._id) },
        status: { $in: [RENTAL_STATUS.ONGOING, RENTAL_STATUS.COMPLETED] },
    });

    const affected = rentals.filter((rental) => !hasVoucherDiscount(rental));

    const ongoing = affected.filter(
        (rental) => rental.status === RENTAL_STATUS.ONGOING
    );
    const completed = affected.filter(
        (rental) => rental.status === RENTAL_STATUS.COMPLETED
    );

    console.log(`Bookings with a voucher: ${bookings.length}`);
    console.log(`Rentals missing the voucher discount: ${affected.length}\n`);

    console.log(`ONGOING (${ongoing.length}) — the discount will be added:`);

    for (const rental of ongoing) {
        const booking = bookingById.get(String(rental.booking));
        const discount = Number(booking.voucher.discountAmount);

        console.log(
            `  ${rental.rentalCode} (${booking.bookingCode}): ${peso(discount)} off, balance now ${peso(rental.financial.balance)}`
        );

        if (!APPLY) {
            continue;
        }

        const reason = voucherReason(booking);

        // Conditional: never adds it twice, even if run twice at once.
        const pushed = await Rental.updateOne(
            {
                _id: rental._id,
                adjustments: {
                    $not: {
                        $elemMatch: {
                            type: RENTAL_ADJUSTMENT_TYPE.DISCOUNT,
                            reason: /^Voucher\b/,
                        },
                    },
                },
            },
            {
                $push: {
                    adjustments: {
                        type: RENTAL_ADJUSTMENT_TYPE.DISCOUNT,
                        amount: discount,
                        reason,
                        processedBy: null,
                        processedAt: new Date(),
                    },
                },
            }
        );

        if (!pushed.modifiedCount) {
            console.log("    already fixed — skipped");
            continue;
        }

        const fresh = await Rental.findById(rental._id);

        await calculateFinancials(fresh);

        await Rental.updateOne(
            { _id: fresh._id },
            { $set: { financial: fresh.financial.toObject() } }
        );

        console.log(`    fixed — balance now ${peso(fresh.financial.balance)}`);
    }

    console.log(
        `\nCOMPLETED (${completed.length}) — review only; the customer may have paid the discount on top:`
    );

    for (const rental of completed) {
        const booking = bookingById.get(String(rental.booking));

        console.log(
            `  ${rental.rentalCode} (${booking.bookingCode}): voucher ${booking.voucher.code || "?"} worth ${peso(booking.voucher.discountAmount)}; paid ${peso(rental.financial.amountPaid)} of ${peso(rental.financial.finalAmount)}`
        );
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
