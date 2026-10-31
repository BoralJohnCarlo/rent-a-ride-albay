import mongoose from "mongoose";

import ManualRefund from "../models/ManualRefund.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";

import createError from "../utils/createError.js";

import { MANUAL_REFUND_STATUS } from "../constants/paymentConstants.js";

import { notifyAdmins, notifyUser } from "./notificationService.js";
import { recomputeBookingRefundAmount } from "./paymentService.js";
import { findReceiptForSource, receiptEmail } from "./receiptService.js";
import { RECEIPT_SOURCE } from "../models/Receipt.js";

const formatAmount = (amount) =>
    Number(amount || 0).toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
    });

/* "Toyota Vios, Oct 1, 2026" — customers know a trip by vehicle and date. */
const describeTrip = (booking) => {
    const vehicle =
        [booking?.vehicle?.brand, booking?.vehicle?.model]
            .filter(Boolean)
            .join(" ") || "your booking";

    const date = booking?.startDate
        ? new Date(booking.startDate).toLocaleDateString("en-PH", {
              timeZone: "Asia/Manila",
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : "";

    return date ? `${vehicle}, ${date}` : vehicle;
};

/*
 * Records a refund owed to a customer that can't go through the payment, and
 * tells the admins it's waiting on the Owed Refunds list. Never throws — it
 * runs inside booking transitions that must not fail over bookkeeping; a
 * failure falls back to the admin notice alone.
 */
export const createManualRefund = async ({
    booking,
    amount,
    reason,
    payment = null,
    createdBy = null,
}) => {
    const value = Math.round(Number(amount) * 100) / 100;

    if (!booking?._id || !(value > 0)) {
        return null;
    }

    let record = null;

    try {
        record = await ManualRefund.create({
            booking: booking._id,
            customer: booking.customer,
            payment,
            amount: value,
            reason,
            createdBy,
        });
    } catch (createErrorCause) {
        console.error(
            `Failed to record an owed refund for booking ${booking._id}:`,
            createErrorCause
        );
    }

    try {
        await notifyAdmins({
            type: "Refund Requires Manual Action",
            title: "Manual Refund Owed",
            message: `Booking ${booking.bookingCode} is owed a manual refund of ${formatAmount(
                value
            )}: ${reason} ${
                record
                    ? "Pay it outside the app, then mark it on Payments → Owed Refunds."
                    : "It couldn't be added to the Owed Refunds list — keep track of it by hand."
            }`,
            variant: "payment",
            category: "Refund",
            metadata: {
                reference: booking.bookingCode,
                relatedId: booking._id,
                relatedModel: "Booking",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of an owed refund:",
            notificationError
        );
    }

    return record;
};

/* Admin list, newest first, with what's needed to find and pay the customer. */
export const listManualRefunds = async ({ status } = {}) => {
    const query = {};

    if (status && status !== "All") {
        query.status = status;
    }

    const refunds = await ManualRefund.find(query)
        .sort({ createdAt: -1 })
        .limit(500)
        .populate({
            path: "booking",
            select: "bookingCode startDate endDate status vehicle",
            populate: {
                path: "vehicle",
                select: "brand model plateNumber",
            },
        })
        .populate(
            "customer",
            "firstName lastName email phoneNumber"
        )
        .populate("settledBy", "firstName lastName")
        .lean();

    const counts = await ManualRefund.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return {
        data: refunds,
        counts: Object.fromEntries(
            counts.map((entry) => [entry._id, entry.count])
        ),
    };
};

/*
 * An admin records the outcome of an owed refund: paid outside the app, or
 * not paid. Conditional, so two admins can't both settle it (and the customer
 * isn't told twice).
 */
export const settleManualRefund = async (
    id,
    { succeeded = true, notes = "" },
    adminId
) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw createError("Invalid refund ID.", 400);
    }

    const settled = await ManualRefund.findOneAndUpdate(
        {
            _id: id,
            status: MANUAL_REFUND_STATUS.OWED,
        },
        {
            $set: {
                status: succeeded
                    ? MANUAL_REFUND_STATUS.PAID
                    : MANUAL_REFUND_STATUS.NOT_PAID,
                settledAt: new Date(),
                settledBy: adminId,
                settlementNote: String(notes || "")
                    .trim()
                    .slice(0, 255),
            },
        },
        { new: true }
    );

    if (!settled) {
        const exists = await ManualRefund.exists({ _id: id });

        throw createError(
            exists
                ? "This refund was already settled. Refresh to see its status."
                : "Refund not found.",
            exists ? 409 : 404
        );
    }

    await recomputeBookingRefundAmount(settled.booking);

    // A pre-pickup price reduction can have a separate owed refund. If it
    // is later marked Not Paid, restore that credit on any existing rental.
    const rentals = await Rental.find({ booking: settled.booking });
    if (rentals.length) {
        const { calculateFinancials } = await import("./rentalService.js");
        for (const rental of rentals) {
            await calculateFinancials(rental);
            await rental.save();
        }
    }

    const booking = await Booking.findById(settled.booking)
        .select("bookingCode startDate vehicle")
        .populate("vehicle", "brand model")
        .lean();

    const receipt = succeeded
        ? await findReceiptForSource(settled.booking, {
              model: RECEIPT_SOURCE.MANUAL_REFUND,
              id: settled._id,
          })
        : null;

    try {
        await notifyUser(settled.customer, {
            type: succeeded ? "Refund Processed" : "Refund Failed",
            title: succeeded
                ? "Refund Processed"
                : "Refund Could Not Be Completed",
            message: succeeded
                ? `Your refund of ${formatAmount(
                      settled.amount
                  )} for ${describeTrip(booking)} has been sent.`
                : `We were unable to send your refund of ${formatAmount(
                      settled.amount
                  )} for ${describeTrip(
                      booking
                  )}. Please contact support.`,
            variant: succeeded ? "success" : "warning",
            category: "Refund",
            metadata: {
                relatedId: settled.booking,
                relatedModel: "Booking",
            },
            email: succeeded
                ? receiptEmail(receipt, {
                      subject: "Refund sent",
                      fallbackPath: `/customer/bookings/${settled.booking}`,
                  })
                : {
                      actionLabel: "Contact support",
                      actionPath: "/customer/customer-service",
                  },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify customer of a settled owed refund:",
            notificationError
        );
    }

    return settled;
};
