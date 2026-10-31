import mongoose from "mongoose";
import createError from "../utils/createError.js";
import { isRefundInEffect } from "../utils/refundUtils.js";
import { normalizeRefundAmount } from "../utils/refundAmount.js";
import { getUpfrontFees } from "../utils/bookingFees.js";

import Rental from "../models/Rental.js";
import Booking from "../models/Booking.js";
import { withBookingCreationTransaction } from "./bookingCreationTransaction.js";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import { nextSequence } from "../models/Sequence.js";
import Payment from "../models/Payment.js";
import ManualRefund from "../models/ManualRefund.js";

import {
    RENTAL_STATUS,
    RENTAL_CODE_PREFIX,
    RENTAL_CHARGE_TYPE,
    RENTAL_ADJUSTMENT_TYPE,
    RENTAL_PAYMENT_STATUS,
    RENTAL_SECURITY_DEPOSIT_STATUS,
    RENTAL_OPERATIONAL_EVENT,
    RENTAL_VEHICLE_OUTCOME,
    RENTAL_REFUND_REASON,
    RENTAL_REFUND_REASON_VALUES,
    RENTAL_REFUND_STATUS,
    RENTAL_EARLY_RETURN_STATUS,
    MAX_REFUND_AMOUNT,
} from "../constants/rentalConstants.js";

import {
    BOOKING_STATUS,
    BOOKING_EXTENSION_STATUS,
    BOOKING_RESCHEDULE_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
    BOOKING_EARLY_PICKUP_MAX_HOURS,
    BOOKING_DRIVER_OPTIONS,
} from "../constants/bookingConstants.js";

import { BUSINESS_TIMEZONE } from "../utils/businessTime.js";
import { getExpectedReturnAt } from "../utils/rentalTiming.js";
import { getDriverLicenseIssue } from "../utils/driverLicense.js";

import { getPickupReference } from "./cancellationPolicyService.js";
import {
    computeBookingLatePenalty,
    describePolicySourceForCustomer,
    getBookingEarlyReturnSettings,
    getBookingPenaltyCap,
} from "./lockedTermsService.js";

import {
    VEHICLE_STATUS,
    VEHICLE_MAINTENANCE_MODE,
    VEHICLE_MAINTENANCE_MODE_VALUES,
} from "../constants/vehicleConstants.js";

import {
    getMaintenanceWindow,
    overlapsMaintenance,
} from "../utils/vehicleMaintenance.js";

import {
    applyVehicleMaintenance,
    clearVehicleMaintenance,
    flagMaintenanceConflicts,
} from "./vehicleMaintenanceService.js";

import {
    DRIVER_STATUS,
    DRIVER_AVAILABILITY,
} from "../constants/driverConstants.js";

import {
    closePendingDriverChangeRequests,
    ensurePickupPaymentVerified,
    ensureCustomerLicenseForDateChange,
} from "./bookingService.js";

import {
    hasBookingConflict,
    hasDriverBookingConflict,
    isDriverBookable,
    isOutOnRental,
    releaseDriverIfIdle,
} from "./bookingConflictService.js";

import { alertAdminsOfStrandedBookings } from "./vehicleService.js";

import {
    getTurnaroundBufferMs,
    isEarlyPickupOverrideEnabled,
} from "./settingsService.js";

import { reconcileLateReturnConflicts } from "./lateReturnConflictService.js";

import {
    PAYMENT_TYPE,
    PAYMENT_STATUS,
    PAYMENT_REFUND_STATUS,
    MANUAL_REFUND_STATUS,
    PAYMENT_REFUND_REASON,
} from "../constants/paymentConstants.js";

import Settings from "../models/Settings.js";
import {
    notifyUser,
    notifyAdmins,
    hasRecentNotification,
} from "./notificationService.js";
import {
    scheduleOperatorPayout,
    reducePayoutForFaultRefund,
} from "./payoutService.js";
import { issueGatewayRefund } from "./paymentService.js";
import {
    findReceiptForSource,
    receiptEmail,
    syncBookingReceiptsSafely,
} from "./receiptService.js";
import { RECEIPT_SOURCE } from "../models/Receipt.js";
import { createVoucher } from "./voucherService.js";
import {
    VOUCHER_TYPE,
    VOUCHER_DISCOUNT_METHOD,
    VOUCHER_ASSIGNMENT_TYPE,
} from "../constants/voucherConstants.js";

export const formatAmount = (value) => {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/*
 * Notify the rental's customer about a late-return penalty change.
 * Best-effort: a failure here must never roll back the penalty action.
 */
const notifyPenaltyAction = async (
    rental,
    { type, title, message, variant = "payment" }
) => {
    if (!rental?.customer) {
        return;
    }

    try {
        await notifyUser(rental.customer, {
            type,
            title,
            message,
            variant,
            category: "Rental",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to send penalty notification:",
            notificationError
        );
    }
};

/*
 * Notify the operator that owns the rental's vehicle about a lifecycle event
 * (pickup, return, damage). Best-effort: never roll back the rental action.
 */
const notifyRentalVehicleOperator = async (
    rental,
    { type, title, message, variant = "info" }
) => {
    try {
        const vehicle = await Vehicle.findById(rental.vehicle)
            .select("operator brand model")
            .lean();

        if (!vehicle?.operator) {
            return;
        }

        await notifyUser(vehicle.operator, {
            type,
            title,
            message,
            variant,
            category: "Rental",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify rental vehicle operator:",
            notificationError
        );
    }
};

/*
 * Notify the rental's customer about a lifecycle event (confirmed, returned,
 * completed, deposit released). Best-effort: never roll back the rental action.
 */
const notifyRentalCustomer = async (
    rental,
    {
        type,
        title,
        message,
        variant = "info",
        category = "Rental",
        email = null,
    }
) => {
    if (!rental?.customer) {
        return;
    }

    try {
        await notifyUser(rental.customer, {
            type,
            title,
            message,
            variant,
            category,
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
            email,
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify rental customer:",
            notificationError
        );
    }
};

/*
 * Email option for a rental notice whose details live on the booking's
 * statement (refunds still on their way, charges): links straight to it.
 */
const statementEmail = (rental) => ({
    actionLabel: "View booking statement",
    actionPath: `/documents/statements/${rental.booking}`,
});

/* A date and time as it reads in the Philippines. */
const formatManilaDateTime = (value) =>
    new Date(value).toLocaleString("en-PH", {
        timeZone: BUSINESS_TIMEZONE,
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

/*
 * Where the rental period starts: the actual hand-over time, or — for rentals
 * created before hand-over times were tracked — the booked start date.
 */
const getRentalPeriodStart = (rental) =>
    rental.bookingPeriod?.actualStartDate ||
    rental.bookingPeriod?.originalStartDate;

// Moved to utils/rentalTiming.js (shared with lateReturnConflictService).

/*
 * Scheduled sweep: remind customers whose ongoing rental is due back within
 * ~24h, and flag customers/operators/admins when a rental is overdue and has
 * not been returned. Best-effort and de-duplicated to once per rental per day.
 */
export const sendRentalReturnReminders = async () => {
    const now = new Date();
    const dueSoonCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const ongoingRentals = await Rental.find({
        status: RENTAL_STATUS.ONGOING,
        "return.date": null,
    }).select(
        "rentalCode booking customer vehicle bookingPeriod actualEndDate extensions"
    );

    for (const rental of ongoingRentals) {
        try {
            const expectedReturnAt = getExpectedReturnAt(rental);

            if (!expectedReturnAt) {
                continue;
            }

            const isOverdue = expectedReturnAt.getTime() < now.getTime();
            const isDueSoon =
                !isOverdue &&
                expectedReturnAt.getTime() <= dueSoonCutoff.getTime();

            if (!isOverdue && !isDueSoon) {
                continue;
            }

            const reminderType = isOverdue
                ? "Rental Overdue"
                : "Rental Return Reminder";

            const alreadySent = await hasRecentNotification({
                recipient: rental.customer,
                type: reminderType,
                relatedId: rental._id,
                since: startOfDay,
            });

            if (alreadySent) {
                continue;
            }

            if (isOverdue) {
                await notifyRentalCustomer(rental, {
                    type: reminderType,
                    title: "Rental Return Overdue",
                    message: `Rental ${rental.rentalCode} was due back on ${formatManilaDateTime(expectedReturnAt)} and has not been returned. Please return the vehicle as soon as possible — late penalties continue to accrue.`,
                    variant: "warning",
                    email: {
                        actionPath: `/customer/bookings/${rental.booking}`,
                    },
                });

                await notifyRentalVehicleOperator(rental, {
                    type: reminderType,
                    title: "Vehicle Return Overdue",
                    message: `Rental ${rental.rentalCode} was due back on ${formatManilaDateTime(expectedReturnAt)} and the vehicle has not been returned yet.`,
                    variant: "warning",
                });
            } else {
                await notifyRentalCustomer(rental, {
                    type: reminderType,
                    title: "Return Due Soon",
                    message: `Rental ${rental.rentalCode} is due back on ${formatManilaDateTime(expectedReturnAt)}. Please plan your return to avoid late penalties.`,
                    variant: "info",
                    email: {
                        actionPath: `/customer/bookings/${rental.booking}`,
                    },
                });
            }
        } catch (error) {
            console.error(
                `Return reminder failed for rental ${rental?._id}:`,
                error
            );
        }
    }
};

const generateRentalCode = async (session = null) => {
    const rentals =
        await Rental.find({
            rentalCode: {
                $regex: `^${RENTAL_CODE_PREFIX}\\d+$`,
            },
        })
            .select("rentalCode")
            .session(session)
            .lean();

    let latestNumber = 0;

    for (const rental of rentals) {
        const currentNumber = Number(
            rental.rentalCode.replace(
                RENTAL_CODE_PREFIX,
                ""
            )
        );

        if (!Number.isNaN(currentNumber)) {
            latestNumber = Math.max(
                latestNumber,
                currentNumber
            );
        }
    }

    const nextNumber = await nextSequence(
        "rentalCode",
        latestNumber,
        session
    );

    return `${RENTAL_CODE_PREFIX}${String(
        nextNumber
    ).padStart(4, "0")}`;
};

export const getRentalByIdOrThrow = async (
    rentalId
) => {
    const rental =
        await Rental.findById(
            rentalId
        );

    if (!rental) {
        throw createError(
            "Rental not found.",
            404
        );
    }

    return rental;
};

const getBookingByIdOrThrow = async (
    bookingId
) => {
    const booking =
        await Booking.findById(
            bookingId
        );

    if (!booking) {
        throw createError(
            "Booking not found.",
            404
        );
    }

    return booking;
};

const getVehicleByIdOrThrow = async (
    vehicleId
) => {
    const vehicle =
        await Vehicle.findById(
            vehicleId
        );

    if (!vehicle) {
        throw createError(
            "Vehicle not found.",
            404
        );
    }

    return vehicle;
};

const getDriverByIdOrThrow = async (
    driverId
) => {
    const driver =
        await Driver.findById(
            driverId
        );

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    return driver;
};

const getOperatorVehicleIds = async (
    operatorId
) => {
    const vehicles = await Vehicle.find({
        operator: operatorId,
    })
        .select("_id")
        .lean();

    return vehicles.map((vehicle) => vehicle._id);
};

const ensureBookingEligibleForPickup = (
    booking
) => {
    if (booking.priceChangeSettlementPending) {
        throw createError("The booking's price change is still settling. Please refresh and try pickup again shortly.", 409);
    }
    if (
        booking.status !==
        BOOKING_STATUS.APPROVED
    ) {
        throw createError(
            "Only approved bookings can be picked up.",
            400
        );
    }
};

const ensureVehicleEligibleForPickup = (
    vehicle
) => {
    if (
        vehicle.status ===
        VEHICLE_STATUS.ARCHIVED
    ) {
        throw createError(
            "Archived vehicles cannot be rented.",
            400
        );
    }

    if (
        vehicle.status !==
            VEHICLE_STATUS.RESERVED &&
        vehicle.status !==
            VEHICLE_STATUS.PICKUP_IN_PROGRESS
    ) {
        throw createError(
            "Vehicle must be Reserved or in pickup process before pickup.",
            400
        );
    }

    if (
        vehicle.availability?.bookingEnabled ===
        false
    ) {
        throw createError(
            "Vehicle is currently unavailable for rental.",
            400
        );
    }
};

const ensureDriverEligibleForPickup = async (
    driverId,
    validThrough = null
) => {
    if (!driverId) {
        return null;
    }

    const driver =
        await getDriverByIdOrThrow(
            driverId
        );

    if (
        driver.status !==
            DRIVER_STATUS.ACTIVE ||
        driver.archive?.isArchived
    ) {
        throw createError(
            "Selected driver is not active.",
            400
        );
    }

    if (!(await isDriverBookable(driver))) {
        throw createError(
            "Selected driver is not available.",
            400
        );
    }

    const licenseIssue = getDriverLicenseIssue(driver, validThrough);

    if (licenseIssue) {
        throw createError(
            licenseIssue === "expired"
                ? "The assigned driver's license has expired. Reassign the booking to another driver before pickup."
                : "The assigned driver's license expires before this rental ends. Reassign the booking to another driver before pickup.",
            400
        );
    }

    // Busy only while actually out: a returned rental that's awaiting
    // completion doesn't hold the driver.
    if (await isOutOnRental("driver", driverId)) {
        throw createError(
            "The driver is still out on another rental that hasn't been returned yet.",
            409
        );
    }

    return driver;
};

const buildInspection = ({
    date,
    processedBy,
    condition,
    odometer,
    fuelLevel,
    notes,
    photos,
}) => ({
    date: date
        ? new Date(date)
        : new Date(),

    processedBy,

    condition:
        condition ?? null,

    odometer:
        odometer ?? null,

    fuelLevel:
        fuelLevel ?? null,

    notes:
        notes?.trim() ?? "",

    photos:
        Array.isArray(photos)
            ? photos
            : [],
});

/*
 * What the customer paid online toward a booking: the reservation-fee
 * payment (the whole rental total for a pay-in-full booking) plus any
 * extension-fee payments. These live in the Payment collection, not in
 * `rental.payments`, which only holds what an admin recorded by hand.
 *
 * A payment fully refunded through the gateway is REFUNDED rather than
 * VERIFIED, but it is still counted here at its gross value. Both callers
 * subtract the rental's approved refunds separately, so dropping the payment
 * as well would count the same refund twice — a refunded customer would
 * suddenly appear to owe the whole amount again.
 *
 * A refund made on a payment BEFORE pickup, though, has no rental refund
 * entry (e.g. a reschedule to fewer days refunded part of a pay-in-full
 * payment). Nothing else subtracts it, so it's netted out here — otherwise the
 * rental shows the customer overpaid and that money is refundable twice.
 * Refunds an admin marked as not completed ("failed") returned nothing.
 */
const getBookingFeesPaid = async (
    bookingId,
    rental = null
) => {
    const bookingPayments =
        await Payment.find({
            booking: bookingId,
            paymentType:
                {
                    $in: [
                        PAYMENT_TYPE.RESERVATION_FEE,
                        PAYMENT_TYPE.EXTENSION_FEE,
                    ],
                },
            status:
                {
                    $in: [
                        PAYMENT_STATUS.VERIFIED,
                        PAYMENT_STATUS.REFUNDED,
                    ],
                },
        })
            .select("amount refund")
            .lean();

    const trackedByRental = new Set(
        (rental?.refunds || [])
            .filter((refund) => refund.gatewayPayment)
            .map((refund) => String(refund.gatewayPayment))
    );

    // Separate owed refunds are additional to the payment's single refund
    // slot. Reserve owed money too, just as pending payment refunds are netted.
    const manualRefunds = await ManualRefund.find({
        booking: bookingId,
        status: { $in: [MANUAL_REFUND_STATUS.OWED, MANUAL_REFUND_STATUS.PAID] },
    }).select("amount").lean();
    const manualTotal = manualRefunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

    return bookingPayments.reduce((total, payment) => {
        const untrackedRefund =
            payment.refund &&
            payment.refund.status !==
                PAYMENT_REFUND_STATUS.FAILED &&
            !trackedByRental.has(String(payment._id))
                ? Number(payment.refund.amount || 0)
                : 0;

        return (
            total +
            Number(payment.amount) -
            untrackedRefund
        );
    }, 0) - manualTotal;
};

export const calculateFinancials = async (
    rental
) => {
    const extensionCharges =
        rental.charges
            .filter(
                (charge) =>
                    charge.type ===
                    RENTAL_CHARGE_TYPE.EXTENSION
            )
            .reduce(
                (total, charge) =>
                    total +
                    Number(
                        charge.amount
                    ),
                0
            );

    const lateCharges =
        rental.charges
            .filter(
                (charge) =>
                    charge.type ===
                    RENTAL_CHARGE_TYPE.LATE
            )
            .reduce(
                (total, charge) =>
                    total +
                    Number(
                        charge.amount
                    ),
                0
            );

    const damageCharges =
        rental.charges
            .filter(
                (charge) =>
                    charge.type ===
                    RENTAL_CHARGE_TYPE.DAMAGE
            )
            .reduce(
                (total, charge) =>
                    total +
                    Number(
                        charge.amount
                    ),
                0
            );

    const otherCharges =
        rental.charges
            .filter(
                (charge) =>
                    charge.type ===
                    RENTAL_CHARGE_TYPE.OTHER
            )
            .reduce(
                (total, charge) =>
                    total +
                    Number(
                        charge.amount
                    ),
                0
            );

    const discounts =
        rental.adjustments
            .filter(
                (adjustment) =>
                    adjustment.type ===
                    RENTAL_ADJUSTMENT_TYPE.DISCOUNT
            )
            .reduce(
                (total, adjustment) =>
                    total +
                    Number(
                        adjustment.amount
                    ),
                0
            );

    const adjustments =
        rental.adjustments
            .filter(
                (adjustment) =>
                    adjustment.type ===
                    RENTAL_ADJUSTMENT_TYPE.ADJUSTMENT
            )
            .reduce(
                (total, adjustment) =>
                    total +
                    Number(
                        adjustment.amount
                    ),
                0
            );

    const refunds =
        rental.refunds
            .filter(isRefundInEffect)
            .reduce(
                (total, refund) =>
                    total +
                    Number(
                        refund.amount
                    ),
                0
            );

const rentalPaymentsPaid =
    rental.payments
        .filter(
            (payment) =>
                payment.status ===
                RENTAL_PAYMENT_STATUS.VERIFIED
        )
        .reduce(
            (total, payment) =>
                total +
                Number(
                    payment.amount
                ),
            0
        );

const bookingFeesPaid =
    await getBookingFeesPaid(
        rental.booking,
        rental
    );

const amountPaid =
    rentalPaymentsPaid +
    bookingFeesPaid;

const securityDepositApplied =
    rental.securityDeposit?.required
        ? Number(
              rental.securityDeposit
                  .amountDeducted || 0
          )
        : 0;

    const finalAmount = Math.max(
        0,
        Number(
            rental.financial
                .baseRentalCharge
        ) +
            Number(
                rental.financial
                    .reservationFee
            ) +
            Number(
                rental.financial
                    .pickupDistanceFee || 0
            ) +
            Number(
                rental.financial
                    .returnDistanceFee || 0
            ) +
            Number(
                rental.financial
                    .driverFee || 0
            ) +
            extensionCharges +
            lateCharges +
            damageCharges +
            otherCharges -
            discounts -
            adjustments -
            refunds
    );

    const balance = Math.max(
        0,
        finalAmount -
            amountPaid -
            securityDepositApplied
    );

    rental.financial.extensionCharges =
        extensionCharges;

    rental.financial.lateCharges =
        lateCharges;

    rental.financial.damageCharges =
        damageCharges;

    rental.financial.otherCharges =
        otherCharges;

    rental.financial.discounts =
        discounts;

    rental.financial.adjustments =
        adjustments;

    rental.financial.refunds =
        refunds;

    rental.financial.finalAmount =
        finalAmount;

    rental.financial.amountPaid =
        amountPaid;

    rental.financial.securityDepositApplied =
        securityDepositApplied;

    rental.financial.balance =
        balance;
};

export const syncApprovedBookingExtension = async (
    booking,
    extension,
    currentUserId,
    session = null
) => {
    const rentalQuery = Rental.findOne({
        booking: booking._id,
        status: RENTAL_STATUS.ONGOING,
    });
    if (session) {
        rentalQuery.session(session);
    }
    const rental = await rentalQuery;

    if (!rental) {
        return null;
    }

    const extensionData = extension.toObject
        ? extension.toObject()
        : extension;

    const existingExtension =
        rental.extensions.find(
            (rentalExtension) =>
                rentalExtension.bookingExtensionId &&
                String(
                    rentalExtension.bookingExtensionId
                ) === String(extensionData._id)
        );

    if (existingExtension) {
        return rental;
    }

    const {
        _id: bookingExtensionId,
        ...extensionPayload
    } = extensionData;

    rental.extensions.push({
        bookingExtensionId,
        ...extensionPayload,
    });

    /*
     * The booking's end date has already been advanced to the approved
     * extension date. Keep the rental's effective end date in sync so the
     * late-return penalty is measured against the paid-for period, not the
     * original booking window.
     */
    rental.actualEndDate = booking.endDate;

    rental.financial.baseRentalCharge =
        booking.pricing.subtotal;

    const existingCharge =
        rental.charges.find(
            (charge) =>
                charge.type ===
                    RENTAL_CHARGE_TYPE.EXTENSION &&
                charge.referenceId &&
                String(
                    charge.referenceId
                ) === String(bookingExtensionId)
        );

    if (!existingCharge) {
        rental.charges.push({
            type:
                RENTAL_CHARGE_TYPE.EXTENSION,

            amount:
                extension.pricing.amount,

            description:
                "Approved booking extension.",

            referenceId:
                bookingExtensionId,

            addedBy:
                currentUserId,

            addedAt:
                new Date(),
        });
    }

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(
        rental
    );

    await rental.save(
        session ? { session } : undefined
    );

    return rental;
};

export const appendOperationalEvent = (
    rental,
    {
        type,
        performedBy,
        description = "",
        referenceId = null,
        date = new Date(),
    }
) => {
    rental.operationalEvents.push({
        type,
        date,
        performedBy,
        description,
        referenceId,
    });
};


export const syncBookingRefundAmount = async (
    bookingId
) => {
    if (!bookingId) {
        return;
    }

    const rentals = await Rental.find({
        booking: bookingId,
    }).select("refunds");

    /* Only Approved refunds actually reduce what the customer is owed —
       a rental can also carry Pending/Rejected requests (customer-initiated,
       see requestRefund) that must not inflate the booking's refund total,
       and a refund settled as "not completed" never paid anything. */
    const rentalTotal = rentals.reduce(
        (sum, rental) =>
            sum +
            (rental.refunds || [])
                .filter(isRefundInEffect)
                .reduce(
                    (refundSum, refund) =>
                        refundSum +
                        Number(refund.amount || 0),
                    0
                ),
        0
    );

    // Payment refunds linked to rental entries are the same money. Include
    // earlier booking refunds and paid owed refunds without counting twice.
    const trackedPayments = rentals.flatMap((rental) =>
        (rental.refunds || []).flatMap((refund) =>
            refund.gatewayPayment ? [refund.gatewayPayment] : []
        )
    );
    const [payments, manualRefunds] = await Promise.all([
        Payment.find({
            booking: bookingId,
            _id: { $nin: trackedPayments },
            "refund.status": PAYMENT_REFUND_STATUS.SUCCEEDED,
        }).select("refund.amount").lean(),
        ManualRefund.find({ booking: bookingId, status: MANUAL_REFUND_STATUS.PAID })
            .select("amount").lean(),
    ]);
    const total = Math.round((rentalTotal +
        payments.reduce((sum, payment) => sum + Number(payment.refund?.amount || 0), 0) +
        manualRefunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0)
    ) * 100) / 100;

    const booking = await Booking.findByIdAndUpdate(
        bookingId,
        { refundAmount: total },
        { new: true }
    );

    if (!booking) {
        throw createError("Booking not found for refund sync.", 404);
    }

    return total;
};


/*
 * The earliest moment after `pickupAt` (and before `searchEnd`) that this
 * vehicle or driver is committed elsewhere: another live booking's start, or
 * the start of an admin-blocked period on the vehicle. Null if nothing is in
 * the way.
 */
const findNextCommitmentStart = async (
    booking,
    vehicle,
    pickupAt,
    searchEnd,
    session
) => {
    const window = {
        _id: { $ne: booking._id },
        startDate: { $gt: pickupAt, $lt: searchEnd },
    };

    // Sequential, not Promise.all: a transaction session can't run
    // operations concurrently.
    const nextVehicleBooking = await Booking.findOne({
        ...window,
        vehicle: booking.vehicle,
        status: { $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES },
    })
        .sort({ startDate: 1 })
        .select("startDate")
        .session(session)
        .lean();

    // Same statuses as hasDriverBookingConflict.
    const nextDriverBooking = booking.driver
        ? await Booking.findOne({
              ...window,
              driver: booking.driver,
              status: { $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES },
          })
              .sort({ startDate: 1 })
              .select("startDate")
              .session(session)
              .lean()
        : null;

    const starts = [
        nextVehicleBooking?.startDate,
        nextDriverBooking?.startDate,
        getMaintenanceWindow(vehicle)?.start,
        ...(vehicle.availability?.blockedDates || []).map(
            (blocked) => blocked.startDate
        ),
    ]
        .map((value) => new Date(value).getTime())
        .filter(
            (time) =>
                Number.isFinite(time) &&
                time > pickupAt.getTime() &&
                time < searchEnd.getTime()
        );

    return starts.length ? new Date(Math.min(...starts)) : null;
};

/*
 * The rental period starts at the actual hand-over, not the booked pickup
 * time: it runs from `pickupAt` for the same length as the booking (booked
 * days plus any extension already approved), so a customer picked up at
 * 2:00 PM is due back at 2:00 PM. A late pickup can never push the return
 * into the next booking or a blocked period, turnaround buffer included —
 * the due-back time is capped one buffer before that start. A pickup so late
 * that no time is left before then is refused.
 */
const resolveActualRentalPeriod = async (
    booking,
    vehicle,
    pickupAt,
    session
) => {
    const bookedDurationMs =
        new Date(booking.endDate).getTime() -
        new Date(booking.startDate).getTime();

    const desiredEnd = new Date(pickupAt.getTime() + bookedDurationMs);

    const bufferMs = await getTurnaroundBufferMs();

    // Anything starting within one buffer after the desired end matters too.
    const nextCommitmentStart = await findNextCommitmentStart(
        booking,
        vehicle,
        pickupAt,
        new Date(desiredEnd.getTime() + bufferMs),
        session
    );

    const cappedEnd = nextCommitmentStart
        ? new Date(nextCommitmentStart.getTime() - bufferMs)
        : null;

    if (cappedEnd && cappedEnd <= pickupAt) {
        throw createError(
            "It's too late to release this vehicle: it's needed for another booking (including the turnaround time between rentals) before this rental could start. Reschedule or cancel this booking instead.",
            409
        );
    }

    const capped = Boolean(cappedEnd && cappedEnd < desiredEnd);

    return {
        start: pickupAt,
        end: capped ? cappedEnd : desiredEnd,
        capped,
    };
};

/*
 * An early release (before the usual window, Settings → Bookings → Early
 * Pickup) moves the whole rental earlier, possibly by days, into time that
 * was never checked for this booking. Unlike a late pickup it is never
 * shortened to fit: the customer paid for the full duration, so it's refused
 * if the moved-up rental — plus the turnaround buffer after it — would touch
 * another live booking of the vehicle or driver (including one already under
 * way but not picked up yet) or a blocked period. Time before it needs no
 * buffer, same as a normal pickup (the previous rental only has to be back).
 */
const ensureEarlyReleaseIsClear = async (booking, vehicle, pickupAt) => {
    const durationMs =
        new Date(booking.endDate).getTime() -
        new Date(booking.startDate).getTime();
    const bufferMs = await getTurnaroundBufferMs();
    const clearUntil = new Date(pickupAt.getTime() + durationMs + bufferMs);

    const refuse = (what) =>
        createError(
            `This vehicle can't be released early: moving the rental to start now would overlap ${what} (turnaround time included). Release it in the usual window, or reschedule one of the bookings.`,
            409
        );

    if (
        await hasBookingConflict(
            booking.vehicle,
            pickupAt,
            clearUntil,
            booking._id,
            { bufferMs: 0 }
        )
    ) {
        throw refuse("another booking of this vehicle");
    }

    if (
        booking.driver &&
        (await hasDriverBookingConflict(
            booking.driver,
            pickupAt,
            clearUntil,
            booking._id,
            { bufferMs: 0 }
        ))
    ) {
        throw refuse("another booking of its driver");
    }

    const blocked = (vehicle.availability?.blockedDates || []).some(
        (range) =>
            new Date(range.startDate) < clearUntil &&
            new Date(range.endDate) > pickupAt
    );

    if (blocked) {
        throw refuse("dates blocked on this vehicle");
    }
    if (overlapsMaintenance(vehicle, pickupAt, clearUntil)) {
        throw refuse("scheduled maintenance");
    }
};

/*
 * Moves the booking onto its actual rental period at pickup. The booked
 * schedule is kept in scheduledStartDate/scheduledEndDate. Extension dates
 * (approved and still-pending) move by the same amount as the end date so
 * they stay relative to the new end, with their hours and prices unchanged.
 */
const applyActualRentalPeriod = (booking, period) => {
    const endShiftMs =
        period.end.getTime() - new Date(booking.endDate).getTime();

    booking.scheduledStartDate ??= booking.startDate;
    booking.scheduledEndDate ??= booking.endDate;

    (booking.extensions || []).forEach((extension) => {
        if (
            ![
                BOOKING_EXTENSION_STATUS.APPROVED,
                BOOKING_EXTENSION_STATUS.PENDING,
            ].includes(extension.status)
        ) {
            return;
        }

        extension.previousEndDate = new Date(
            new Date(extension.previousEndDate).getTime() + endShiftMs
        );
        extension.requestedEndDate = new Date(
            new Date(extension.requestedEndDate).getTime() + endShiftMs
        );
    });

    booking.startDate = period.start;
    booking.endDate = period.end;
};

export const createRental = async (
    bookingId,
    currentUserId,
    // The admin confirmed releasing before the usual window (only honoured
    // while Settings → Bookings → Early Pickup allows it).
    { releaseEarly = false } = {}
) => {
    // Read the resource ids before starting, then recheck them under the
    // guards. An assignment change must not let pickup use an unlocked driver.
    const expected = await Booking.findById(bookingId).select("vehicle driver customer").lean();
    if (!expected) throw createError("Booking not found.", 404);
    const { rentalDoc, actualPeriod, isEarlyRelease, bookedPickupAt } = await withBookingCreationTransaction(
        [
            `booking:${bookingId}`,
            `customer:${expected.customer}`,
            `vehicle:${expected.vehicle}`,
            ...(expected.driver ? [`driver:${expected.driver}`] : []),
        ],
        async (session) => {
        const booking = await Booking.findById(
            bookingId
        ).session(session);

        if (!booking) {
            throw createError(
                "Booking not found.",
                404
            );
        }

        if (String(booking.vehicle) !== String(expected.vehicle) ||
            String(booking.driver ?? "") !== String(expected.driver ?? "") ||
            String(booking.customer) !== String(expected.customer)) {
            throw createError("This booking's vehicle or driver changed. Refresh and try pickup again.", 409);
        }

        ensureBookingEligibleForPickup(
            booking
        );

        /*
         * The rental is timed from the hand-over, so releasing it far ahead
         * of the booked pickup would silently move the whole rental earlier.
         */
        const bookedPickupAt = getPickupReference(booking.startDate);
        const earliestPickupAt = bookedPickupAt
            ? new Date(
                  bookedPickupAt.getTime() -
                      BOOKING_EARLY_PICKUP_MAX_HOURS * 60 * 60 * 1000
              )
            : null;

        const isEarlyRelease = Boolean(
            earliestPickupAt && Date.now() < earliestPickupAt.getTime()
        );

        if (isEarlyRelease) {
            const overrideEnabled = await isEarlyPickupOverrideEnabled();

            if (!overrideEnabled || !releaseEarly) {
                throw createError(
                    `This vehicle can be released from ${formatManilaDateTime(earliestPickupAt)} (${BOOKING_EARLY_PICKUP_MAX_HOURS} hours before the booked pickup time). To start earlier, ${
                        overrideEnabled
                            ? "confirm an early release"
                            : "reschedule the booking"
                    }.`,
                    400
                );
            }
        }

        const existingRental =
            await Rental.findOne({
                booking: booking._id,
            }).session(session);

        if (existingRental) {
            throw createError(
                "A rental already exists for this booking.",
                409
            );
        }

        /*
         * The previous customer must actually have brought the vehicle back.
         * Its rental may still be awaiting completion (the vehicle then still
         * reads Rented), which doesn't block this pickup.
         */
        if (
            await isOutOnRental("vehicle", booking.vehicle, {
                excludeBookingId: booking._id,
                session,
            })
        ) {
            throw createError(
                "This vehicle hasn't been returned from its previous rental yet.",
                409
            );
        }

        /*
         * Maintenance blocks only its own window: refused if it overlaps the
         * rental from now to the booked return, otherwise the vehicle can go
         * even while its status still reads Maintenance (the window ended
         * and the sweep hasn't caught up yet).
         */
        const vehicleForPickup = await Vehicle.findById(booking.vehicle)
            .select("status maintenance")
            .session(session)
            .lean();

        if (
            overlapsMaintenance(
                vehicleForPickup,
                new Date(),
                booking.endDate
            )
        ) {
            const until = getMaintenanceWindow(vehicleForPickup)?.until;

            throw createError(
                `This vehicle is ${
                    until
                        ? `under maintenance until ${formatManilaDateTime(until)}`
                        : "off the road for maintenance"
                }, overlapping this rental. Send the customer their options from the booking (another vehicle or a full refund).`,
                409
            );
        }

        // Lock vehicle with PICKUP_IN_PROGRESS status to prevent race conditions
        const lockedVehicle =
            await Vehicle.findOneAndUpdate(
                {
                    _id: booking.vehicle,
                    status: {
                        $in: [
                            VEHICLE_STATUS.RESERVED,
                            VEHICLE_STATUS.PICKUP_IN_PROGRESS,
                            // Previous rental returned, not yet completed.
                            VEHICLE_STATUS.RENTED,
                            // Status set back by hand (e.g. after
                            // maintenance) while this booking was approved.
                            VEHICLE_STATUS.AVAILABLE,
                            // Its maintenance window is over (checked above).
                            VEHICLE_STATUS.MAINTENANCE,
                        ],
                    },
                    "availability.bookingEnabled": {
                        $ne: false,
                    },
                },
                {
                    $set: {
                        status: VEHICLE_STATUS.PICKUP_IN_PROGRESS,
                    },
                },
                {
                    new: true,
                    session,
                }
            );

        if (
            !lockedVehicle ||
            lockedVehicle.status !==
                VEHICLE_STATUS.PICKUP_IN_PROGRESS
        ) {
            throw createError(
                "Vehicle is no longer available for pickup.",
                409
            );
        }

        ensureVehicleEligibleForPickup(
            lockedVehicle
        );

        if (isEarlyRelease) {
            await ensureEarlyReleaseIsClear(
                booking,
                lockedVehicle,
                new Date()
            );
        }

        /*
         * GCash must already be verified by approval time. Cash on Pickup is
         * allowed to approve unverified ("pay at the counter") — this is the
         * actual gate that keeps the vehicle from being released before the
         * reservation fee is settled.
         */
        await ensurePickupPaymentVerified(
            booking
        );

        const rentalCode =
            await generateRentalCode(session);

        const pickupDate =
            new Date();

        // The booked schedule, recorded before the booking moves onto the
        // actual rental period below.
        const bookedStartDate = booking.startDate;

        const originalEndDate =
            booking.extensions.find(
                (extension) =>
                    extension.status ===
                    BOOKING_EXTENSION_STATUS.APPROVED
            )?.previousEndDate ||
            booking.endDate;

        const actualPeriod =
            await resolveActualRentalPeriod(
                booking,
                lockedVehicle,
                pickupDate,
                session
            );

        await ensureDriverEligibleForPickup(booking.driver, actualPeriod.end);

        // Approval may precede a profile change or a late handover. Check the
        // customer's license against the actual return time before release.
        await ensureCustomerLicenseForDateChange(booking, actualPeriod.end, null, session);

        applyActualRentalPeriod(
            booking,
            actualPeriod
        );

        const approvedExtensions = booking.extensions.filter(
            (extension) =>
                extension.status ===
                BOOKING_EXTENSION_STATUS.APPROVED
        );

        const rentalExtensions =
    approvedExtensions.map(
        (extension) => {
            const extensionData =
                extension.toObject
                    ? extension.toObject()
                    : extension;

            const {
                _id: bookingExtensionId,
                ...extensionPayload
            } = extensionData;

            return {
                bookingExtensionId,
                ...extensionPayload,
            };
        }
    );

        const baseRentalCharge =
            booking.pricing?.subtotal ?? 0;

        const reservationFee =
            booking.pricing?.reservationFee ??
            0;

        const pickupDistanceFee =
            booking.pricing?.pickupDistanceFee ??
            0;

        const returnDistanceFee =
            booking.pricing?.returnDistanceFee ??
            0;

        const driverFee =
            booking.pricing?.driverFee ?? 0;

        /*
         * The financial fields above are the gross booking prices, so the
         * booking's voucher has to come off as a discount — otherwise the
         * rental bills (and a pay-in-full customer owes) the full price.
         */
        const voucherDiscount = Math.max(
            0,
            Number(booking.voucher?.discountAmount || 0)
        );

        const rental =
            await Rental.create(
                [
                    {
                        rentalCode,

                        booking:
                            booking._id,

                        customer:
                            booking.customer,

                        vehicle:
                            booking.vehicle,

                        driver:
                            booking.driver ?? null,

                        bookingPeriod: {
                            originalStartDate:
                                bookedStartDate,

                            originalEndDate:
                                originalEndDate,

                            actualStartDate:
                                actualPeriod.start,

                            returnCapped:
                                actualPeriod.capped,
                        },

                        status:
                            RENTAL_STATUS.ONGOING,

                        pickup: {
                            date: pickupDate,

                            processedBy:
                                currentUserId,
                        },

                        financial: {
                            baseRentalCharge,

                            reservationFee,

                            pickupDistanceFee,

                            returnDistanceFee,

                            driverFee,
                        },

                        securityDeposit: {
                            required:
                                lockedVehicle.securityDeposit?.enabled === true,

                            amount:
                                Number(
                                    lockedVehicle.securityDeposit?.amount ?? 0
                                ),

                            status:
                                lockedVehicle.securityDeposit?.enabled === true
                                    ? RENTAL_SECURITY_DEPOSIT_STATUS.PENDING
                                        : RENTAL_SECURITY_DEPOSIT_STATUS.NOT_REQUIRED,

                                            amountHeld: 0,

                                            amountDeducted: 0,

                                            amountReleased: 0,

                                            deductionReason: "",

                                            processedBy: null,

                                            processedAt: null,
                                    },

                        extensions: rentalExtensions,

                        adjustments:
                            voucherDiscount > 0
                                ? [
                                      {
                                          type: RENTAL_ADJUSTMENT_TYPE.DISCOUNT,
                                          amount: voucherDiscount,
                                          reason: booking.voucher?.code
                                              ? `Voucher ${booking.voucher.code} applied to the booking.`
                                              : "Voucher applied to the booking.",
                                          processedBy: currentUserId,
                                      },
                                  ]
                                : [],

                        actualEndDate:
                            booking.endDate,

                        charges: [
                            ...approvedExtensions.map(
                                (extension) => ({
                                    type:
                                        RENTAL_CHARGE_TYPE.EXTENSION,
                                    amount:
                                        extension.pricing.amount,
                                    description:
                                        "Approved booking extension.",
                                    referenceId:
                                        extension._id,
                                    addedBy:
                                        currentUserId,
                                    addedAt:
                                        new Date(),
                                })
                            ),
                        ],

                        audit: {
                            createdBy:
                                currentUserId,

                            updatedBy:
                                currentUserId,
                        },
                    },
                ],
                { session }
            );

        const rentalDoc = rental[0];

        await calculateFinancials(rentalDoc);

        // Update vehicle status to RENTED
        await Vehicle.findByIdAndUpdate(
            booking.vehicle,
            {
                $set: {
                    status: VEHICLE_STATUS.RENTED,
                },
            },
            { session }
        );

        // Update booking status without using syncBookingRental
        booking.status =
            BOOKING_STATUS.ONGOING;

        // Picked up: a reschedule request still awaiting review is moot.
        (booking.reschedules || []).forEach((reschedule) => {
            if (
                reschedule.status ===
                BOOKING_RESCHEDULE_STATUS.PENDING
            ) {
                reschedule.status =
                    BOOKING_RESCHEDULE_STATUS.CANCELLED;
                reschedule.cancelledAt = new Date();
                reschedule.cancelledBy = currentUserId;
                reschedule.cancellationReason =
                    "The vehicle was picked up.";
            }
        });

        booking.audit.updatedBy =
            currentUserId;

        booking.statusHistory.push({
            status: BOOKING_STATUS.ONGOING,
            changedBy: currentUserId,
            reason: "Rental pickup initiated",
            notes: `Picked up ${formatManilaDateTime(actualPeriod.start)}; due back ${formatManilaDateTime(actualPeriod.end)}${
                actualPeriod.capped
                    ? " (shortened so it ends before the next booking)"
                    : ""
            }.${
                isEarlyRelease
                    ? ` Released early by an admin (booked pickup was ${formatManilaDateTime(bookedPickupAt)}).`
                    : ""
            }`,
        });

        await booking.save({ session });

        appendOperationalEvent(
            rentalDoc,
            {
                type:
                    RENTAL_OPERATIONAL_EVENT.PICKUP,

                performedBy:
                    currentUserId,

                description: isEarlyRelease
                    ? `Rental pickup processed early (booked pickup was ${formatManilaDateTime(bookedPickupAt)}).`
                    : "Rental pickup processed.",
            }
        );

        await rentalDoc.save({ session });

        if (rentalDoc.driver) {
            await Driver.findByIdAndUpdate(
                rentalDoc.driver,
                {
                    $set: {
                        availability:
                            DRIVER_AVAILABILITY.UNAVAILABLE,
                    },
                },
                { session }
            );
        }

        return { rentalDoc, actualPeriod, isEarlyRelease, bookedPickupAt };
        }
    );

    // Picked up with the assigned driver: nothing left to change.
    await closePendingDriverChangeRequests(
        { _id: rentalDoc.booking },
        currentUserId,
        "The vehicle was picked up with the assigned driver."
    );

    // Notifications run only after commit, never during a transaction retry.
    try {
        await notifyRentalVehicleOperator(rentalDoc, {
            type: "Rental Started",
            title: "Your Vehicle Is Now on Rental",
            message: `Rental ${rentalDoc.rentalCode} has started. Your vehicle is out with the customer until ${formatManilaDateTime(actualPeriod.end)}.`,
            variant: "info",
        });

        await notifyRentalCustomer(rentalDoc, {
            type: "Rental Confirmed",
            title: "Rental Confirmed",
            message: `Your rental ${rentalDoc.rentalCode} is confirmed. Your rental period started at pickup (${formatManilaDateTime(actualPeriod.start)}), so return is due by ${formatManilaDateTime(actualPeriod.end)}.${
                actualPeriod.capped
                    ? " This is shorter than your full booked duration because the vehicle or driver is needed right after your rental."
                    : ""
            }`,
            variant: "success",
        });
    } catch (notificationError) {
        console.error(
            "Failed to send rental creation notifications:",
            notificationError
        );
    }

    return rentalDoc;

};

export const processPickup = async (
    rentalId,
    data,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Only ongoing rentals can have pickup information updated.",
            400
        );
    }

    if (!rental.pickup?.date) {
        throw createError(
            "Rental pickup has not been initialized.",
            400
        );
    }

    const existingPickup =
        rental.pickup;

    const pickupDate =
        data.date
            ? new Date(data.date)
            : existingPickup.date;

    if (
        Number.isNaN(
            pickupDate.getTime()
        )
    ) {
        throw createError(
            "Pickup date must be a valid date.",
            400
        );
    }

    rental.pickup =
        buildInspection({
            ...data,

            date: pickupDate,

            processedBy:
                currentUserId,
        });

    rental.audit.updatedBy =
        currentUserId;

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.PICKUP,

            performedBy:
                currentUserId,

            description:
                "Rental pickup inspection updated.",
        }
    );

    await rental.save();

    return rental;
};

export const getRentals = async ({
    currentUserId,
    role,
    includeCompleted = true,
} = {}) => {
    const filter = {};

    if (role === "customer") {
        filter.customer =
            currentUserId;
    }

    if (role === "operator") {
        const vehicleIds =
            await getOperatorVehicleIds(
                currentUserId
            );

        filter.vehicle = {
            $in: vehicleIds,
        };
    }

    if (!includeCompleted) {
        filter.status =
            RENTAL_STATUS.ONGOING;
    }

    /*
     * A partner can see that a customer booked their vehicle, not the
     * customer's contact details — email/phone stay admin- and
     * customer-only (a customer viewing their own rental already knows
     * their own contact info).
     */
    const customerFields =
        role === "operator"
            ? "firstName lastName"
            : "firstName lastName email";

    return Rental.find(filter)
        .populate(
            "vehicle",
            "vehicleCode brand model plateNumber"
        )
        .populate(
            "driver",
            "driverCode firstName lastName"
        )
        .populate(
            "customer",
            customerFields
        )
        .populate(
            "booking",
            "bookingCode pickupLocation returnLocation"
        )
        .populate(
            "penaltyHistory.performedBy",
            role === "operator"
                ? "firstName lastName"
                : "firstName lastName email"
        )
        .sort({
            createdAt: -1,
        })
        .lean();
};

export const getRental = async (
    rentalId,
    {
        currentUserId = null,
        role = null,
    } = {}
) => {
    const rental =
        await Rental.findById(
            rentalId
        )
            .populate("booking")
            .populate(
                "customer",
                "firstName lastName email phoneNumber"
            )
            .populate("vehicle")
            .populate(
                "driver",
                "driverCode firstName lastName"
            )
            .populate(
                "penaltyHistory.performedBy",
                "firstName lastName email"
            )
            .lean();

    if (!rental) {
        throw createError(
            "Rental not found.",
            404
        );
    }

    if (
        role === "customer" &&
        String(rental.customer?._id || rental.customer) !==
            String(currentUserId)
    ) {
        throw createError(
            "You are not authorized to view this rental.",
            403
        );
    }

    if (role === "operator") {
        const vehicle = await Vehicle.findById(
            rental.vehicle?._id || rental.vehicle
        )
            .select("operator")
            .lean();

        if (
            !vehicle ||
            String(vehicle.operator) !==
                String(currentUserId)
        ) {
            throw createError(
                "You are not authorized to view this rental.",
                403
            );
        }

        /*
         * A partner can see who booked their vehicle, not the customer's
         * contact details or which admin acted on a penalty.
         */
        if (rental.customer) {
            delete rental.customer.email;
            delete rental.customer.phoneNumber;
        }

        (rental.penaltyHistory || []).forEach((entry) => {
            if (entry.performedBy) {
                delete entry.performedBy.email;
            }
        });
    }

    return rental;
};

/*
 * Swaps the driver of an ongoing rental. The new driver must be free for the
 * rest of the trip (no other rental, no booking inside it, a license that
 * lasts until it's due back). The booking follows the rental, so conflict
 * checks see the new driver's remaining hours and the original driver's
 * freed ones; availability flags move with the wheel, and the customer is
 * told who's driving now.
 */
export const reassignDriver = async (
    rentalId,
    newDriverId,
    reason,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Driver reassignment is only allowed for ongoing rentals.",
            400
        );
    }

    if (rental.return?.date) {
        throw createError(
            "This rental has already been returned, so its driver can't be changed.",
            400
        );
    }

    if (
        String(rental.driver) ===
        String(newDriverId)
    ) {
        throw createError(
            "The selected driver is already assigned to this rental.",
            400
        );
    }

    const newDriver =
        await getDriverByIdOrThrow(
            newDriverId
        );

    if (
        newDriver.status !==
            DRIVER_STATUS.ACTIVE ||
        newDriver.archive?.isArchived
    ) {
        throw createError(
            "Replacement driver is not active.",
            400
        );
    }

    if (
        newDriver.availability !==
        DRIVER_AVAILABILITY.AVAILABLE
    ) {
        throw createError(
            "Replacement driver is not available.",
            400
        );
    }

    const dueBackAt =
        getExpectedReturnAt(rental) ?? new Date();

    const licenseIssue = getDriverLicenseIssue(
        newDriver,
        dueBackAt
    );

    if (licenseIssue) {
        throw createError(
            licenseIssue === "expired"
                ? "Replacement driver's license has expired."
                : "Replacement driver's license expires before this rental is due back.",
            400
        );
    }

    const conflictingRental =
        await Rental.findOne({
            _id: {
                $ne: rental._id,
            },

            driver:
                newDriverId,

            status:
                RENTAL_STATUS.ONGOING,
        })
            .select(
                "_id rentalCode"
            )
            .lean();

    if (conflictingRental) {
        throw createError(
            "Replacement driver is already assigned to an ongoing rental.",
            409
        );
    }

    // Their own bookings inside the rest of this trip (plus the buffer).
    const conflictingBooking =
        await hasDriverBookingConflict(
            newDriverId,
            new Date(),
            dueBackAt,
            rental.booking
        );

    if (conflictingBooking) {
        throw createError(
            `Replacement driver has booking ${conflictingBooking.bookingCode} before this rental is due back.`,
            409
        );
    }

    const previousDriverId = rental.driver ?? null;
    const now = new Date();

    /*
     * Conditional update: Rental has no versionKey, so save() could undo a
     * return or another reassignment that landed after the read.
     */
    const updated = await Rental.findOneAndUpdate(
        {
            _id: rental._id,
            status: RENTAL_STATUS.ONGOING,
            "return.date": null,
            driver: previousDriverId,
        },
        {
            $set: {
                driver: newDriverId,
                "audit.updatedBy": currentUserId,
            },
            $push: {
                driverReassignments: {
                    previousDriver: previousDriverId,
                    newDriver: newDriverId,
                    reason: reason?.trim() ?? "",
                    reassignedBy: currentUserId,
                    reassignedAt: now,
                },
                operationalEvents: {
                    type: RENTAL_OPERATIONAL_EVENT.DRIVER_REASSIGNED,
                    date: now,
                    performedBy: currentUserId,
                    description: "Rental driver reassigned.",
                    referenceId: newDriverId,
                },
            },
        },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "This rental was already updated by another request. Refresh and try again.",
            409
        );
    }

    await Booking.updateOne(
        { _id: rental.booking },
        { $set: { driver: newDriverId } }
    );

    // Same as at pickup: the driver behind the wheel is out.
    await Driver.updateOne(
        { _id: newDriverId },
        {
            $set: {
                availability: DRIVER_AVAILABILITY.UNAVAILABLE,
            },
        }
    );

    await releaseDriverIfIdle(previousDriverId);

    if (updated.customer) {
        const driverName = [newDriver.firstName, newDriver.lastName]
            .filter(Boolean)
            .join(" ");

        try {
            await notifyUser(updated.customer, {
                type: "rental",
                title: "Your Driver Has Changed",
                message: `Your trip now has a new driver: ${driverName}. Contact number: ${newDriver.phoneNumber || "Not provided"}.`,
                variant: "info",
                category: "Rental",
                metadata: {
                    relatedId: updated._id,
                    relatedModel: "Rental",
                    driverId: newDriver._id,
                    driverName,
                },
            });
        } catch (notifyError) {
            console.error(
                "Failed to notify customer of driver reassignment:",
                notifyError
            );
        }
    }

    return updated;
};

export const processReturn = async (
    rentalId,
    data,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Only ongoing rentals can be returned.",
            400
        );
    }

    if (rental.return?.date) {
        throw createError(
            "Return has already been processed.",
            400
        );
    }

    const returnDate = data.date
        ? new Date(data.date)
        : new Date();

    if (
        Number.isNaN(
            returnDate.getTime()
        )
    ) {
        throw createError(
            "Return date must be a valid date.",
            400
        );
    }

    if (
        rental.pickup?.date &&
        returnDate <
            rental.pickup.date
    ) {
        throw createError(
            "Return date cannot be before pickup date.",
            400
        );
    }

    // When it was due back, kept on the booking once it's returned.
    const dueBackAt = getExpectedReturnAt(rental);

    rental.return =
        buildInspection({
            ...data,

            date: returnDate,

            processedBy:
                currentUserId,
        });

    rental.vehicleOutcome =
        data.vehicleOutcome;

    const settings =
        await Settings.findOne()
            .select("penaltySettings earlyReturnSettings")
            .lean();

    const autoApply =
        settings?.penaltySettings
            ?.autoApply ?? true;

    if (autoApply) {
        await calculateLateReturn(
            rental,
            returnDate,
            currentUserId,
            true
        );
    }

    /*
     * Early and late are mutually exclusive by construction (a rental can't
     * be both ahead of and behind its expected return time), so this can
     * always run alongside the late-return calculation above with no
     * conflict. Unlike late fees, this never touches charges/financials —
     * it only flags a credit for admin review; nothing is issued yet.
     */
    // Each rule the more generous of the booking's locked terms and today's.
    const earlyReturnSettings = getBookingEarlyReturnSettings(
        await loadBookingTerms(rental),
        settings?.earlyReturnSettings
    );

    if (earlyReturnSettings.enabled) {
        await calculateEarlyReturn(
            rental,
            returnDate,
            currentUserId,
            earlyReturnSettings
        );
    }

    for (const damageIssue of data.damageIssues || []) {
        const chargeAmount = Number(
            damageIssue.chargeAmount ?? 0
        );

        rental.damageIssues.push({
            description: damageIssue.description.trim(),
            condition: damageIssue.condition ?? null,
            photos: Array.isArray(damageIssue.photos)
                ? damageIssue.photos
                : [],
            chargeReference:
                damageIssue.chargeReference ?? null,
            chargeAmount,
            notes: damageIssue.notes?.trim() ?? "",
        });

        if (chargeAmount > 0) {
            rental.charges.push({
                type: RENTAL_CHARGE_TYPE.DAMAGE,
                amount: chargeAmount,
                description: damageIssue.description.trim(),
                referenceId:
                    damageIssue.chargeReference ?? null,
                addedBy: currentUserId,
                addedAt: new Date(),
            });
        }
    }

    if (
        rental.pickup?.odometer !== null &&
        rental.pickup?.odometer !== undefined &&
        Number(data.odometer) <
            Number(rental.pickup.odometer)
    ) {
        throw createError(
            "Return odometer cannot be lower than the pickup odometer.",
            400
        );
    }

    await calculateFinancials(rental);

    rental.audit.updatedBy =
        currentUserId;

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.RETURN,

            performedBy:
                currentUserId,

            description:
                "Rental return processed.",
        }
    );

    await rental.save();

    const { shortTurnaround } = await syncBookingEndToReturn(
        rental,
        returnDate,
        dueBackAt
    );

    // An extension still awaiting review is moot once the vehicle is back.
    await Booking.updateOne(
        { _id: rental.booking },
        {
            $set: {
                "extensions.$[pending].status":
                    BOOKING_EXTENSION_STATUS.CANCELLED,
                "extensions.$[pending].cancelledAt": new Date(),
                "extensions.$[pending].cancelledBy": currentUserId,
                "extensions.$[pending].cancellationReason":
                    "The vehicle was returned.",
            },
        },
        {
            arrayFilters: [
                {
                    "pending.status":
                        BOOKING_EXTENSION_STATUS.PENDING,
                },
            ],
        }
    );

    // The vehicle is back: bookings this late return put at risk can go
    // ahead (or are told when it's ready). Best-effort.
    try {
        await reconcileLateReturnConflicts(rental.vehicle);
    } catch (conflictError) {
        console.error(
            `Failed to reconcile late-return conflicts for vehicle ${rental.vehicle}:`,
            conflictError
        );
    }

    const newDamageCount = (data.damageIssues || []).length;
    const wasLate =
        (rental.lateReturn?.lateDurationMinutes ?? 0) > 0;

    const returnTiming = describeReturnTiming(
        dueBackAt,
        returnDate
    );

    await notifyRentalVehicleOperator(rental, {
        type: "Rental Returned",
        title: "Your Vehicle Has Been Returned",
        message: `Rental ${rental.rentalCode} was returned. ${returnTiming}${
            wasLate ? " The return was late." : ""
        }${
            newDamageCount > 0
                ? ` ${newDamageCount} damage issue(s) were logged during inspection.`
                : " No new damage was reported."
        }`,
        variant: newDamageCount > 0 || wasLate ? "warning" : "info",
    });

    await notifyRentalCustomer(rental, {
        type: "Rental Returned",
        title: "Vehicle Return Recorded",
        message: `We've recorded the return for rental ${rental.rentalCode}. ${returnTiming}${
            newDamageCount > 0
                ? ` ${newDamageCount} damage issue(s) were noted during inspection.`
                : ""
        } Final charges of ${formatAmount(
            rental.financial?.finalAmount ?? rental.financial?.totalAmount ?? 0
        )} will be settled shortly.`,
        variant: newDamageCount > 0 || wasLate ? "warning" : "info",
        email: statementEmail(rental),
    });

    if (
        (rental.lateReturn?.lateDurationMinutes ?? 0) > 0 &&
        (rental.lateReturn?.amount ?? 0) > 0
    ) {
        await notifyPenaltyAction(rental, {
            type: "Late Return Penalty Applied",
            title: "Late Return Penalty Applied",
            message: `A late return penalty of ${formatAmount(
                rental.lateReturn.amount
            )} has been added to rental ${rental.rentalCode} for returning ${
                rental.lateReturn.chargedUnits
            } ${(rental.lateReturn.chargingUnit || "hour").toLowerCase()}(s) late.`,
        });

        try {
            await notifyAdmins({
                type: "Late Return Detected",
                title: "Late Return Detected",
                message: `Rental ${rental.rentalCode} was returned ${
                    rental.lateReturn.chargedUnits
                } ${(rental.lateReturn.chargingUnit || "hour").toLowerCase()}(s) late. A penalty of ${formatAmount(
                    rental.lateReturn.amount
                )} was applied.`,
                variant: "warning",
                category: "Rental",
                metadata: {
                    reference: rental.rentalCode,
                    relatedId: rental._id,
                    relatedModel: "Rental",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of late return:",
                notificationError
            );
        }
    }

    if (rental.earlyReturn?.detected) {
        try {
            await notifyAdmins({
                type: "Early Return Detected",
                title: "Early Return Detected",
                message: `Rental ${rental.rentalCode} was returned ${
                    rental.earlyReturn.unusedFullDays
                } day(s) early. Inspect the vehicle and review the early-return credit (≈${formatAmount(
                    rental.earlyReturn.creditAmount
                )}).`,
                variant: "info",
                category: "Rental",
                metadata: {
                    reference: rental.rentalCode,
                    relatedId: rental._id,
                    relatedModel: "Rental",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of early return:",
                notificationError
            );
        }
    }

    if (shortTurnaround) {
        try {
            await notifyAdmins({
                type: "Short Turnaround",
                title: "Short Turnaround Before Next Booking",
                message: `Rental ${rental.rentalCode} came back ${formatManilaDateTime(
                    returnDate
                )}, but ${
                    shortTurnaround.bookingCode
                        ? `booking ${shortTurnaround.bookingCode}`
                        : "the next booking"
                } picks this ${
                    shortTurnaround.sameDriverOnly ? "driver" : "vehicle"
                } up ${formatManilaDateTime(
                    shortTurnaround.startDate
                )} — less than the usual ${formatHours(
                    shortTurnaround.bufferMs
                )} turnaround. Prepare it quickly, or contact that customer.`,
                variant: "warning",
                category: "Rental",
                metadata: {
                    reference: rental.rentalCode,
                    relatedId: rental._id,
                    relatedModel: "Rental",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of a short turnaround:",
                notificationError
            );
        }
    }

    return rental;
};

/* 90 → "1 hr 30 min", 1500 → "1 day 1 hr". */
const formatDurationMinutes = (totalMinutes) => {
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    return [
        days && `${days} day${days === 1 ? "" : "s"}`,
        hours && `${hours} hr`,
        // Minutes stop mattering once it's days.
        !days && minutes && `${minutes} min`,
    ]
        .filter(Boolean)
        .join(" ");
};

const formatHours = (ms) => {
    const hours = ms / (60 * 60 * 1000);

    return `${hours} hour${hours === 1 ? "" : "s"}`;
};

/*
 * "Due back: <time>. Returned: <time> (1 hr 30 min late)." for the return
 * notifications, so the record and the actual hand-back are both stated.
 */
const describeReturnTiming = (dueBackAt, returnedAt) => {
    const returned = `Returned: ${formatManilaDateTime(returnedAt)}`;

    if (!dueBackAt) {
        return `${returned}.`;
    }

    const diffMinutes = Math.round(
        (returnedAt.getTime() - dueBackAt.getTime()) / (60 * 1000)
    );

    const timing =
        diffMinutes === 0
            ? "on time"
            : `${formatDurationMinutes(Math.abs(diffMinutes))} ${
                  diffMinutes > 0 ? "late" : "early"
              }`;

    return `Due back: ${formatManilaDateTime(
        dueBackAt
    )}. ${returned} (${timing}).`;
};

/*
 * After a return, the booking's end — what every availability check measures
 * the turnaround buffer from — becomes the actual return time, and the
 * due-back time is kept in dueBackDate:
 *
 * - Early: the rest of the booked time is freed for other bookings.
 * - Late: the buffer counts from when the vehicle really came back. Capped
 *   one buffer before the vehicle's or driver's next commitment, so a booking
 *   already made for that time isn't put in conflict (its approval re-checks
 *   this) — that clash is reported as a short turnaround instead.
 */
const syncBookingEndToReturn = async (rental, returnDate, dueBackAt) => {
    const booking = await Booking.findById(rental.booking).select(
        "endDate vehicle driver"
    );

    if (!booking) {
        return { shortTurnaround: null };
    }

    const bookedEnd = new Date(booking.endDate);
    const bufferMs = await getTurnaroundBufferMs();

    // Anything starting within a buffer after the return was squeezed.
    const searchEnd = new Date(returnDate.getTime() + bufferMs);

    const vehicle = await Vehicle.findById(booking.vehicle)
        .select("availability.blockedDates")
        .lean();

    const nextCommitmentStart =
        returnDate > bookedEnd
            ? await findNextCommitmentStart(
                  booking,
                  vehicle ?? {},
                  bookedEnd,
                  searchEnd,
                  null
              )
            : null;

    let newEnd = returnDate;

    if (nextCommitmentStart) {
        const cappedEnd = new Date(
            nextCommitmentStart.getTime() - bufferMs
        );

        newEnd = new Date(
            Math.max(
                bookedEnd.getTime(),
                Math.min(returnDate.getTime(), cappedEnd.getTime())
            )
        );
    }

    await Booking.updateOne(
        { _id: booking._id },
        {
            $set: {
                endDate: newEnd,
                ...(dueBackAt ? { dueBackDate: dueBackAt } : {}),
            },
        }
    );

    if (!nextCommitmentStart) {
        return { shortTurnaround: null };
    }

    // The booking behind it, for the admin alert (may be a blocked period).
    const nextVehicleBooking = await Booking.findOne({
        _id: { $ne: booking._id },
        vehicle: booking.vehicle,
        status: { $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES },
        startDate: nextCommitmentStart,
    })
        .select("bookingCode startDate")
        .lean();

    const nextDriverBooking =
        !nextVehicleBooking && booking.driver
            ? await Booking.findOne({
                  _id: { $ne: booking._id },
                  driver: booking.driver,
                  status: { $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES },
                  startDate: nextCommitmentStart,
              })
                  .select("bookingCode startDate")
                  .lean()
            : null;

    const nextBooking = nextVehicleBooking ?? nextDriverBooking;

    // An admin-blocked period: nobody to hand the vehicle to.
    if (!nextBooking) {
        return { shortTurnaround: null };
    }

    return {
        shortTurnaround: {
            bookingCode: nextBooking.bookingCode,
            startDate: nextBooking.startDate,
            sameDriverOnly: Boolean(nextDriverBooking),
            bufferMs,
        },
    };
};

/*
 * The booking a rental came from, with what its locked terms need
 * (lockedTermsService): the terms snapshot and the booked daily rate.
 */
const loadBookingTerms = async (rental) => {
    const bookingId = rental.booking?._id ?? rental.booking;

    if (!bookingId) {
        return null;
    }

    return Booking.findById(bookingId)
        .select("termsAcceptance pricing.dailyRate pricing.originalDailyRate")
        .lean();
};

/*
 * The vehicle's daily rate for late charges. Prefer the vehicle's own
 * configured price; only when that is unavailable, fall back to deriving it
 * from the base rental charge. The base charge and the effective end date
 * (actualEndDate) are kept in sync through extensions, so dividing one by
 * the other yields the right daily rate whether or not the rental was
 * extended.
 */
const resolveLateDailyRate = async (rental) => {
    const vehicle = await getVehicleByIdOrThrow(
        rental.vehicle
    );

    const chargedRentalDays = Math.max(
        1,
        Math.ceil(
            (
                new Date(
                    rental.actualEndDate ||
                    rental.bookingPeriod
                        .originalEndDate
                ).getTime() -
                new Date(
                    getRentalPeriodStart(rental)
                ).getTime()
            ) /
                (24 * 60 * 60 * 1000)
        )
    );

    const vehicleDailyRate = Number(
        vehicle?.pricing?.dailyRate
    );

    const derivedDailyRate =
        Number(
            rental.financial
                ?.baseRentalCharge
        ) / chargedRentalDays;

    if (
        Number.isFinite(vehicleDailyRate) &&
        vehicleDailyRate > 0
    ) {
        return vehicleDailyRate;
    }

    if (
        Number.isFinite(derivedDailyRate) &&
        derivedDailyRate > 0
    ) {
        return derivedDailyRate;
    }

    return 0;
};

const calculateLateReturn = async (
    rental,
    actualReturnAt,
    currentUserId,
    recordHistory = false
) => {
    /*
     * Measured against the rental's due-back time (see getExpectedReturnAt:
     * the actual-pickup-based end, or any later approved extension end).
     * Folding approved extensions in directly keeps the penalty correct
     * even if actualEndDate was not synced when the extension was approved
     * (older records).
     */
    const expectedReturnAt =
        getExpectedReturnAt(rental) ?? actualReturnAt;

    const settings =
        await Settings.findOne()
            .select("penaltySettings")
            .lean();

    const penaltySettings =
        settings?.penaltySettings ?? {};

    const booking = await loadBookingTerms(rental);

    // The rate only matters once it's back after its due-back time.
    const dailyRate =
        actualReturnAt.getTime() > expectedReturnAt.getTime()
            ? await resolveLateDailyRate(rental)
            : 0;

    /*
     * Today's penalty rules, or the booking's locked ones (at the lower of
     * its booked and today's daily rate) when those charge less.
     */
    const penalty = computeBookingLatePenalty(
        booking,
        penaltySettings,
        {
            expectedReturnAt,
            actualReturnAt,
            dailyRate,
        }
    );

    const {
        gracePeriodMinutes,
        lateDurationMinutes,
        chargingUnit,
        chargedUnits,
        rate,
        rateType,
        amount: cappedLateAmount,
    } = penalty;

    rental.lateReturn = {
        expectedReturnAt,

        actualReturnAt,

        gracePeriodMinutes,

        lateDurationMinutes,

        chargingUnit,

        chargedUnits,

        rate,

        rateType,

        amount: cappedLateAmount,

        policySource: penalty.policySource,

        termsVersion: penalty.termsVersion,

        confirmedBy:
            currentUserId,

        confirmedAt:
            new Date(),
    };

    if (lateDurationMinutes <= 0) {
        return;
    }

    rental.charges.push({
        type:
            RENTAL_CHARGE_TYPE.LATE,

        amount:
            cappedLateAmount,

        description:
            `Late return charge for ${chargedUnits} ${chargingUnit.toLowerCase()}(s).`,

        addedBy:
            currentUserId,

        addedAt:
            new Date(),
    });

    if (recordHistory) {
        rental.penaltyHistory.push({
            action: "applied",
            previousAmount: 0,
            newAmount: cappedLateAmount,
            reason: "Automatically applied on rental return.",
            performedBy: currentUserId,
            performedAt: new Date(),
            gracePeriodMinutes,
            chargingUnit,
            chargedUnits,
            rate,
            rateType,
        });
    }

    await calculateFinancials(rental);
};

/*
 * Detects whether a return is early and, if so, how many full unused
 * 24-hour periods remain. Never issues anything — it only flags a Pending
 * `earlyReturn` for an admin to inspect the vehicle and approve/reject (see
 * approveEarlyReturnCredit/rejectEarlyReturnCredit). Mirrors
 * calculateLateReturn's structure and daily-rate resolution.
 */
const calculateEarlyReturn = async (
    rental,
    actualReturnAt,
    currentUserId,
    earlyReturnSettings
) => {
    const expectedReturnAt =
        getExpectedReturnAt(rental);

    const minUnusedDaysToQualify =
        earlyReturnSettings
            ?.minUnusedDaysToQualify ?? 1;

    const millisecondsPerDay =
        24 * 60 * 60 * 1000;

    const rawUnusedDays = expectedReturnAt
        ? Math.floor(
              (expectedReturnAt.getTime() -
                  actualReturnAt.getTime()) /
                  millisecondsPerDay
          )
        : 0;

    /*
     * Capped against the full booked window through expectedReturnAt (not
     * just originalEndDate) so an approved extension's added days aren't
     * clipped out of the credit for a rental returned early relative to the
     * extended end date.
     */
    const totalBookedDays = Math.max(
        1,
        Math.ceil(
            ((expectedReturnAt
                ? expectedReturnAt.getTime()
                : new Date(
                      rental.bookingPeriod.originalEndDate
                  ).getTime()) -
                new Date(
                    getRentalPeriodStart(rental)
                ).getTime()) /
                millisecondsPerDay
        )
    );

    const unusedFullDays = Math.min(
        Math.max(0, rawUnusedDays),
        totalBookedDays
    );

    if (unusedFullDays < minUnusedDaysToQualify) {
        rental.earlyReturn = {
            detected: false,

            expectedReturnAt,

            actualReturnAt,

            unusedFullDays: 0,

            dailyRate: 0,

            creditAmount: 0,

            status:
                RENTAL_EARLY_RETURN_STATUS.PENDING,
        };

        return;
    }

    const vehicle = await getVehicleByIdOrThrow(
        rental.vehicle
    );

    const chargedRentalDays = Math.max(
        1,
        Math.ceil(
            (new Date(
                rental.actualEndDate ||
                    rental.bookingPeriod
                        .originalEndDate
            ).getTime() -
                new Date(
                    getRentalPeriodStart(rental)
                ).getTime()) /
                millisecondsPerDay
        )
    );

    const bookingPricing = rental.booking
        ? (
              await Booking.findById(rental.booking)
                  .select(
                      "driverOption pricing.driverDailyRate pricing.dailyRate pricing.vehicleDiscount"
                  )
                  .lean()
          )
        : null;

    /*
     * A booking priced with a vehicle discount (Promotions → Discounts) is
     * credited at the discounted rate it paid, not the vehicle's full rate.
     */
    const vehicleDailyRate = Number(
        bookingPricing?.pricing?.vehicleDiscount
            ? bookingPricing.pricing.dailyRate
            : vehicle?.pricing?.dailyRate
    );

    const derivedDailyRate =
        Number(
            rental.financial
                ?.baseRentalCharge
        ) / chargedRentalDays;

    let dailyRate = 0;

    if (
        Number.isFinite(vehicleDailyRate) &&
        vehicleDailyRate > 0
    ) {
        dailyRate = vehicleDailyRate;
    } else if (
        Number.isFinite(derivedDailyRate) &&
        derivedDailyRate > 0
    ) {
        dailyRate = derivedDailyRate;
    }

    /*
     * A "With Driver" rental returned early didn't use the driver for those
     * days either, so the credit covers the driver's locked daily rate too.
     * Folded into `dailyRate`, which approval multiplies by the approved
     * days.
     */

    if (
        bookingPricing?.driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        dailyRate +=
            Number(bookingPricing.pricing?.driverDailyRate) || 0;
    }

    const creditAmount =
        Math.round(
            unusedFullDays * dailyRate * 100
        ) / 100;

    rental.earlyReturn = {
        detected: true,

        expectedReturnAt,

        actualReturnAt,

        unusedFullDays,

        dailyRate,

        creditAmount,

        status:
            RENTAL_EARLY_RETURN_STATUS.PENDING,

        approvedUnusedDays: 0,

        approvedCreditAmount: 0,

        reviewedBy: null,

        reviewedAt: null,

        rejectionReason: "",

        voucher: null,

        // Which terms set the credit rules (lockedTermsService).
        policySource: earlyReturnSettings?.policySource ?? null,

        termsVersion: earlyReturnSettings?.termsVersion ?? null,
    };

    /*
     * Settings-driven fast path: skip the admin review queue entirely and
     * issue the voucher immediately, attributed to whoever processed this
     * return. The rental isn't saved here - the caller (processReturn)
     * saves once, after this and the late-return/financial calculations
     * above have all been applied to the same in-memory document.
     */
    if (earlyReturnSettings?.autoApprove) {
        await issueEarlyReturnVoucher(
            rental,
            unusedFullDays,
            earlyReturnSettings?.voucherValidityMonths ?? 12,
            currentUserId,
            { auto: true }
        );
    }
};

/*
 * Issues the voucher and stamps the earlyReturn subdocument as Approved -
 * shared by the admin's manual approval (approveEarlyReturnCredit) and
 * calculateEarlyReturn's auto-approve fast path. Operates on the in-memory
 * `rental` only; the caller is responsible for saving it.
 */
const issueEarlyReturnVoucher = async (
    rental,
    approvedDays,
    voucherValidityMonths,
    reviewerId,
    { auto = false } = {}
) => {
    const earlyReturn = rental.earlyReturn;

    const approvedCreditAmount =
        Math.round(
            approvedDays *
                earlyReturn.dailyRate *
                100
        ) / 100;

    const now = new Date();
    const voucherEndDate = new Date(now);
    voucherEndDate.setMonth(
        voucherEndDate.getMonth() +
            voucherValidityMonths
    );

    const voucher = await createVoucher(
        {
            // Customer-facing: by return date, not the internal rental code.
            name: `Early Return Credit – ${new Date(
                earlyReturn.actualReturnAt || now
            ).toLocaleDateString("en-PH", {
                timeZone: BUSINESS_TIMEZONE,
                month: "short",
                day: "numeric",
                year: "numeric",
            })}`,
            description: `Credit for ${approvedDays} unused day(s) on your rental, returned early.${
                earlyReturn.policySource
                    ? ` Under ${describePolicySourceForCustomer(earlyReturn)}.`
                    : ""
            }`,
            type: VOUCHER_TYPE.TOTAL,
            discountMethod:
                VOUCHER_DISCOUNT_METHOD.FIXED,
            discountValue: approvedCreditAmount,
            startDate: now,
            endDate: voucherEndDate,
            maxUsagesPerUser: 1,
            assignmentType:
                VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS,
            assignedTo: [rental.customer],
            source: "early_return",
            relatedRental: rental._id,
        },
        reviewerId
    );

    rental.earlyReturn.status =
        RENTAL_EARLY_RETURN_STATUS.APPROVED;

    rental.earlyReturn.approvedUnusedDays =
        approvedDays;

    rental.earlyReturn.approvedCreditAmount =
        approvedCreditAmount;

    rental.earlyReturn.voucher =
        voucher._id;

    rental.earlyReturn.reviewedBy =
        reviewerId;

    rental.earlyReturn.reviewedAt =
        now;

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.EARLY_RETURN_CREDIT_APPROVED,

            performedBy:
                reviewerId,

            description: `Early-return credit ${
                auto ? "auto-approved" : "approved"
            } for ${approvedDays} day(s) (${formatAmount(
                approvedCreditAmount
            )}).`,

            referenceId:
                voucher._id,
        }
    );
};

export const addDamageIssue = async (
    rentalId,
    data,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Damage issues can only be recorded for ongoing rentals.",
            400
        );
    }

    const description =
        data.description?.trim();

    if (!description) {
        throw createError(
            "Damage issue description is required.",
            400
        );
    }

    const chargeAmount =
        Number(
            data.chargeAmount ?? 0
        );

    if (
        !Number.isFinite(
            chargeAmount
        ) ||
        chargeAmount < 0
    ) {
        throw createError(
            "Damage charge amount must be a valid non-negative number.",
            400
        );
    }

    rental.damageIssues.push({
        description,

        condition:
            data.condition ?? null,

        photos:
            Array.isArray(
                data.photos
            )
                ? data.photos
                : [],

        chargeReference:
            data.chargeReference ??
            null,

        chargeAmount,

        notes:
            data.notes?.trim() ?? "",
    });

    if (chargeAmount > 0) {
        rental.charges.push({
            type:
                RENTAL_CHARGE_TYPE.DAMAGE,

            amount:
                chargeAmount,

            description,

            referenceId:
                data.chargeReference ??
                null,

            addedBy:
                currentUserId,

            addedAt:
                new Date(),
        });
    }

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(rental);

    await rental.save();

    await notifyRentalVehicleOperator(rental, {
        type: "Vehicle Damage Reported",
        title: "Damage Reported on Your Vehicle",
        message: `A damage issue was logged on rental ${rental.rentalCode}: ${description.slice(0, 200)}${
            chargeAmount > 0 ? ` (charge: ${formatAmount(chargeAmount)})` : ""
        }`,
        variant: "warning",
    });

    if (chargeAmount > 0) {
        await notifyRentalCustomer(rental, {
            type: "Rental Charge Added",
            title: "Damage Charge Added",
            message: `A damage charge of ${formatAmount(chargeAmount)} was added to rental ${rental.rentalCode}: ${description.slice(0, 200)}`,
            variant: "warning",
        });
    }

    return rental;
};

export const addCharge = async (
    rentalId,
    data,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Charges can only be added to ongoing rentals.",
            400
        );
    }

    const amount =
        Number(data.amount);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw createError(
            "Charge amount must be greater than zero.",
            400
        );
    }

    rental.charges.push({
        type: data.type,

        amount,

        description:
            data.description?.trim() ??
            "",

        referenceId:
            data.referenceId ??
            null,

        addedBy:
            currentUserId,

        addedAt:
            new Date(),
    });

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(rental);

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.CHARGE_ADDED,

            performedBy:
                currentUserId,

            description:
                "Rental charge added.",
        }
    );

    await rental.save();

    await notifyRentalCustomer(rental, {
        type: "Rental Charge Added",
        title: "Charge Added to Your Rental",
        message: `A ${String(data.type || "").toLowerCase() || "additional"} charge of ${formatAmount(amount)} was added to rental ${rental.rentalCode}.${
            data.description ? ` ${String(data.description).trim().slice(0, 200)}` : ""
        }`,
        variant: "warning",
    });

    return rental;
};

export const addAdjustment = async (
    rentalId,
    data,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Adjustments can only be added to ongoing rentals.",
            400
        );
    }

    const amount =
        Number(data.amount);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw createError(
            "Adjustment amount must be greater than zero.",
            400
        );
    }

    const reason =
        data.reason?.trim();

    if (!reason) {
        throw createError(
            "Adjustment reason is required.",
            400
        );
    }

    rental.adjustments.push({
        type: data.type,

        amount,

        reason,

        processedBy:
            currentUserId,

        processedAt:
            new Date(),
    });

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(rental);

    await rental.save();

    const isDiscount =
        data.type === RENTAL_ADJUSTMENT_TYPE.DISCOUNT;

    await notifyRentalCustomer(rental, {
        type: "Rental Adjustment Applied",
        title: isDiscount
            ? "Discount Applied to Your Rental"
            : "Adjustment Applied to Your Rental",
        message: `${
            isDiscount ? "A discount" : "An adjustment"
        } of ${formatAmount(amount)} was applied to rental ${rental.rentalCode}. Reason: ${reason.slice(0, 200)}`,
        variant: isDiscount ? "success" : "info",
    });

    return rental;
};

export const recordPayment = async (
    rentalId,
    data,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
            RENTAL_STATUS.ONGOING &&
        rental.status !==
            RENTAL_STATUS.COMPLETED
    ) {
        throw createError(
            "Payment cannot be recorded for this rental.",
            400
        );
    }

    const amount =
        Number(data.amount);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw createError(
            "Payment amount must be greater than zero.",
            400
        );
    }

    await calculateFinancials(rental);

    if (
        amount >
        rental.financial.balance
    ) {
        throw createError(
            "Payment cannot exceed the outstanding balance.",
            400
        );
    }

    const paymentDate =
        data.paymentDate
            ? new Date(data.paymentDate)
            : new Date();

    if (
        Number.isNaN(
            paymentDate.getTime()
        )
    ) {
        throw createError(
            "Payment date must be a valid date.",
            400
        );
    }

    rental.payments.push({
        amount,

        type:
            data.type,

        status:
            RENTAL_PAYMENT_STATUS.PENDING,

        paymentDate,

        paymentMethod:
            data.paymentMethod,

        reference:
            data.reference?.trim() ??
            "",

        notes:
            data.notes?.trim() ?? "",

        processedBy:
            currentUserId,
    });

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(rental);

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.PAYMENT_RECORDED,

            performedBy:
                currentUserId,

            description:
                "Rental payment recorded and awaiting verification.",
        }
    );

    await rental.save();

    return rental;
};

export const verifyPayment = async (
    rentalId,
    paymentId,
    status,
    rejectionReason,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
            RENTAL_STATUS.ONGOING &&
        rental.status !==
            RENTAL_STATUS.COMPLETED
    ) {
        throw createError(
            "Payment cannot be verified for this rental.",
            400
        );
    }

    const payment =
        rental.payments.id(
            paymentId
        );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    if (
        payment.status !==
        RENTAL_PAYMENT_STATUS.PENDING
    ) {
        throw createError(
            "Only pending payments can be verified or rejected.",
            400
        );
    }

    if (
        status !==
            RENTAL_PAYMENT_STATUS.VERIFIED &&
        status !==
            RENTAL_PAYMENT_STATUS.REJECTED
    ) {
        throw createError(
            "Invalid payment verification status.",
            400
        );
    }

    if (
        status ===
        RENTAL_PAYMENT_STATUS.REJECTED
    ) {
        const reason =
            rejectionReason?.trim();

        if (!reason) {
            throw createError(
                "Rejection reason is required when rejecting a payment.",
                400
            );
        }

        payment.status =
            RENTAL_PAYMENT_STATUS.REJECTED;

        payment.rejectionReason =
            reason;

        payment.verifiedBy =
            currentUserId;

        payment.verifiedAt =
            new Date();

        rental.audit.updatedBy =
            currentUserId;

        appendOperationalEvent(
            rental,
            {
                type:
                    RENTAL_OPERATIONAL_EVENT.PAYMENT_REJECTED,

                performedBy:
                    currentUserId,

                description:
                    "Rental payment rejected.",

                referenceId:
                    payment._id,
            }
        );

        await calculateFinancials(rental);

        await rental.save();

        return rental;
    }

    await calculateFinancials(rental);

    const outstandingBalance =
        rental.financial.balance;

    if (
        Number(payment.amount) >
        outstandingBalance
    ) {
        throw createError(
            "Payment cannot be verified because it exceeds the outstanding balance.",
            400
        );
    }

    payment.status =
        RENTAL_PAYMENT_STATUS.VERIFIED;

    payment.verifiedBy =
        currentUserId;

    payment.verifiedAt =
        new Date();

    payment.rejectionReason =
        "";

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(rental);

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.PAYMENT_VERIFIED,

            performedBy:
                currentUserId,

            description:
                "Rental payment verified.",

            referenceId:
                payment._id,
        }
    );

    await rental.save();

    const receipt = await findReceiptForSource(rental.booking, {
        model: RECEIPT_SOURCE.RENTAL_PAYMENT,
        id: rental._id,
        subId: payment._id,
    });

    await notifyRentalCustomer(rental, {
        type: "payment",
        title: "Payment Received",
        message: `We received your payment of ${formatAmount(
            payment.amount
        )} for rental ${rental.rentalCode}.${
            rental.financial.balance > 0
                ? ` Remaining balance: ${formatAmount(
                      rental.financial.balance
                  )}.`
                : " Your rental is fully paid."
        }`,
        variant: "payment",
        category: "Payment",
        email: receiptEmail(receipt, {
            subject: "Payment received",
            fallbackPath: `/customer/bookings/${rental.booking}`,
        }),
    });

    return rental;
};

/*
 * `waiveReservationFee`: a cancellation the customer isn't responsible for
 * (an admin cancelling) refunds the reservation fee too.
 */
export const computeRefundableAmount = async (
    rental,
    reason,
    {
        excludeRefundId = null,
        waiveReservationFee = false,
    } = {}
) => {
    /*
     * Everything the customer paid — what an admin recorded on the rental
     * PLUS the online reservation/extension payments (the whole rental total
     * for a pay-in-full booking), the same figure calculateFinancials uses.
     * Counting only `rental.payments` made a customer who paid online have
     * nothing refundable at all: a pay-in-full customer could never request
     * a post-return refund, and the reservation fee was subtracted as
     * "non-refundable" from money it was never part of.
     */
    const recordedPaid =
        rental.payments
            .filter(
                (payment) =>
                    payment.status ===
                    RENTAL_PAYMENT_STATUS.VERIFIED
            )
            .reduce(
                (total, payment) =>
                    total +
                    Number(payment.amount),
                0
            );

    const totalPaid =
        recordedPaid +
        (await getBookingFeesPaid(
            rental.booking,
            rental
        ));

    const totalRefunded =
        rental.refunds
            .filter(
                (refund) =>
                    isRefundInEffect(refund) &&
                    (!excludeRefundId ||
                        String(refund._id) !==
                            String(excludeRefundId))
            )
            .reduce(
                (total, refund) =>
                    total +
                    Number(refund.amount),
                0
            );

    // The fee withheld is what was charged for it — after a reservation-fee
    // voucher, which only the booking records.
    const nonRefundable =
        reason === RENTAL_REFUND_REASON.CANCELLATION &&
        !waiveReservationFee
            ? getUpfrontFees({
                  pricing: {
                      reservationFee:
                          rental.financial.reservationFee,
                  },
                  voucher: (
                      await Booking.findById(rental.booking)
                          .select("voucher")
                          .lean()
                  )?.voucher,
              }).reservationFee
            : 0;

    return Math.max(
        0,
        totalPaid -
            nonRefundable -
            totalRefunded
    );
};

/*
 * A refund only reaches the operator when it was for a vehicle-performance
 * issue — the vehicle they supplied fell short. Every other reason (an
 * overpayment corrected, an adjustment, a cancellation) is the platform's to
 * absorb and leaves the payout untouched.
 *
 * For a vehicle-performance refund: a payout still SCHEDULED is reduced
 * automatically (the operator is told); one already credited can't be
 * changed, and a payout in a state that can't be adjusted automatically is
 * left to an admin — both raise a notice to the admins. A payout that doesn't
 * exist yet is scheduled net of the refund when the rental completes.
 * Best-effort: never blocks the refund.
 */
const applyRefundToOperatorPayout = async (
    rental,
    refund
) => {
    if (
        refund.reason !==
        RENTAL_REFUND_REASON.VEHICLE_PERFORMANCE_ISSUE
    ) {
        return;
    }

    try {
        const result =
            await reducePayoutForFaultRefund(
                rental.booking,
                { recoverMissing: !isRefundInEffect(refund) }
            );

        if (
            result.outcome !== "released" &&
            result.outcome !== "needs_review"
        ) {
            return;
        }

        const released =
            result.outcome === "released";

        await notifyAdmins({
            type: "Refund Affects Operator Payout",
            title: "Refund Affects an Operator Payout",
            message: !isRefundInEffect(refund)
                ? `A refund of ${formatAmount(Number(refund.amount))} for rental ${rental.rentalCode} was not completed, but operator payout ${result.payout?.payoutCode || ""} cannot be adjusted automatically. Review the payout and restore the operator's share if it was previously deducted.`
                : `A refund of ${formatAmount(
                Number(refund.amount)
            )} for a vehicle performance issue was approved for rental ${rental.rentalCode}, but operator payout ${
                result.payout?.payoutCode || ""
            } for this booking ${
                released
                    ? "has already been credited to the operator's wallet"
                    : "can't be adjusted automatically"
            }. ${
                released
                    ? "Recover the operator's share of the refund from them if it should be theirs to bear."
                    : "Review it and adjust it by hand."
            }`,
            variant: "payment",
            category: "Refund",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
        });
    } catch (payoutError) {
        console.error(
            "Failed to apply a refund to the operator's payout:",
            payoutError
        );
    }
};

/*
 * Applies `update` to ONE refund entry only while it is still in the state
 * the caller saw (`expected`), and turns everyone else away with a 409.
 *
 * approve / reject / withdraw / settle all check the refund's state on a copy
 * loaded earlier, so two requests for the same refund (two admins, two tabs)
 * both pass those checks. This makes the state change itself the deciding
 * step: the database lets exactly one of them through. It has to be a
 * conditional update because the Rental schema has no version key, so a plain
 * save() is last-write-wins and would have let both continue on to PayMongo.
 */
/*
 * Saves a rental only if nobody else wrote to it since it was loaded, else
 * 409. For adding a refund: the refundable balance was computed from this
 * copy, so two refunds recorded (or requested) at once would each pass that
 * check and together return more than was paid. Rental has no version key;
 * its updatedAt (changed by every write) stands in for one.
 */
const saveRentalIfUnchanged = async (rental) => {
    if (rental.updatedAt) {
        rental.$where = {
            updatedAt: rental.updatedAt,
        };
    }

    try {
        await rental.save();
    } catch (saveError) {
        if (saveError?.name === "DocumentNotFoundError") {
            throw createError(
                "This rental was just updated by another request. Refresh and check its refunds before trying again.",
                409
            );
        }

        throw saveError;
    } finally {
        rental.$where = undefined;
    }
};

const claimRefundEntry = async (
    rentalId,
    refundId,
    expected,
    update,
    // e.g. { updatedAt } — the rental must still be as it was read.
    rentalFilter = {}
) => {
    const result = await Rental.updateOne(
        {
            _id: rentalId,
            ...rentalFilter,
            refunds: {
                $elemMatch: {
                    _id: refundId,
                    ...expected,
                },
            },
        },
        update
    );

    if (!result?.matchedCount) {
        throw createError(
            "This refund was already handled by another request. Refresh and check its status before trying again.",
            409
        );
    }
};

const setRefundFields = (fields) => ({
    $set: Object.fromEntries(
        Object.entries(fields).map(
            ([field, value]) => [
                `refunds.$.${field}`,
                value,
            ]
        )
    ),
});

/*
 * Writes the gateway outcome onto the refund entry with its own targeted
 * update. It doesn't depend on the rental copy still being current, so a
 * refund that PayMongo already accepted stays linked to its payment even if
 * something else changed the rental in the meantime. Best-effort — the
 * payment itself carries the authoritative record.
 */
const persistRefundGatewayOutcome = async (
    rentalId,
    refund
) => {
    try {
        await Rental.updateOne(
            {
                _id: rentalId,
                "refunds._id": refund._id,
            },
            {
                $set: {
                    "refunds.$.gatewayStatus":
                        refund.gatewayStatus,
                    "refunds.$.gatewayRefundId":
                        refund.gatewayRefundId || "",
                    "refunds.$.gatewayPayment":
                        refund.gatewayPayment || null,
                },
            }
        );

        /*
         * A webhook that settled the payment's refund before this link was
         * written had no entry to mirror onto — catch up from the payment,
         * which holds the authoritative status.
         */
        if (refund.gatewayPayment) {
            const payment = await Payment.findById(
                refund.gatewayPayment
            )
                .select("refund.status")
                .lean();

            const current = payment?.refund?.status;

            if (current && current !== refund.gatewayStatus) {
                refund.gatewayStatus = current;

                await Rental.updateOne(
                    {
                        _id: rentalId,
                        "refunds._id": refund._id,
                    },
                    {
                        $set: {
                            "refunds.$.gatewayStatus": current,
                        },
                    }
                );
            }
        }
    } catch (persistError) {
        console.error(
            `Failed to store the gateway outcome of refund ${refund._id} on rental ${rentalId}:`,
            persistError
        );
    }
};

/*
 * Tells the customer where their money actually is, from the refund's
 * gateway status — "processed" would be untrue for one an admin still has
 * to pay by hand. Completes "A refund of ₱X for your rental R …".
 */
const refundProgressText = (refund) => {
    switch (refund?.gatewayStatus) {
        case PAYMENT_REFUND_STATUS.SUCCEEDED:
            return "has been sent to your original payment method";
        case PAYMENT_REFUND_STATUS.PENDING:
        case PAYMENT_REFUND_STATUS.PROCESSING:
            return "is on its way to your original payment method";
        default:
            return "will be returned to you by our team, which may take a few days";
    }
};

/*
 * The refund itself is already saved (and possibly already sent through
 * PayMongo) when this runs, so a failure here must not fail the request: an
 * admin seeing an error would record the refund again and the customer could
 * be paid twice. Log it and let the admins know the booking total is stale;
 * the next refund change on this booking re-syncs it.
 */
const syncBookingRefundAmountSafely = async (
    rental
) => {
    try {
        await syncBookingRefundAmount(rental.booking);
    } catch (syncError) {
        console.error(
            "Failed to sync booking refund amount:",
            syncError
        );

        try {
            await notifyAdmins({
                type: "Refund Sync Failed",
                title: "Booking Refund Total Not Updated",
                message: `A refund on rental ${rental.rentalCode} was saved, but the booking's refund total could not be updated (${
                    syncError.message || "unknown error"
                }). The refund itself is recorded — do not record it again.`,
                variant: "warning",
                category: "Refund",
                metadata: {
                    reference: rental.rentalCode,
                    relatedId: rental._id,
                    relatedModel: "Rental",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of a refund sync failure:",
                notificationError
            );
        }
    }
};

/*
 * Recomputes rentals for this payment's booking as well as rentals with an
 * explicit refund link. Pre-pickup refunds have no rental refund entry, but
 * their failure still restores payment credit on an existing rental.
 */
export const refreshRentalsTrackedByPayment = async (
    paymentId,
    actorId = null
) => {
    const payment = await Payment.findById(paymentId).select("booking").lean();
    const rentals = await Rental.find({ $or: [
        { "refunds.gatewayPayment": paymentId },
        ...(payment?.booking ? [{ booking: payment.booking }] : []),
    ] });

    for (const rental of rentals) {
        await calculateFinancials(rental);
        if (actorId) rental.audit.updatedBy = actorId;
        await rental.save();
        await syncBookingRefundAmountSafely(rental);
        for (const refund of rental.refunds.filter(
            (entry) => String(entry.gatewayPayment) === String(paymentId)
        )) {
            await applyRefundToOperatorPayout(rental, refund);
        }
    }
};

const notifyRentalRefundNeedsManualAction = async (
    rental,
    refund,
    reasonText
) => {
    try {
        await notifyAdmins({
            type: "Refund Requires Manual Action",
            title: "Manual Refund Needed",
            message: `Rental ${rental.rentalCode}'s approved refund of ${formatAmount(
                Number(refund.amount)
            )} needs to be settled manually — ${reasonText}.`,
            variant: "payment",
            category: "Refund",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of a manual rental refund requirement:",
            notificationError
        );
    }
};

/*
 * Approving a rental-level refund only ever updates a database record —
 * nothing actually sends the customer's money back unless this runs too.
 * Reuses the reservation-fee Payment's PayMongo charge, since that's the
 * only payment on a rental that ever went through a real gateway charge
 * (rental-level payments — extension fees, etc. — are recorded manually
 * and have no chargeId to refund against).
 *
 * Deliberately allows only ONE gateway attempt per payment, ever: if
 * `payment.refund` is already set (by an earlier rental refund, or by a
 * booking-cancellation refund), this falls back to manual settlement
 * rather than risk re-refunding the full original amount a second time —
 * `Payment.refund` has no concept of "how much of this has already been
 * refunded," only a single most-recent attempt. Never throws — a failure
 * here must not block the refund approval itself, only how it's settled.
 */
const attemptRentalRefundGateway = async (
    rental,
    refund,
    actorId
) => {
    try {
        // REFUNDED counts too: a payment already fully refunded is found here
        // so the "already had a refund" guard below explains why this one is
        // manual, instead of claiming no payment exists.
        const payment = await Payment.findOne({
            booking: rental.booking,
            paymentType: PAYMENT_TYPE.RESERVATION_FEE,
            status: {
                $in: [
                    PAYMENT_STATUS.VERIFIED,
                    PAYMENT_STATUS.REFUNDED,
                ],
            },
        });

        if (!payment) {
            refund.gatewayStatus =
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

            await notifyRentalRefundNeedsManualAction(
                rental,
                refund,
                "no verified reservation-fee payment was found for this booking"
            );

            return;
        }

        if (payment.refund) {
            refund.gatewayStatus =
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

            await notifyRentalRefundNeedsManualAction(
                rental,
                refund,
                "this booking's payment has already had a refund processed through it"
            );

            return;
        }

        /*
         * More than the online payment can return (the rest was paid in cash
         * at pickup, say): settle all of it by hand. Splitting it — part via
         * PayMongo, part manual — let the entry mirror "succeeded" from the
         * payment while the manual remainder was still unpaid and untracked.
         */
        if (Number(refund.amount) > Number(payment.amount)) {
            refund.gatewayStatus =
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

            await notifyRentalRefundNeedsManualAction(
                rental,
                refund,
                `it's more than the ${formatAmount(
                    Number(payment.amount)
                )} paid online, so refund it in full outside the app (e.g. cash or bank transfer), then use "Mark as settled"`
            );

            return;
        }

        const chargeId = payment.paymongo?.chargeId;
        const refundAmount = Number(refund.amount);
        const gatewayReason =
            chargeId && refund.requestedBy
                ? PAYMENT_REFUND_REASON.REQUESTED_BY_CUSTOMER
                : PAYMENT_REFUND_REASON.OTHERS;
        const gatewayNotes = chargeId
            ? refund.description || ""
            : `Rental ${rental.rentalCode} refund approved — no PayMongo charge to refund automatically (e.g. Cash on Pickup).`;

        /*
         * The payment carries ONE refund record, so reserve it with a
         * conditional update before anything is sent: whoever gets it may
         * refund through this payment, everyone else is settled by hand. The
         * check above runs on a copy loaded earlier and can't tell that two
         * refunds are being processed at once — this can. (Same claim-first
         * pattern as sendHeldRefund.)
         */
        const claimed = await Payment.findOneAndUpdate(
            {
                _id: payment._id,
                refund: null,
            },
            {
                $set: {
                    refund: {
                        amount: refundAmount,
                        reason: gatewayReason,
                        notes: gatewayNotes,
                        status: chargeId
                            ? PAYMENT_REFUND_STATUS.PENDING
                            : PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
                        method: chargeId
                            ? "automatic"
                            : "manual",
                        initiatedBy: actorId,
                        initiatedAt: new Date(),
                    },
                    "audit.updatedBy": actorId,
                },
            },
            { new: true }
        );

        if (!claimed) {
            refund.gatewayStatus =
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

            await notifyRentalRefundNeedsManualAction(
                rental,
                refund,
                "this booking's payment has already had a refund processed through it"
            );

            return;
        }

        /*
         * From here this refund's settlement is tracked by `payment.refund`,
         * so link them: completing that refund on the Payment (see
         * completeManualRefund / syncRefundStatus) mirrors its outcome back
         * onto this entry. Deliberately not set on the branches above, whose
         * manual settlement isn't tracked by the payment at all.
         */
        refund.gatewayPayment = payment._id;

        if (!chargeId) {
            refund.gatewayStatus =
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

            await notifyRentalRefundNeedsManualAction(
                rental,
                refund,
                "this payment has no PayMongo charge to refund automatically (e.g. Cash on Pickup)"
            );

            return;
        }

        /*
         * issueGatewayRefund never throws, so what happened at PayMongo is
         * read back off the payment afterwards. PayMongo accepting the refund
         * while the system fails to save it is a different outcome from
         * PayMongo turning it down: the first must never send an admin off to
         * pay the customer by hand (the admins are already told exactly that).
         */
        await issueGatewayRefund(claimed, {
            amount: refundAmount,
            reason: gatewayReason,
            notes: gatewayNotes,
            initiatedBy: actorId,
            metadata: {
                rentalId: String(rental._id),
                refundId: String(refund._id),
            },
        });

        const unrecordedRefundId =
            claimed.$locals.unrecordedRefundId;

        if (unrecordedRefundId) {
            refund.gatewayStatus =
                PAYMENT_REFUND_STATUS.PENDING;
            refund.gatewayRefundId =
                unrecordedRefundId;
        } else {
            refund.gatewayStatus =
                claimed.refund.status;
            refund.gatewayRefundId =
                claimed.refund.refundId || "";

            if (
                claimed.refund.status ===
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
            ) {
                await notifyRentalRefundNeedsManualAction(
                    rental,
                    refund,
                    `an automatic refund attempt failed (${
                        claimed.refund.failureReason ||
                        "unknown error"
                    }) — open the payment to retry it through PayMongo, or settle it by hand`
                );
            }
        }

    } catch (error) {
        console.error(
            "Failed to process a rental refund through PayMongo:",
            error
        );

        refund.gatewayStatus =
            PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

        await notifyRentalRefundNeedsManualAction(
            rental,
            refund,
            `an automatic refund attempt failed (${
                error.message || "unknown error"
            })`
        );
    }
};

export const recordRefund = async (
    rentalId,
    data,
    currentUserId,
    {
        allowCancellation = false,
        waiveReservationFee = false,
    } = {}
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
            RENTAL_STATUS.ONGOING &&
        rental.status !== RENTAL_STATUS.COMPLETED &&
        !(
            allowCancellation &&
            data.reason === RENTAL_REFUND_REASON.CANCELLATION
        )
    ) {
        throw createError(
            "Refund cannot be recorded for this rental.",
            400
        );
    }

    const amount =
        normalizeRefundAmount(data.amount);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw createError(
            "Refund amount must be greater than zero.",
            400
        );
    }

    if (amount > MAX_REFUND_AMOUNT) {
        throw createError(
            "Refund amount exceeds maximum allowed value.",
            400
        );
    }

    const reason =
        data.reason?.trim();

    if (!reason) {
        throw createError(
            "Refund reason is required.",
            400
        );
    }

    if (
        !RENTAL_REFUND_REASON_VALUES.includes(
            reason
        )
    ) {
        throw createError(
            "Invalid refund reason.",
            400
        );
    }

    const refundableAmount =
        await computeRefundableAmount(
            rental,
            reason,
            { waiveReservationFee }
        );

    if (
        amount >
        refundableAmount
    ) {
        throw createError(
            "Refund cannot exceed the remaining refundable payment amount.",
            400
        );
    }

    const refund = {
        _id: new mongoose.Types.ObjectId(),
        amount,

        reason,

        status:
            RENTAL_REFUND_STATUS.APPROVED,

        description:
            data.description?.trim() ??
            "",

        processedBy:
            currentUserId,

        processedAt:
            new Date(),

        reference:
            data.reference?.trim() ??
            "",
    };

    rental.refunds.push(refund);

    /* .push() casts into a live subdocument distinct from the plain
       object above — fetch that live copy so gateway-status writes below
       actually persist. */
    const savedRefund = rental.refunds.id(
        refund._id
    );

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(
        rental
    );

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.REFUND_RECORDED,

            performedBy:
                currentUserId,

            description:
                "Rental refund recorded.",

            referenceId:
                refund._id,
        }
    );

    /*
     * Saved BEFORE PayMongo is contacted, so money never moves for a refund
     * the ledger doesn't hold. Until the gateway reports back, the entry
     * reads "needs manual settlement" — the safe default should this request
     * die halfway through. (Two admins recording at once can't both reach
     * PayMongo: the payment's single refund slot is claimed atomically in
     * attemptRentalRefundGateway.)
     */
    savedRefund.gatewayStatus =
        PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

    await saveRentalIfUnchanged(rental);

    await attemptRentalRefundGateway(
        rental,
        savedRefund,
        currentUserId
    );

    await persistRefundGatewayOutcome(
        rental._id,
        savedRefund
    );

    await syncBookingRefundAmountSafely(
        rental
    );

    await applyRefundToOperatorPayout(
        rental,
        refund
    );

    await syncBookingReceiptsSafely(rental.booking);

    try {
        await notifyUser(rental.customer, {
            type: "Refund Processed",
            title: "Refund Processed",
            message: `A refund of ${formatAmount(amount)} for your rental ${rental.rentalCode} ${refundProgressText(
                savedRefund
            )}. Reason: ${reason}`,
            variant: "payment",
            category: "Refund",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
            email: statementEmail(rental),
        });
    } catch (notificationError) {
        console.error("Failed to send refund notification:", notificationError);
    }

    return rental;
};

export const requestRefund = async (
    rentalId,
    data,
    customerId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        String(rental.customer) !==
        String(customerId)
    ) {
        throw createError(
            "Rental not found.",
            404
        );
    }

    if (
        rental.status !== RENTAL_STATUS.ONGOING &&
        rental.status !== RENTAL_STATUS.COMPLETED
    ) {
        throw createError(
            "Refund cannot be requested for this rental.",
            400
        );
    }

    if (!rental.return?.date) {
        throw createError(
            "Refund requests are only available after the vehicle has been returned.",
            400
        );
    }

    const settings =
        await Settings.findOne()
            .select("refundSettings.gracePeriodHours")
            .lean();

    const configuredWindowHours = Number(
        settings?.refundSettings?.gracePeriodHours
    );

    /* Clamp defensively rather than trusting the stored value outright — a
       negative or non-numeric setting would otherwise close (NaN comparisons
       are always false) or permanently disable this window. */
    const refundWindowHours = Number.isFinite(
        configuredWindowHours
    )
        ? Math.min(72, Math.max(0, configuredWindowHours))
        : 24;

    const hoursSinceReturn =
        (Date.now() -
            new Date(rental.return.date).getTime()) /
        (1000 * 60 * 60);

    if (hoursSinceReturn > refundWindowHours) {
        throw createError(
            `Refund requests are only accepted within ${refundWindowHours} hour${
                refundWindowHours === 1 ? "" : "s"
            } of the vehicle being returned.`,
            400
        );
    }

    const reason =
        data.reason?.trim();

    if (!reason) {
        throw createError(
            "Refund reason is required.",
            400
        );
    }

    if (
        !RENTAL_REFUND_REASON_VALUES.includes(
            reason
        )
    ) {
        throw createError(
            "Invalid refund reason.",
            400
        );
    }

    /*
     * The customer picks how much of the remaining refundable balance to
     * ask for: the full amount (default), a percentage of it, or a custom
     * peso figure — never more than what's actually left refundable. An
     * admin can still reject the request or approve a smaller amount than
     * requested if the full ask isn't warranted (see approveRefund below).
     */
    const pendingAmount =
        rental.refunds
            .filter(
                (refund) =>
                    refund.status ===
                    RENTAL_REFUND_STATUS.PENDING
            )
            .reduce(
                (total, refund) =>
                    total +
                    Number(refund.amount),
                0
            );

    const maxRefundable =
        Math.max(
            0,
            (await computeRefundableAmount(
                rental,
                reason
            )) - pendingAmount
        );

    if (maxRefundable <= 0) {
        throw createError(
            "There is no refundable amount remaining for this rental.",
            400
        );
    }

    const refundType =
        data.refundType?.trim() || "full";

    let amount;

    if (refundType === "full") {
        amount = maxRefundable;
    } else if (refundType === "partial") {
        const percentage = Number(data.percentage);

        if (
            !Number.isFinite(percentage) ||
            percentage <= 0 ||
            percentage > 100
        ) {
            throw createError(
                "Percentage must be greater than 0 and at most 100.",
                400
            );
        }

        amount =
            Math.round(
                maxRefundable * percentage
            ) / 100;
    } else if (refundType === "custom") {
        amount = Number(data.amount);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            throw createError(
                "Refund amount must be greater than zero.",
                400
            );
        }
    } else {
        throw createError(
            "Invalid refund type.",
            400
        );
    }

    amount = normalizeRefundAmount(amount);

    if (amount > maxRefundable) {
        throw createError(
            `Refund request cannot exceed the remaining refundable amount of ${formatAmount(maxRefundable)}.`,
            400
        );
    }

    if (amount > MAX_REFUND_AMOUNT) {
        throw createError(
            "Refund amount exceeds maximum allowed value.",
            400
        );
    }

    const refund = {
        _id: new mongoose.Types.ObjectId(),
        amount,

        reason,

        status:
            RENTAL_REFUND_STATUS.PENDING,

        description:
            data.description?.trim() ??
            "",

        requestedBy:
            customerId,

        reference:
            data.reference?.trim() ??
            "",
    };

    rental.refunds.push(refund);

    rental.audit.updatedBy =
        customerId;

    await calculateFinancials(
        rental
    );

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.REFUND_REQUESTED,

            performedBy:
                customerId,

            description:
                "Refund requested by customer.",

            referenceId:
                refund._id,
        }
    );

    await saveRentalIfUnchanged(rental);

    try {
        await notifyAdmins({
            type: "Refund Requested",
            title: "Refund Requested",
            message: `A refund request of ${formatAmount(amount)} was submitted for rental ${rental.rentalCode}. Reason: ${reason}`,
            variant: "payment",
            category: "Refund",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
        });
    } catch (notificationError) {
        console.error("Failed to notify admins of refund request:", notificationError);
    }

    return rental;
};

export const approveRefund = async (
    rentalId,
    refundId,
    adminId,
    overrideAmount = null
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    const refund =
        rental.refunds.id(
            refundId
        );

    if (!refund) {
        throw createError(
            "Refund request not found.",
            404
        );
    }

    if (
        refund.status !==
        RENTAL_REFUND_STATUS.PENDING
    ) {
        throw createError(
            "Only pending refund requests can be approved.",
            400
        );
    }

    const requestedAmount = Number(refund.amount);

    const refundableAmount =
        await computeRefundableAmount(
            rental,
            refund.reason,
            { excludeRefundId: refund._id }
        );

    /*
     * An admin can approve less than what was requested (a partial
     * percentage, or a manually-entered figure) — for example, when the
     * full ask isn't warranted, or when another refund has since used up
     * part of the balance — but never more than the customer actually
     * requested, and never more than what's left refundable. Only the
     * approved figure is checked against the balance, so a request that
     * has outgrown it can still be approved at the smaller amount.
     */
    let approvedAmount = requestedAmount;

    if (
        overrideAmount !== null &&
        overrideAmount !== undefined
    ) {
        approvedAmount = Number(overrideAmount);

        if (
            !Number.isFinite(approvedAmount) ||
            approvedAmount <= 0
        ) {
            throw createError(
                "Approved amount must be greater than zero.",
                400
            );
        }

        if (approvedAmount > requestedAmount) {
            throw createError(
                `Approved amount cannot exceed the requested amount of ${formatAmount(requestedAmount)}.`,
                400
            );
        }
    }

    approvedAmount = normalizeRefundAmount(approvedAmount);

    if (approvedAmount > refundableAmount) {
        throw createError(
            refundableAmount > 0
                ? `Refund cannot exceed the remaining refundable amount of ${formatAmount(refundableAmount)}. Approve a smaller amount or reject the request.`
                : "There is no refundable amount remaining for this rental. Reject the request instead.",
            400
        );
    }

    refund.amount = approvedAmount;

    refund.status =
        RENTAL_REFUND_STATUS.APPROVED;

    refund.processedBy =
        adminId;

    refund.processedAt =
        new Date();

    /*
     * Approval is claimed with a conditional update BEFORE anything else
     * happens: of two simultaneous approvals only one gets past this line,
     * the other is turned away with a 409 and never reaches PayMongo. Until
     * the gateway reports back the entry reads "needs manual settlement" —
     * the safe default should this request die halfway through.
     */
    refund.gatewayStatus =
        PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;

    await claimRefundEntry(
        rental._id,
        refund._id,
        { status: RENTAL_REFUND_STATUS.PENDING },
        setRefundFields({
            amount: refund.amount,
            status: refund.status,
            processedBy: adminId,
            processedAt: refund.processedAt,
            gatewayStatus: refund.gatewayStatus,
        }),
        // The refundable balance above was computed from this copy: a
        // refund recorded or approved meanwhile could make this one exceed
        // what was paid.
        rental.updatedAt
            ? { updatedAt: rental.updatedAt }
            : {}
    );

    rental.audit.updatedBy =
        adminId;

    await calculateFinancials(
        rental
    );

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.REFUND_APPROVED,

            performedBy:
                adminId,

            description:
                "Refund request approved.",

            referenceId:
                refund._id,
        }
    );

    /*
     * Saved BEFORE PayMongo is contacted (as in recordRefund). Saving this
     * copy afterwards would write the entry's gateway status back from it —
     * undoing a webhook that already moved it on (e.g. to "succeeded") in the
     * meantime. The gateway outcome is written with its own targeted update.
     */
    await rental.save();

    await attemptRentalRefundGateway(
        rental,
        refund,
        adminId
    );

    await persistRefundGatewayOutcome(
        rental._id,
        refund
    );

    await syncBookingRefundAmountSafely(
        rental
    );

    await applyRefundToOperatorPayout(
        rental,
        refund
    );

    await syncBookingReceiptsSafely(rental.booking);

    try {
        await notifyUser(rental.customer, {
            type: "Refund Approved",
            title: "Refund Approved",
            message: `Your refund request of ${formatAmount(refund.amount)} for rental ${rental.rentalCode} has been approved and ${refundProgressText(
                refund
            )}.`,
            variant: "payment",
            category: "Refund",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
            email: statementEmail(rental),
        });
    } catch (notificationError) {
        console.error("Failed to send refund approval notification:", notificationError);
    }

    return rental;
};

export const rejectRefund = async (
    rentalId,
    refundId,
    adminId,
    note
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    const refund =
        rental.refunds.id(
            refundId
        );

    if (!refund) {
        throw createError(
            "Refund request not found.",
            404
        );
    }

    if (
        refund.status !==
        RENTAL_REFUND_STATUS.PENDING
    ) {
        throw createError(
            "Only pending refund requests can be rejected.",
            400
        );
    }

    refund.status =
        RENTAL_REFUND_STATUS.REJECTED;

    refund.processedBy =
        adminId;

    refund.processedAt =
        new Date();

    // Claimed conditionally, so a rejection can't overwrite an approval that
    // a simultaneous request already claimed (and may already have paid out).
    await claimRefundEntry(
        rental._id,
        refund._id,
        { status: RENTAL_REFUND_STATUS.PENDING },
        setRefundFields({
            status: refund.status,
            processedBy: adminId,
            processedAt: refund.processedAt,
        })
    );

    rental.audit.updatedBy =
        adminId;

    const trimmedNote =
        note?.trim() || "";

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.REFUND_REJECTED,

            performedBy:
                adminId,

            description:
                trimmedNote
                    ? `Refund request rejected: ${trimmedNote}`
                    : "Refund request rejected.",

            referenceId:
                refund._id,
        }
    );

    await rental.save();

    try {
        await notifyUser(rental.customer, {
            type: "Refund Rejected",
            title: "Refund Rejected",
            message: trimmedNote
                ? `Your refund request of ${formatAmount(refund.amount)} for rental ${rental.rentalCode} was rejected. Reason: ${trimmedNote}`
                : `Your refund request of ${formatAmount(refund.amount)} for rental ${rental.rentalCode} was rejected.`,
            variant: "payment",
            category: "Refund",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
            email: {
                actionPath: `/customer/bookings/${rental.booking}`,
            },
        });
    } catch (notificationError) {
        console.error("Failed to send refund rejection notification:", notificationError);
    }

    return rental;
};

/*
 * An admin confirms a refund they had to pay outside the app — or that they
 * couldn't — so it stops sitting on "requires manual settlement" forever.
 *
 * Only for a refund that no Payment tracks. That is the case for a second
 * refund on a payment that already carried one (a payment holds a single
 * refund record, so the gateway isn't used again and an admin settles it by
 * hand — see attemptRentalRefundGateway). A refund that IS tracked by a
 * payment is settled from the Payments tab, which also updates this record.
 */
export const settleRefundManually = async (
    rentalId,
    refundId,
    adminId,
    {
        succeeded = true,
        notes = "",
    } = {}
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    const refund =
        rental.refunds.id(
            refundId
        );

    if (!refund) {
        throw createError(
            "Refund not found.",
            404
        );
    }

    if (
        (refund.status ||
            RENTAL_REFUND_STATUS.APPROVED) !==
        RENTAL_REFUND_STATUS.APPROVED
    ) {
        throw createError(
            "Only an approved refund can be settled.",
            400
        );
    }

    /*
     * Tracked by a payment => settle it there. "Tracked" means the linked
     * payment is still holding a refund that isn't final. (Refunds approved
     * before the link was made precise carry a payment id even when the
     * payment tracks a different refund; once that payment's refund is final
     * nothing is waiting there, so this one must be settleable here.)
     */
    if (refund.gatewayPayment) {
        const linkedPayment =
            await Payment.findById(
                refund.gatewayPayment
            ).select("refund");

        if (
            linkedPayment?.refund &&
            linkedPayment.refund.status !==
                PAYMENT_REFUND_STATUS.SUCCEEDED &&
            linkedPayment.refund.status !==
                PAYMENT_REFUND_STATUS.FAILED
        ) {
            throw createError(
                "This refund is tracked on its payment — settle it from the Payments tab instead.",
                409
            );
        }
    }

    if (
        refund.gatewayStatus ===
        PAYMENT_REFUND_STATUS.SUCCEEDED ||
        refund.gatewayStatus ===
        PAYMENT_REFUND_STATUS.FAILED
    ) {
        throw createError(
            "This refund has already been settled.",
            409
        );
    }

    if (
        refund.gatewayStatus !==
        PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
    ) {
        throw createError(
            "This refund doesn't need manual settlement.",
            400
        );
    }

    const trimmedNotes =
        String(notes || "")
            .trim()
            .slice(0, 255);

    refund.gatewayStatus = succeeded
        ? PAYMENT_REFUND_STATUS.SUCCEEDED
        : PAYMENT_REFUND_STATUS.FAILED;

    refund.settledAt = new Date();

    refund.settledBy = adminId;

    refund.settlementNote = trimmedNotes;

    // Claimed conditionally, so two admins settling the same refund can't
    // both notify the customer or overwrite each other's outcome.
    await claimRefundEntry(
        rental._id,
        refund._id,
        {
            gatewayStatus:
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
        },
        setRefundFields({
            gatewayStatus: refund.gatewayStatus,
            settledAt: refund.settledAt,
            settledBy: adminId,
            settlementNote: trimmedNotes,
        })
    );

    rental.audit.updatedBy =
        adminId;

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.REFUND_SETTLED,

            performedBy:
                adminId,

            description: `${
                succeeded
                    ? "Refund settled manually"
                    : "Refund marked as not completed"
            }${
                trimmedNotes
                    ? `: ${trimmedNotes}`
                    : "."
            }`,

            referenceId:
                refund._id,
        }
    );

    // A refund that was never paid stops counting (see isRefundInEffect),
    // so the rental's total and the booking's refund total go back up.
    await calculateFinancials(
        rental
    );

    await rental.save();

    if (!succeeded) {
        await syncBookingRefundAmountSafely(
            rental
        );
        await applyRefundToOperatorPayout(rental, refund);
    }

    const receipt = succeeded
        ? await findReceiptForSource(rental.booking, {
              model: RECEIPT_SOURCE.RENTAL_REFUND,
              id: rental._id,
              subId: refund._id,
          })
        : null;

    try {
        await notifyUser(rental.customer, {
            type: succeeded
                ? "Refund Processed"
                : "Refund Failed",
            title: succeeded
                ? "Refund Processed"
                : "Refund Could Not Be Completed",
            message: succeeded
                ? `Your refund of ${formatAmount(
                      refund.amount
                  )} for rental ${rental.rentalCode} has been sent.`
                : `We were unable to send your refund of ${formatAmount(
                      refund.amount
                  )} for rental ${rental.rentalCode}. Please contact support.`,
            variant: succeeded
                ? "success"
                : "warning",
            category: "Refund",
            metadata: {
                reference: rental.rentalCode,
                relatedId: rental._id,
                relatedModel: "Rental",
            },
            email: succeeded
                ? receiptEmail(receipt, {
                      subject: "Refund sent",
                      fallbackPath: `/customer/bookings/${rental.booking}`,
                  })
                : {
                      actionLabel: "Contact support",
                      actionPath: "/customer/customer-service",
                  },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify customer of a settled refund:",
            notificationError
        );
    }

    return rental;
};

export const withdrawRefundRequest = async (
    customerId,
    refundId
) => {
    if (!mongoose.Types.ObjectId.isValid(refundId)) {
        throw createError("Invalid refund ID.", 400);
    }

    const rental =
        await Rental.findOne({
            customer: new mongoose.Types.ObjectId(customerId),
            "refunds._id": new mongoose.Types.ObjectId(refundId),
        });

    if (!rental) {
        throw createError(
            "Refund not found.",
            404
        );
    }

    const refund =
        rental.refunds.id(
            refundId
        );

    if (!refund) {
        throw createError(
            "Refund not found.",
            404
        );
    }

    if (
        refund.status !==
        RENTAL_REFUND_STATUS.PENDING
    ) {
        throw createError(
            "Only pending refund requests can be withdrawn.",
            400
        );
    }

    // Removed conditionally, so a withdrawal can't delete a request that an
    // admin's simultaneous approval already claimed (and may have paid out).
    await claimRefundEntry(
        rental._id,
        refund._id,
        { status: RENTAL_REFUND_STATUS.PENDING },
        {
            $pull: {
                refunds: { _id: refund._id },
            },
        }
    );

    refund.deleteOne();

    rental.audit.updatedBy =
        customerId;

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.REFUND_REMOVED,

            performedBy:
                customerId,

            description:
                "Refund request withdrawn by customer.",

            referenceId:
                refundId,
        }
    );

    await rental.save();

    return rental;
};

/*
 * Admin approves a Pending early-return credit: issues a single-use,
 * customer-scoped Voucher for the (optionally reduced, never increased)
 * number of unused days. Mirrors approveRefund's override-amount guard.
 */
export const approveEarlyReturnCredit = async (
    rentalId,
    adminId,
    overrideDays = null
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    const earlyReturn = rental.earlyReturn;

    if (
        !earlyReturn?.detected ||
        earlyReturn.status !==
            RENTAL_EARLY_RETURN_STATUS.PENDING
    ) {
        throw createError(
            "There is no pending early-return credit for this rental.",
            400
        );
    }

    let approvedDays = earlyReturn.unusedFullDays;

    if (
        overrideDays !== null &&
        overrideDays !== undefined
    ) {
        approvedDays = Number(overrideDays);

        if (
            !Number.isFinite(approvedDays) ||
            approvedDays <= 0
        ) {
            throw createError(
                "Approved days must be greater than zero.",
                400
            );
        }

        if (
            approvedDays >
            earlyReturn.unusedFullDays
        ) {
            throw createError(
                `Approved days cannot exceed the computed ${earlyReturn.unusedFullDays} unused day(s).`,
                400
            );
        }
    }

    const settings =
        await Settings.findOne()
            .select("earlyReturnSettings")
            .lean();

    // The longer of the booking's locked validity and today's.
    const validityMonths = getBookingEarlyReturnSettings(
        await loadBookingTerms(rental),
        settings?.earlyReturnSettings
    ).voucherValidityMonths;

    await issueEarlyReturnVoucher(
        rental,
        approvedDays,
        validityMonths,
        adminId
    );

    rental.audit.updatedBy = adminId;

    await rental.save();

    return rental;
};

/*
 * Admin rejects a Pending early-return credit. No voucher is issued.
 */
export const rejectEarlyReturnCredit = async (
    rentalId,
    adminId,
    note
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    const earlyReturn = rental.earlyReturn;

    if (
        !earlyReturn?.detected ||
        earlyReturn.status !==
            RENTAL_EARLY_RETURN_STATUS.PENDING
    ) {
        throw createError(
            "There is no pending early-return credit for this rental.",
            400
        );
    }

    const trimmedNote =
        note?.trim() || "";

    rental.earlyReturn.status =
        RENTAL_EARLY_RETURN_STATUS.REJECTED;

    rental.earlyReturn.rejectionReason =
        trimmedNote;

    rental.earlyReturn.reviewedBy =
        adminId;

    rental.earlyReturn.reviewedAt =
        new Date();

    rental.audit.updatedBy = adminId;

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.EARLY_RETURN_CREDIT_REJECTED,

            performedBy:
                adminId,

            description:
                trimmedNote
                    ? `Early-return credit rejected: ${trimmedNote}`
                    : "Early-return credit rejected.",
        }
    );

    await rental.save();

    await notifyRentalCustomer(rental, {
        type: "Early Return Credit Rejected",
        title: "Early Return Credit Not Approved",
        message: trimmedNote
            ? `Your early return of rental ${rental.rentalCode} was reviewed, but a credit voucher was not approved. Reason: ${trimmedNote}`
            : `Your early return of rental ${rental.rentalCode} was reviewed, but a credit voucher was not approved.`,
        variant: "info",
        category: "Rental",
    });

    return rental;
};

export const holdSecurityDeposit = async (
    rentalId,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Security deposit can only be held for an ongoing rental.",
            400
        );
    }

    if (
        !rental.securityDeposit?.required
    ) {
        throw createError(
            "This rental does not require a security deposit.",
            400
        );
    }

    if (
    rental.securityDeposit.status !==
    RENTAL_SECURITY_DEPOSIT_STATUS.PENDING
) {
    throw createError(
        "Security deposit must be pending before it can be held.",
        400
    );
}

    const amount =
        Number(
            rental.securityDeposit.amount
        );

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw createError(
            "Security deposit amount must be greater than zero.",
            400
        );
    }

    rental.securityDeposit.status =
        RENTAL_SECURITY_DEPOSIT_STATUS.HELD;

    rental.securityDeposit.amountHeld =
        amount;

    rental.securityDeposit.amountDeducted =
        0;

    rental.securityDeposit.amountReleased =
        0;

    rental.securityDeposit.deductionReason =
        "";

    rental.securityDeposit.processedBy =
        currentUserId;

    rental.securityDeposit.processedAt =
        new Date();

    rental.audit.updatedBy =
        currentUserId;

    await rental.save();

    return rental;
};

export const deductSecurityDeposit = async (
    rentalId,
    amount,
    reason,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Security deposit can only be deducted from an ongoing rental.",
            400
        );
    }

    if (
        !rental.securityDeposit?.required
    ) {
        throw createError(
            "This rental does not require a security deposit.",
            400
        );
    }

    const allowedStatuses = [
        RENTAL_SECURITY_DEPOSIT_STATUS.HELD,
        RENTAL_SECURITY_DEPOSIT_STATUS.PARTIALLY_DEDUCTED,
    ];

    if (
        !allowedStatuses.includes(
        rental.securityDeposit.status
        )
    ) {
        throw createError(
            "Security deposit must be held before it can be deducted.",
            400
        );
    }

    const deductionAmount =
        Number(amount);

    if (
        !Number.isFinite(
            deductionAmount
        ) ||
        deductionAmount <= 0
    ) {
        throw createError(
            "Security deposit deduction must be greater than zero.",
            400
        );
    }

    const amountHeld =
        Number(
            rental.securityDeposit.amountHeld
        );

    const amountDeducted =
        Number(
            rental.securityDeposit.amountDeducted
        );

    const remainingDeposit =
        Math.max(
            0,
            amountHeld - amountDeducted
        );

    if (
        deductionAmount >
        remainingDeposit
    ) {
        throw createError(
            "Security deposit deduction cannot exceed the remaining held amount.",
            400
        );
    }

    const deductionReason =
        reason?.trim();

    if (!deductionReason) {
        throw createError(
            "Security deposit deduction reason is required.",
            400
        );
    }

    rental.securityDeposit.amountDeducted =
        amountDeducted +
        deductionAmount;

    rental.securityDeposit.status =
        rental.securityDeposit
            .amountDeducted >=
        amountHeld
            ? RENTAL_SECURITY_DEPOSIT_STATUS.FULLY_DEDUCTED
            : RENTAL_SECURITY_DEPOSIT_STATUS.PARTIALLY_DEDUCTED;

    rental.securityDeposit.deductionReason =
        deductionReason;

    rental.securityDeposit.processedBy =
        currentUserId;

    rental.securityDeposit.processedAt =
        new Date();

    rental.audit.updatedBy =
        currentUserId;

    await calculateFinancials(rental);

    await rental.save();

    await notifyRentalCustomer(rental, {
        type: "Security Deposit Deducted",
        title: "Security Deposit Deducted",
        message: `${formatAmount(deductionAmount)} was deducted from your security deposit for rental ${rental.rentalCode}: ${deductionReason.slice(0, 200)}`,
        variant: "warning",
    });

    return rental;
};

export const releaseSecurityDeposit = async (
    rentalId,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Security deposit can only be released from an ongoing rental.",
            400
        );
    }

    if (
        !rental.securityDeposit?.required
    ) {
        throw createError(
            "This rental does not require a security deposit.",
            400
        );
    }

    const allowedStatuses = [
    RENTAL_SECURITY_DEPOSIT_STATUS.HELD,
    RENTAL_SECURITY_DEPOSIT_STATUS.PARTIALLY_DEDUCTED,
];

if (
    !allowedStatuses.includes(
        rental.securityDeposit.status
    )
) {
    throw createError(
        "Security deposit must be held before it can be released.",
        400
    );
}

    const amountHeld =
        Number(
            rental.securityDeposit.amountHeld
        );

    const amountDeducted =
        Number(
            rental.securityDeposit.amountDeducted
        );

    const amountReleased =
        Math.max(
            0,
            amountHeld - amountDeducted
        );

    rental.securityDeposit.amountReleased =
        amountReleased;

    rental.securityDeposit.status =
        RENTAL_SECURITY_DEPOSIT_STATUS.RELEASED;

    rental.securityDeposit.processedBy =
        currentUserId;

    rental.securityDeposit.processedAt =
        new Date();

    rental.audit.updatedBy =
        currentUserId;

    await rental.save();

    await notifyRentalCustomer(rental, {
        type: "Security Deposit Released",
        title: "Security Deposit Released",
        message: `Your security deposit of ${formatAmount(amountReleased)} for rental ${rental.rentalCode} has been released${
            amountDeducted > 0
                ? ` (after a deduction of ${formatAmount(amountDeducted)})`
                : ""
        }.`,
        variant: "payment",
    });

    return rental;
};

const describeMaintenancePlan = (plan) =>
    plan.mode === VEHICLE_MAINTENANCE_MODE.TURNAROUND
        ? "standard turnaround"
        : plan.mode === VEHICLE_MAINTENANCE_MODE.EXTENDED
          ? `${plan.days} day(s)`
          : "off road, no end date";

/*
 * A Maintenance outcome comes with a plan (`maintenancePlan`: { mode, days,
 * reason }) that takes effect on the vehicle at once, counted from the
 * return: its window is unbookable from now on (the vehicle stays listed),
 * and bookings inside it are flagged for admins. Without a mode it's off
 * road, as Maintenance always was. Switching back to Available ends
 * maintenance this rental had set. Returns { rental, conflicts }.
 */
export const updateVehicleOutcome =
    async (
        rentalId,
        vehicleOutcome,
        currentUserId,
        maintenancePlan = null
    ) => {
        const rental =
            await getRentalByIdOrThrow(
                rentalId
            );

        if (
            rental.status !==
            RENTAL_STATUS.ONGOING
        ) {
            throw createError(
                "Vehicle outcome can only be changed while the rental is ongoing.",
                400
            );
        }

        await getVehicleByIdOrThrow(
            rental.vehicle
        );

        if (
            !Object.values(
                RENTAL_VEHICLE_OUTCOME
            ).includes(
                vehicleOutcome
            )
        ) {
            throw createError(
                "Invalid vehicle outcome.",
                400
            );
        }

        const isMaintenance =
            vehicleOutcome === RENTAL_VEHICLE_OUTCOME.MAINTENANCE;

        const plan = isMaintenance
            ? {
                  mode:
                      maintenancePlan?.mode ||
                      VEHICLE_MAINTENANCE_MODE.OFF_ROAD,
                  days:
                      maintenancePlan?.mode ===
                      VEHICLE_MAINTENANCE_MODE.EXTENDED
                          ? Number(maintenancePlan.days)
                          : null,
                  reason: String(maintenancePlan?.reason || "").slice(
                      0,
                      500
                  ),
              }
            : { mode: null, days: null, reason: "" };

        if (
            isMaintenance &&
            !VEHICLE_MAINTENANCE_MODE_VALUES.includes(plan.mode)
        ) {
            throw createError("Invalid maintenance type.", 400);
        }

        let conflicts = [];

        // Applied first: an invalid plan (e.g. a bad day count) saves nothing.
        if (isMaintenance) {
            ({ conflicts } = await applyVehicleMaintenance(
                rental.vehicle,
                {
                    mode: plan.mode,
                    days: plan.days,
                    reason: plan.reason,
                    from: rental.return?.date ?? new Date(),
                    rentalId: rental._id,
                    // The status follows on completion.
                    setStatus: false,
                },
                currentUserId
            ));
        } else {
            await clearVehicleMaintenance(rental.vehicle, {
                rentalId: rental._id,
            });
        }

        rental.vehicleOutcome =
            vehicleOutcome;

        rental.maintenancePlan = plan;

        rental.audit.updatedBy =
            currentUserId;

        appendOperationalEvent(
            rental,
            {
                type:
                    RENTAL_OPERATIONAL_EVENT.VEHICLE_OUTCOME_UPDATED,

                performedBy:
                    currentUserId,

                description: isMaintenance
                    ? `Vehicle outcome set to maintenance (${describeMaintenancePlan(
                          plan
                      )}).`
                    : "Vehicle outcome set to available.",
            }
        );

        await rental.save();

        return { rental, conflicts };
    };

export const completeRental = async (
    rentalId,
    notes,
    currentUserId,
    overrideOutstandingBalance = false
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status !==
        RENTAL_STATUS.ONGOING
    ) {
        throw createError(
            "Only ongoing rentals can be completed.",
            400
        );
    }

    if (!rental.return?.date) {
        throw createError(
            "Rental must be returned before it can be completed.",
            400
        );
    }

    if (!rental.vehicleOutcome) {
        throw createError(
            "Vehicle outcome must be selected before completing the rental.",
            400
        );
    }

    if (
    rental.securityDeposit?.required &&
    (
        rental.securityDeposit.status ===
            RENTAL_SECURITY_DEPOSIT_STATUS.PENDING ||
        rental.securityDeposit.status ===
            RENTAL_SECURITY_DEPOSIT_STATUS.HELD ||
        rental.securityDeposit.status ===
            RENTAL_SECURITY_DEPOSIT_STATUS.PARTIALLY_DEDUCTED
    )
    ) {
        throw createError(
            "Security deposit must be resolved before completing the rental.",
            400
        );
    }

    await calculateFinancials(rental);

    const outstandingBalance = Math.max(
        0,
        Number(rental.financial?.balance || 0)
    );

    if (
        outstandingBalance > 0 &&
        !overrideOutstandingBalance
    ) {
        throw createError(
            `This rental has an outstanding balance of ${formatAmount(
                outstandingBalance
            )}. Settle it, or explicitly confirm completing with the balance outstanding.`,
            400
        );
    }

    const vehicle =
        await getVehicleByIdOrThrow(
            rental.vehicle
        );

    rental.status =
        RENTAL_STATUS.COMPLETED;

    rental.completion = {
        completedAt:
            new Date(),

        completedBy:
            currentUserId,

        notes:
            notes?.trim() ?? "",

        outstandingBalanceAtCompletion:
            outstandingBalance > 0
                ? outstandingBalance
                : 0,
    };

    rental.audit.updatedBy =
        currentUserId;

    appendOperationalEvent(
        rental,
        {
            type:
                RENTAL_OPERATIONAL_EVENT.COMPLETED,

            performedBy:
                currentUserId,

            description:
                "Rental completed.",
        }
    );

    const booking =
        await getBookingByIdOrThrow(
            rental.booking
        );

    booking.status =
        BOOKING_STATUS.COMPLETED;

    booking.audit.updatedBy =
        currentUserId;

    booking.statusHistory.push({
        status: BOOKING_STATUS.COMPLETED,
        changedBy: currentUserId,
        reason: "Rental completed.",
    });

    await booking.save();

    const hasAnotherApprovedBooking =
        await Booking.exists({
            vehicle: rental.vehicle,
            status: BOOKING_STATUS.APPROVED,
        });

    /*
     * The daily auto-expire sweep only touches currently-Available
     * vehicles, so a vehicle whose registration expires while it's out on
     * rental is never caught mid-rental. Catch it here instead: if it
     * would otherwise return to Available, but its registration has since
     * expired, send it to EXPIRED_REGISTRATION instead so it doesn't
     * become bookable/visible again until renewed. Doesn't touch the
     * Maintenance or Reserved outcomes below — a vehicle already headed
     * to Maintenance is already fully unbookable regardless, and one with
     * a pending approved booking keeps that booking rather than being
     * silently blocked by a check nobody asked for here.
     */
    const isRegistrationExpired =
        vehicle.compliance?.licenseExpiration &&
        new Date(
            vehicle.compliance.licenseExpiration
        ) <= new Date();

    /*
     * The next customer may already have picked the vehicle up while this
     * rental was awaiting completion; then it stays Rented.
     */
    const isOutWithNextCustomer = await isOutOnRental(
        "vehicle",
        rental.vehicle,
        { excludeBookingId: rental.booking }
    );

    /*
     * A Maintenance outcome saved before maintenance plans existed never put
     * a window on the vehicle: it's off road, as Maintenance was then.
     */
    const isLegacyMaintenanceOutcome =
        rental.vehicleOutcome === RENTAL_VEHICLE_OUTCOME.MAINTENANCE &&
        !rental.maintenancePlan?.mode &&
        !vehicle.maintenance?.mode;

    if (isLegacyMaintenanceOutcome) {
        vehicle.maintenance = {
            mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD,
            startedAt: rental.return?.date ?? new Date(),
            until: null,
            setBy: currentUserId,
            setAt: new Date(),
            rental: rental._id,
        };
    }

    // The window set by the outcome (if it hasn't already run out).
    const isUnderMaintenance = Boolean(getMaintenanceWindow(vehicle));

    if (!isUnderMaintenance && vehicle.maintenance?.mode) {
        vehicle.maintenance = {};
    }

    vehicle.status = isOutWithNextCustomer
        ? VEHICLE_STATUS.RENTED
        : isUnderMaintenance
          ? VEHICLE_STATUS.MAINTENANCE
          : hasAnotherApprovedBooking
            ? VEHICLE_STATUS.RESERVED
            : isRegistrationExpired
              ? VEHICLE_STATUS.EXPIRED_REGISTRATION
              : VEHICLE_STATUS.AVAILABLE;

    await vehicle.save();

    await rental.save();

    /*
     * Bookings inside the maintenance window were flagged when the outcome
     * was saved (re-checked here; nothing new is flagged twice). An expired
     * registration still just alerts admins.
     */
    if (isUnderMaintenance) {
        await flagMaintenanceConflicts(vehicle, currentUserId);
    } else if (
        vehicle.status === VEHICLE_STATUS.EXPIRED_REGISTRATION
    ) {
        await alertAdminsOfStrandedBookings(
            vehicle._id,
            "came back from its last rental with an expired registration"
        );
    }

    /*
     * Best-effort: schedules the operator's payout automatically the moment
     * the rental completes, so admin never has to manually approve/credit
     * one. The wallet isn't credited immediately — see `scheduleOperatorPayout`
     * for the hold period this goes through first. A failure here must never
     * block the rental from completing — the booking is already marked
     * Completed above regardless of outcome.
     */
    try {
        await scheduleOperatorPayout(
            booking,
            vehicle,
            rental._id,
            currentUserId
        );
    } catch (payoutError) {
        console.error(
            "Failed to schedule operator payout on rental completion:",
            payoutError
        );

        try {
            await notifyAdmins({
                type: "payout",
                title: "Automatic Payout Scheduling Failed",
                message: `Scheduling the operator's payout for booking ${booking.bookingCode} (rental ${rental.rentalCode}) failed: ${payoutError.message}. Open this partner's card on the Consignments page to review and credit a payout for this booking manually.`,
                variant: "error",
                category: "Payout",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: rental._id,
                    relatedModel: "Rental",
                },
            });
        } catch (notifyError) {
            console.error(
                "Failed to notify admins of payout scheduling failure:",
                notifyError
            );
        }
    }

    // Not if they're already out driving the next rental.
    await releaseDriverIfIdle(rental.driver);

    await notifyRentalVehicleOperator(rental, {
        type: "Rental Completed",
        title: "Rental Completed",
        message: `Rental ${rental.rentalCode} is complete. Your vehicle status is now ${vehicle.status}.`,
        variant: "success",
    });

    await notifyRentalCustomer(rental, {
        type: "Rental Completed",
        title: "Rental Completed — Leave a Review",
        message: `Your rental ${rental.rentalCode} is now complete. Thanks for riding with us! Open your trip to leave a review.`,
        variant: "success",
    });

    return rental;
};

/*
 * Lets a customer close out their own trip once the vehicle has been
 * returned, instead of waiting on an admin to click Complete. Reuses
 * completeRental as-is, so every existing guardrail still applies (deposit
 * must be resolved, balance must be settled) — it just fails with the same
 * error messages if the trip isn't actually ready to close.
 */
export const completeRentalAsCustomer = async (
    rentalId,
    customerId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        String(rental.customer) !==
        String(customerId)
    ) {
        throw createError(
            "Rental not found.",
            404
        );
    }

    return completeRental(
        rentalId,
        "Marked as completed by customer.",
        customerId,
        false
    );
};

export const getCustomerRentals = async (
    customerId
) => {
    return Rental.find({
        customer: customerId,
    })
        .populate(
            "vehicle",
            "vehicleCode brand model plateNumber"
        )
        .populate(
            "driver",
            "driverCode firstName lastName"
        )
        .sort({
            createdAt: -1,
        })
        .lean();
};

export const getOperatorRentals = async (
    operatorId
) => {
    const vehicleIds =
        await getOperatorVehicleIds(operatorId);

    return Rental.find({
        vehicle: {
            $in: vehicleIds,
        },
    })
        .populate(
            "vehicle",
            "vehicleCode brand model plateNumber"
        )
        .populate(
            "driver",
            "driverCode firstName lastName"
        )
        .sort({
            createdAt: -1,
        })
        .lean();
};

export const getAdminRentals = async () => {
    return Rental.find({})
        .populate(
            "customer",
            "firstName lastName"
        )
        .populate(
            "vehicle",
            "vehicleCode brand model plateNumber"
        )
        .populate(
            "driver",
            "driverCode firstName lastName"
        )
        .sort({
            createdAt: -1,
        })
        .lean();
};

export const addOperationalEvent =
    async (
        rentalId,
        data,
        currentUserId
    ) => {
        const rental =
            await getRentalByIdOrThrow(
                rentalId
            );

        rental.operationalEvents.push({
            type: data.type,

            date: data.date
                ? new Date(data.date)
                : new Date(),

            performedBy:
                currentUserId,

            description:
                data.description?.trim() ??
                "",

            referenceId:
                data.referenceId ??
                null,
        });

        rental.audit.updatedBy =
            currentUserId;

        await rental.save();

        return rental;
    };

export const updateRental = async (
    rentalId,
    data,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (
        rental.status ===
        RENTAL_STATUS.COMPLETED
    ) {
        throw createError(
            "Completed rentals cannot be edited.",
            400
        );
    }

    if (
        data.driver !== undefined
    ) {
        await reassignDriver(
            rentalId,
            data.driver,
            "",
            currentUserId
        );
    }

    if (
        data.vehicleOutcome !==
        undefined
    ) {
        await updateVehicleOutcome(
            rentalId,
            data.vehicleOutcome,
            currentUserId,
            data.maintenancePlan ?? null
        );
    }

    if (
        data.status !== undefined &&
        data.status !==
            rental.status
    ) {
        if (
            data.status !==
            RENTAL_STATUS.COMPLETED
        ) {
            throw createError(
                "Rental status can only be changed to Completed through the completion process.",
                400
            );
        }

        return completeRental(
            rentalId,
            "",
            currentUserId
        );
    }

    return getRental(
        rentalId
    );
};

export const waivePenalty = async (
    rentalId,
    reason,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (!rental.lateReturn?.lateDurationMinutes) {
        throw createError(
            "No penalty to waive.",
            400
        );
    }

    if (rental.lateReturn.amount === 0) {
        throw createError(
            "Penalty has already been waived.",
            400
        );
    }

    const previousAmount =
        rental.lateReturn.amount;

    rental.lateReturn.amount = 0;

    const lateCharge =
        rental.charges.find(
            (charge) =>
                charge.type ===
                RENTAL_CHARGE_TYPE.LATE
        );

    if (lateCharge) {
        lateCharge.amount = 0;
        lateCharge.description =
            "Late return penalty waived.";
    } else {
        rental.charges.push({
            type: RENTAL_CHARGE_TYPE.LATE,
            amount: 0,
            description:
                "Late return penalty waived.",
            addedBy: currentUserId,
            addedAt: new Date(),
        });
    }

    rental.penaltyHistory.push({
        action: "waived",
        previousAmount,
        newAmount: 0,
        reason: reason || "",
        performedBy: currentUserId,
        performedAt: new Date(),
        gracePeriodMinutes:
            rental.lateReturn
                .gracePeriodMinutes ?? 0,
        chargingUnit:
            rental.lateReturn
                .chargingUnit || "",
        chargedUnits:
            rental.lateReturn
                .chargedUnits ?? 0,
        rate: rental.lateReturn.rate ?? 0,
        rateType:
            rental.lateReturn.rateType || "",
    });

    await calculateFinancials(rental);

    await rental.save();

    await notifyPenaltyAction(rental, {
        type: "Late Return Penalty Waived",
        title: "Late Return Penalty Waived",
        variant: "success",
        message: `The late return penalty of ${formatAmount(
            previousAmount
        )} on rental ${rental.rentalCode} has been waived.${
            reason ? ` Reason: ${reason}` : ""
        }`,
    });

    return rental;
};

export const adjustPenalty = async (
    rentalId,
    newAmount,
    reason,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (!rental.lateReturn?.lateDurationMinutes) {
        throw createError(
            "No penalty to adjust.",
            400
        );
    }

    const parsedAmount =
        Number(newAmount);

    if (
        !Number.isFinite(
            parsedAmount
        ) ||
        parsedAmount < 0
    ) {
        throw createError(
            "Penalty amount must be a non-negative number.",
            400
        );
    }

    const settings =
        await Settings.findOne()
            .select("penaltySettings")
            .lean();

    // The lower of the booking's locked cap and today's (0 = no cap).
    const maximumCap = getBookingPenaltyCap(
        await loadBookingTerms(rental),
        settings?.penaltySettings ?? {}
    );

    if (
        maximumCap > 0 &&
        parsedAmount > maximumCap
    ) {
        throw createError(
            `Adjusted penalty cannot exceed the maximum cap of ${formatAmount(maximumCap)}.`,
            400
        );
    }

    const previousAmount =
        rental.lateReturn.amount;

    rental.lateReturn.amount =
        parsedAmount;

    const lateCharge =
        rental.charges.find(
            (charge) =>
                charge.type ===
                RENTAL_CHARGE_TYPE.LATE
        );

    if (lateCharge) {
        lateCharge.amount =
            parsedAmount;
        lateCharge.description =
            `Late return charge adjusted from ${formatAmount(previousAmount)} to ${formatAmount(parsedAmount)}.`;
    } else {
        rental.charges.push({
            type: RENTAL_CHARGE_TYPE.LATE,
            amount: parsedAmount,
            description:
                `Late return charge set to ${formatAmount(parsedAmount)}.`,
            addedBy: currentUserId,
            addedAt: new Date(),
        });
    }

    rental.penaltyHistory.push({
        action: "adjusted",
        previousAmount,
        newAmount: parsedAmount,
        reason: reason || "",
        performedBy: currentUserId,
        performedAt: new Date(),
        gracePeriodMinutes:
            rental.lateReturn
                .gracePeriodMinutes ?? 0,
        chargingUnit:
            rental.lateReturn
                .chargingUnit || "",
        chargedUnits:
            rental.lateReturn
                .chargedUnits ?? 0,
        rate: rental.lateReturn.rate ?? 0,
        rateType:
            rental.lateReturn.rateType || "",
    });

    await calculateFinancials(rental);

    await rental.save();

    await notifyPenaltyAction(rental, {
        type: "Late Return Penalty Adjusted",
        title: "Late Return Penalty Adjusted",
        message: `The late return penalty on rental ${
            rental.rentalCode
        } has been adjusted from ${formatAmount(
            previousAmount
        )} to ${formatAmount(parsedAmount)}.${
            reason ? ` Reason: ${reason}` : ""
        }`,
    });

    return rental;
};

export const addPenaltyNote = async (
    rentalId,
    reason,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (!rental.lateReturn?.lateDurationMinutes) {
        throw createError(
            "No penalty record to add a note to.",
            400
        );
    }

    rental.penaltyHistory.push({
        action: "note_added",
        previousAmount:
            rental.lateReturn.amount,
        newAmount:
            rental.lateReturn.amount,
        reason: reason || "",
        performedBy: currentUserId,
        performedAt: new Date(),
        gracePeriodMinutes:
            rental.lateReturn
                .gracePeriodMinutes ?? 0,
        chargingUnit:
            rental.lateReturn
                .chargingUnit || "",
        chargedUnits:
            rental.lateReturn
                .chargedUnits ?? 0,
        rate: rental.lateReturn.rate ?? 0,
        rateType:
            rental.lateReturn.rateType || "",
    });

    await rental.save();

    return rental;
};

export const applyPenalty = async (
    rentalId,
    reason,
    currentUserId
) => {
    const rental =
        await getRentalByIdOrThrow(
            rentalId
        );

    if (!rental.return?.date) {
        throw createError(
            "Rental has not been returned yet.",
            400
        );
    }

    if (
        rental.lateReturn?.confirmedAt &&
        (rental.lateReturn
            ?.lateDurationMinutes ?? 0) > 0
    ) {
        throw createError(
            "Penalty has already been applied.",
            400
        );
    }

    await calculateLateReturn(
        rental,
        rental.return.date,
        currentUserId
    );

    if (
        (rental.lateReturn
            ?.lateDurationMinutes ?? 0) <= 0
    ) {
        throw createError(
            "This rental was returned on time. No penalty is due.",
            400
        );
    }

    await calculateFinancials(rental);

    rental.penaltyHistory.push({
        action: "applied",
        previousAmount: 0,
        newAmount:
            rental.lateReturn.amount,
        reason: reason || "",
        performedBy: currentUserId,
        performedAt: new Date(),
        gracePeriodMinutes:
            rental.lateReturn
                .gracePeriodMinutes ?? 0,
        chargingUnit:
            rental.lateReturn
                .chargingUnit || "",
        chargedUnits:
            rental.lateReturn
                .chargedUnits ?? 0,
        rate: rental.lateReturn.rate ?? 0,
        rateType:
            rental.lateReturn
                .rateType || "",
    });

    await rental.save();

    await notifyPenaltyAction(rental, {
        type: "Late Return Penalty Applied",
        title: "Late Return Penalty Applied",
        message: `A late return penalty of ${formatAmount(
            rental.lateReturn.amount
        )} has been added to rental ${rental.rentalCode} for returning ${
            rental.lateReturn.chargedUnits
        } ${(rental.lateReturn.chargingUnit || "hour").toLowerCase()}(s) late.${
            reason ? ` Reason: ${reason}` : ""
        }`,
    });

    return rental;
};
