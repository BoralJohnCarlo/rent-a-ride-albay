import mongoose from "mongoose";

import Settings from "../models/Settings.js";
import PayoutRequest from "../models/PayoutRequest.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import Vehicle from "../models/Vehicle.js";
import createError from "../utils/createError.js";
import {
    PAYOUT_STATUS,
    PAYOUT_METHOD,
} from "../constants/payoutConstants.js";
import { RENTAL_REFUND_REASON, RENTAL_STATUS } from "../constants/rentalConstants.js";
import { isRefundInEffect } from "../utils/refundUtils.js";
import {
    notifyAdmins,
    notifyUser,
} from "./notificationService.js";
import { creditWallet } from "./walletService.js";
import { getBookingDriverCharges } from "./driverPricingService.js";

/*
 * What a partner's payout is worked out from: the booking total minus what
 * it charged for the driver. Drivers are Rent-A-Ride Albay's, so their fee
 * stays with the platform rather than being shared with the vehicle owner.
 * A free upgrade after a late return (pricing.platformCoveredAmount) is
 * added back: the platform, not the new vehicle's owner, gave that away.
 */
const getPartnerBookingAmount = (booking) =>
    Math.max(
        0,
        Number(booking?.pricing?.totalAmount || 0) +
            Number(booking?.pricing?.platformCoveredAmount || 0) -
            getBookingDriverCharges(booking)
    );

export const getSettingsWithDefaults = async () => {
    const settings = await Settings.findOne().lean();

    if (!settings) {
        return {
            commissionSettings: {
                platformCommissionRate: 10,
                payoutCurrency: "PHP",
                payoutHoldHours: 24,
            },
            penaltySettings: {
                gracePeriodMinutes: 0,
                chargingUnit: "Hour",
                rateType: "derived",
                customRate: 0,
                rateMultiplier: 1,
                maximumCap: 0,
                autoApply: true,
            },
            refundSettings: {
                gracePeriodHours: 24,
                autoApproveRefundThreshold: 500,
                requireCancellationReason: true,
            },
        };
    }

    return {
        ...settings,
        commissionSettings: settings.commissionSettings ?? {
            platformCommissionRate: 10,
            payoutCurrency: "PHP",
            payoutHoldHours: 24,
        },
    };
};

export const updatePayoutSettings = async (settingsData) => {
    const settings = await Settings.findOneAndUpdate(
        {},
        { $set: { commissionSettings: settingsData.commissionSettings } },
        { new: true, upsert: true }
    ).lean();

    return settings;
};

/*
 * The single source of truth for how much of a booking's total a partner
 * actually gets paid. A vehicle with its own negotiated commission (set at
 * consignment approval time, while the platform was in INDIVIDUAL mode)
 * always uses that override, regardless of what the global mode is set to
 * now — a per-vehicle deal doesn't change just because the platform-wide
 * toggle later flips back. Everything else falls back to the platform-wide
 * percentage rate.
 */
export const calculateBookingPayout = (
    bookingAmount,
    vehicle,
    platformCommissionRate
) => {
    const commission = vehicle?.commission;

    if (
        commission?.mode === "PERCENTAGE" &&
        Number.isFinite(commission.value)
    ) {
        const payoutAmount = Math.round(
            bookingAmount * (commission.value / 100)
        );

        return {
            payoutAmount,
            platformCommission: Math.max(
                0,
                bookingAmount - payoutAmount
            ),
        };
    }

    if (
        commission?.mode === "FIXED" &&
        Number.isFinite(commission.value)
    ) {
        const payoutAmount = Math.min(
            commission.value,
            bookingAmount
        );

        return {
            payoutAmount,
            platformCommission: Math.max(
                0,
                bookingAmount - payoutAmount
            ),
        };
    }

    const platformCommission = Math.round(
        bookingAmount * (platformCommissionRate / 100)
    );

    return {
        payoutAmount: bookingAmount - platformCommission,
        platformCommission,
    };
};

const formatPeso = (amount) =>
    Number(amount || 0).toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
    });

/*
 * How much of a booking's price was refunded for a vehicle-performance issue.
 * Only those refunds are the operator's cost — the vehicle they supplied
 * fell short. A refund for any other reason (an overpayment corrected, an
 * adjustment, a cancellation) is the platform's to absorb, so it never
 * touches the operator's payout.
 */
const sumFaultRefunds = (refunds = []) =>
    refunds
        .filter(
            (refund) =>
                isRefundInEffect(refund) &&
                refund.reason ===
                    RENTAL_REFUND_REASON.VEHICLE_PERFORMANCE_ISSUE
        )
        .reduce(
            (total, refund) =>
                total + Number(refund.amount || 0),
            0
        );

export const getFaultRefundTotal = async (bookingId) => {
    const rental = await Rental.findOne({
        booking: bookingId,
    })
        .select("refunds")
        .lean();

    return sumFaultRefunds(rental?.refunds);
};

/*
 * A refund for a vehicle-performance issue was approved. If the operator's
 * payout for that booking is still SCHEDULED (inside its hold window, not yet
 * credited), bring it down to what the operator is actually owed: commission
 * is worked out on the price net of that refund, the same way it will be for
 * a payout scheduled after the refund. Recomputed from scratch each time, so
 * calling it again for the same refunds changes nothing.
 *
 * Returns { outcome, ... }:
 *   "none"         — no payout for this booking yet (it will be scheduled
 *                    net of the refund on completion) or nothing to change
 *   "adjusted"     — the scheduled payout was reduced
 *   "cancelled"    — the refund wipes the payout out entirely
 *   "released"     — the payout was already credited; it can't be changed
 *   "needs_review" — a payout in some other state (pending/approved, or a
 *                    multi-booking one) that an admin has to look at
 */
export const reducePayoutForFaultRefund = async (bookingId, { recoverMissing = false } = {}) => {
    const refundCancellationReason =
        "Fully offset by refunds for a vehicle performance issue.";
    const payout = await PayoutRequest.findOne({
        "items.booking": bookingId,
        $or: [
            {
                status: {
                    $in: [
                        PAYOUT_STATUS.SCHEDULED,
                        PAYOUT_STATUS.PENDING,
                        PAYOUT_STATUS.APPROVED,
                        PAYOUT_STATUS.PAID,
                    ],
                },
            },
            {
                // Only revive payouts cancelled automatically by a refund.
                status: PAYOUT_STATUS.CANCELLED,
                cancellationReason: refundCancellationReason,
                cancelledBy: null,
                scheduledReleaseAt: { $ne: null },
            },
        ],
    });

    if (!payout) {
        // Older completions could skip creating a payout when a full refund
        // offset it. Recover only after completion and a failed refund.
        if (recoverMissing) {
            const rental = await Rental.findOne({ booking: bookingId, status: RENTAL_STATUS.COMPLETED })
                .select("vehicle audit").lean();
            if (rental) {
                const [booking, vehicle] = await Promise.all([
                    Booking.findById(bookingId).lean(),
                    Vehicle.findById(rental.vehicle).lean(),
                ]);
                if (booking && vehicle) {
                    const restored = await scheduleOperatorPayout(
                        booking, vehicle, rental._id, rental.audit?.updatedBy || rental.audit?.createdBy
                    );
                    if (restored) return { outcome: "adjusted", payout: restored };
                }
            }
        }
        return { outcome: "none" };
    }

    if (payout.status === PAYOUT_STATUS.PAID) {
        return { outcome: "released", payout };
    }

    if (
        ![PAYOUT_STATUS.SCHEDULED, PAYOUT_STATUS.CANCELLED].includes(payout.status) ||
        payout.items.length !== 1
    ) {
        return { outcome: "needs_review", payout };
    }

    const item = payout.items[0];

    const [booking, vehicle, refundDeduction, settings] =
        await Promise.all([
            Booking.findById(bookingId)
                .select("pricing bookingCode extensions")
                .lean(),
            Vehicle.findById(item.vehicle)
                .select("operator commission")
                .lean(),
            getFaultRefundTotal(bookingId),
            getSettingsWithDefaults(),
        ]);

    const grossAmount = getPartnerBookingAmount(booking);

    const netAmount = Math.max(
        0,
        grossAmount - refundDeduction
    );

    const { payoutAmount, platformCommission } =
        calculateBookingPayout(
            netAmount,
            vehicle,
            settings.commissionSettings
                .platformCommissionRate
        );

    const before = Number(payout.payoutAmount);

    if (
        payout.status === PAYOUT_STATUS.SCHEDULED &&
        payoutAmount === before &&
        Number(item.refundDeduction || 0) ===
            refundDeduction
    ) {
        return { outcome: "none", payout };
    }

    const cancelling = payoutAmount <= 0;

    const updated =
        await PayoutRequest.findOneAndUpdate(
            {
                _id: payout._id,
                status: payout.status,
                updatedAt: payout.updatedAt,
            },
            {
                $set: cancelling
                    ? {
                          status: PAYOUT_STATUS.CANCELLED,
                          cancelledAt: new Date(),
                          cancellationReason:
                              refundCancellationReason,
                          "audit.updatedBy": null,
                      }
                    : {
                          status: PAYOUT_STATUS.SCHEDULED,
                          cancelledAt: null,
                          cancellationReason: "",
                          "items.0.bookingAmount":
                              netAmount,
                          "items.0.refundDeduction":
                              refundDeduction,
                          "items.0.platformCommission":
                              platformCommission,
                          "items.0.operatorEarnings":
                              payoutAmount,
                          subtotalAmount: netAmount,
                          totalCommission:
                              platformCommission,
                          payoutAmount,
                          "audit.updatedBy": null,
                      },
            },
            { new: true }
        );

    if (!updated) {
        // Released (or cancelled) between the look-up and the update.
        const current = await PayoutRequest.findById(
            payout._id
        ).select("status payoutCode");

        return {
            outcome:
                current?.status === PAYOUT_STATUS.PAID
                    ? "released"
                    : "needs_review",
            payout: current || payout,
        };
    }

    try {
        await notifyUser(payout.operator, {
            type: "payout",
            title: cancelling
                ? "Payout Cancelled After a Refund"
                : "Payout Adjusted for a Refund",
            message: cancelling
                ? `Your scheduled payout ${payout.payoutCode} (${formatPeso(before)}) for booking ${booking?.bookingCode || ""} was cancelled: a refund for a vehicle performance issue offsets it entirely.`
                : `Your scheduled payout ${payout.payoutCode} for booking ${booking?.bookingCode || ""} was adjusted from ${formatPeso(before)} to ${formatPeso(payoutAmount)}. The current vehicle performance refund deduction is ${formatPeso(refundDeduction)}.`,
            variant: "warning",
            category: "Payout",
            metadata: {
                reference: payout.payoutCode,
                relatedId: payout._id,
                relatedModel: "PayoutRequest",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of an adjusted payout:",
            notificationError
        );
    }

    return {
        outcome: cancelling ? "cancelled" : "adjusted",
        payout: updated,
        before,
        after: cancelling ? 0 : payoutAmount,
    };
};

export const createPayoutRequest = async (req) => {
    const operatorId = req.user._id;
    const { items: itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        throw createError(
            "At least one completed booking is required.",
            400
        );
    }

    const bookings = await Booking.find({
        _id: { $in: itemIds },
        status: "Completed",
    })
        .populate("vehicle", "operator commission")
        .lean();

    if (bookings.length === 0) {
        throw createError(
            "No completed bookings selected.",
            400
        );
    }

    const alreadyPaidBookingIds = new Set(
        (
            await PayoutRequest.find({
                "items.booking": {
                    $in: bookings.map(
                        (booking) => booking._id
                    ),
                },
            })
                .select("items.booking")
                .lean()
        ).flatMap((payout) =>
            payout.items.map((item) =>
                item.booking.toString()
            )
        )
    );

    const payableBookings = bookings.filter(
        (booking) =>
            !alreadyPaidBookingIds.has(
                booking._id.toString()
            )
    );

    if (payableBookings.length === 0) {
        throw createError(
            "The selected bookings have already been paid out.",
            409
        );
    }

    const settings = await getSettingsWithDefaults();
    const platformCommissionRate =
        settings.commissionSettings.platformCommissionRate;
    const payoutCurrency =
        settings.commissionSettings.payoutCurrency;

    const items = [];
    let subtotalAmount = 0;
    let totalCommission = 0;
    let payoutAmount = 0;

    // Refunds for a vehicle-performance issue come out of the operator's
    // side (see sumFaultRefunds); every other refund is the platform's.
    const faultRefundsByBooking = new Map(
        (
            await Rental.find({
                booking: {
                    $in: payableBookings.map(
                        (booking) => booking._id
                    ),
                },
            })
                .select("booking refunds")
                .lean()
        ).map((rental) => [
            String(rental.booking),
            sumFaultRefunds(rental.refunds),
        ])
    );

    for (const booking of payableBookings) {
        const refundDeduction =
            faultRefundsByBooking.get(
                String(booking._id)
            ) || 0;

        const bookingAmount = Math.max(
            0,
            getPartnerBookingAmount(booking) -
                refundDeduction
        );

        const { payoutAmount: itemPayout, platformCommission } =
            calculateBookingPayout(
                bookingAmount,
                booking.vehicle,
                platformCommissionRate
            );

        subtotalAmount += bookingAmount;
        totalCommission += platformCommission;
        payoutAmount += itemPayout;

        items.push({
            booking: booking._id,
            rental: booking.rental || null,
            vehicle: booking.vehicle?._id || null,
            bookingAmount,
            refundDeduction,
            platformCommission,
            operatorEarnings: itemPayout,
        });
    }

    if (payoutAmount <= 0) {
        throw createError(
            "Payout amount must be greater than zero.",
            400
        );
    }

    const { payoutCode } = await generatePayoutCode();

    const payoutData = {
        operator: operatorId,
        payoutCode,
        payoutMethod: req.body.payoutMethod || "GCASH",
        items,
        subtotalAmount,
        totalCommission,
        payoutAmount,
        currency: payoutCurrency,
        status: PAYOUT_STATUS.PENDING,
        audit: {
            createdBy: operatorId,
        },
    };

    if (req.body.payoutMethod === "BANK") {
        payoutData.bankAccount = {
            bankName: req.body.bankName,
            accountNumber: req.body.accountNumber,
            accountName: req.body.accountName,
        };
    } else {
        payoutData.gcashAccount = {
            gcashNumber: req.body.gcashNumber,
            accountName: req.body.accountName,
        };
    }

    const payout = new PayoutRequest(payoutData);
    await payout.save();

    const populatedPayout = await PayoutRequest.findById(
        payout._id
    )
        .populate("operator", "firstName lastName email phoneNumber")
        .lean();

    try {
        const operatorName = [
            populatedPayout?.operator?.firstName,
            populatedPayout?.operator?.lastName,
        ]
            .filter(Boolean)
            .join(" ") || "An operator";

        await notifyAdmins({
            type: "payout",
            title: "New Payout Request",
            message: `${operatorName} requested a payout of ${payoutAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })} (${payoutCode}) covering ${items.length} completed booking(s). Awaiting review.`,
            variant: "payment",
            category: "Payout",
            metadata: {
                reference: payoutCode,
                relatedId: payout._id,
                relatedModel: "PayoutRequest",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of payout request:",
            notificationError
        );
    }

    return populatedPayout;
};

export const generatePayoutCode = async () => {
    const prefix = "PY-";
    let code;
    let exists;
    let attempts = 0;

    do {
        const randomNum = Math.floor(
            100000 + Math.random() * 900000
        );
        code = prefix + randomNum;
        exists = await PayoutRequest.exists({
            payoutCode: code,
        });
        attempts++;
    } while (exists && attempts < 10);

    if (exists) {
        throw createError(
            "Unable to generate unique payout code.",
            500
        );
    }

    return { payoutCode: code };
};

export const getPayoutHistory = async (operatorId) => {
    return await PayoutRequest.find({ operator: operatorId })
        .sort({ createdAt: -1 })
        .lean();
};

/*
 * Schedules a completed booking's earnings for automatic payout — no admin
 * approval step. Creates a PayoutRequest in SCHEDULED status with a release
 * time `payoutHoldHours` from now (configurable in Payout Rules settings);
 * the wallet is NOT credited yet. This gives a window for a late refund or
 * dispute on the booking to be caught before the money is actually released
 * to the operator's wallet (and potentially withdrawn out to GCash).
 *
 * Called as a best-effort step from rental completion: the caller is
 * responsible for catching failures here so a payout problem never blocks
 * the rental itself from completing.
 */
export const scheduleOperatorPayout = async (
    booking,
    vehicle,
    rentalId,
    currentUserId
) => {
    const grossAmount = getPartnerBookingAmount(booking);

    if (grossAmount <= 0) {
        return null;
    }

    if (!vehicle?.operator) {
        return null;
    }

    /*
     * Approved refunds for a vehicle-performance issue come off the price
     * before commission is worked out — the operator, not the platform, bears
     * a refund that the vehicle they supplied caused. (Refunds for any other
     * reason don't touch the payout.) A refund approved AFTER this payout is
     * scheduled is applied by reducePayoutForFaultRefund.
     */
    const refundDeduction = await getFaultRefundTotal(
        booking._id
    );

    const bookingAmount = Math.max(
        0,
        grossAmount - refundDeduction
    );

    const alreadyScheduled = await PayoutRequest.exists({
        "items.booking": booking._id,
    });

    if (alreadyScheduled) {
        return null;
    }

    const settings = await getSettingsWithDefaults();
    const platformCommissionRate =
        settings.commissionSettings.platformCommissionRate;
    const payoutCurrency =
        settings.commissionSettings.payoutCurrency;
    const payoutHoldHours = Number(
        settings.commissionSettings.payoutHoldHours ?? 24
    );

    const { payoutAmount, platformCommission } =
        calculateBookingPayout(
            bookingAmount,
            vehicle,
            platformCommissionRate
        );

    if (payoutAmount <= 0 && refundDeduction <= 0) {
        return null;
    }

    const { payoutCode } = await generatePayoutCode();

    const scheduledReleaseAt = new Date(
        Date.now() + payoutHoldHours * 60 * 60 * 1000
    );

    const payout = await PayoutRequest.create({
        operator: vehicle.operator,
        payoutCode,
        payoutMethod: PAYOUT_METHOD.GCASH,
        items: [
            {
                booking: booking._id,
                rental: rentalId || null,
                vehicle: vehicle._id,
                bookingAmount,
                refundDeduction,
                platformCommission,
                operatorEarnings: payoutAmount,
            },
        ],
        subtotalAmount: bookingAmount,
        totalCommission: platformCommission,
        payoutAmount,
        currency: payoutCurrency,
        // Keep a record even when a refund offsets the whole payout, so a
        // failed refund can restore it with its original release schedule.
        status: payoutAmount > 0 ? PAYOUT_STATUS.SCHEDULED : PAYOUT_STATUS.CANCELLED,
        cancelledAt: payoutAmount > 0 ? null : new Date(),
        cancellationReason: payoutAmount > 0 ? "" : "Fully offset by refunds for a vehicle performance issue.",
        scheduledReleaseAt,
        audit: {
            createdBy: currentUserId,
            updatedBy: currentUserId,
        },
    });

    try {
        await notifyUser(vehicle.operator, {
            type: "payout",
            title: payoutAmount > 0 ? "Payout Scheduled" : "Payout Offset by a Refund",
            message: payoutAmount <= 0
                ? `The payout for booking ${booking.bookingCode} is fully offset by a vehicle performance refund. It will be recalculated if the refund is not completed.`
                : `${payoutAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })} from booking ${booking.bookingCode} will be credited to your wallet on ${scheduledReleaseAt.toLocaleString("en-PH")}.${
                refundDeduction > 0
                    ? ` This is after ${formatPeso(refundDeduction)} that was refunded to the customer for a vehicle performance issue.`
                    : ""
            }`,
            variant: "payment",
            category: "Payout",
            metadata: {
                reference: payoutCode,
                relatedId: payout._id,
                relatedModel: "PayoutRequest",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of scheduled payout:",
            notificationError
        );
    }

    return payout;
};

/*
 * Cron entry point: releases every SCHEDULED payout whose hold period has
 * elapsed — credits the operator's wallet and flips it to PAID, atomically
 * per payout so one failure never affects the others in the same sweep.
 */
export const releaseScheduledPayouts = async () => {
    const duePayouts = await PayoutRequest.find({
        status: PAYOUT_STATUS.SCHEDULED,
        scheduledReleaseAt: { $lte: new Date() },
    }).populate("operator", "isSuspended");

    for (const payout of duePayouts) {
        /*
         * Held while the operator is suspended — left SCHEDULED rather than
         * a separate status, so it's simply picked up again by the next
         * sweep once they're reactivated (see updateUserStatus in
         * userService.js), no extra bookkeeping needed on either end.
         */
        if (payout.operator?.isSuspended) {
            continue;
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        let claimed;

        try {
            /*
             * Re-check (atomically, right before crediting) that this is
             * still SCHEDULED — an admin may have cancelled it (see
             * cancelPayout) between the query above and this transaction
             * starting. If so, this matches nothing and the payout is
             * correctly left cancelled instead of being paid out anyway.
             */
            claimed = await PayoutRequest.findOneAndUpdate(
                {
                    _id: payout._id,
                    status: PAYOUT_STATUS.SCHEDULED,
                },
                {
                    $set: {
                        status: PAYOUT_STATUS.PAID,
                        paidAt: new Date(),
                        paidVia: "Auto-Credit (Wallet)",
                    },
                },
                { new: true, session }
            );

            if (!claimed) {
                await session.abortTransaction();
                continue;
            }

            await creditWallet(
                claimed.operator,
                claimed.payoutAmount,
                {
                    description: `Payout ${claimed.payoutCode} released to wallet.`,
                    referenceId: claimed._id,
                    referenceModel: "PayoutRequest",
                    session,
                }
            );

            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();

            console.error(
                `Failed to release scheduled payout ${payout.payoutCode}:`,
                error
            );

            try {
                await notifyAdmins({
                    type: "payout",
                    title: "Scheduled Payout Release Failed",
                    message: `Releasing payout ${payout.payoutCode} (${payout.payoutAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}) to the operator's wallet failed: ${error.message}. Please review.`,
                    variant: "error",
                    category: "Payout",
                    metadata: {
                        reference: payout.payoutCode,
                        relatedId: payout._id,
                        relatedModel: "PayoutRequest",
                    },
                });
            } catch (notifyError) {
                console.error(
                    "Failed to notify admins of payout release failure:",
                    notifyError
                );
            }

            continue;
        } finally {
            session.endSession();
        }

        try {
            await notifyUser(claimed.operator, {
                type: "payout",
                title: "Earnings Credited to Your Wallet",
                message: `${claimed.payoutAmount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })} (${claimed.payoutCode}) has been credited to your wallet.`,
                variant: "payment",
                category: "Payout",
                metadata: {
                    reference: claimed.payoutCode,
                    relatedId: claimed._id,
                    relatedModel: "PayoutRequest",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify operator of released payout:",
                notificationError
            );
        }
    }
};
