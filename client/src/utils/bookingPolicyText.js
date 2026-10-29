/*
 * The booking rules as customer-facing sentences, shared by the booking
 * form's Important Reminders card and the Terms & Conditions so the two can
 * never disagree. Every number comes from the same place the server reads:
 * the constants mirrored from it, or the admin's settings (public settings
 * endpoint, see usePublicRefundSettings). Values still loading are null, and
 * the wording then stays number-free rather than quote defaults.
 */

import {
    BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS,
    EARLY_PICKUP_MAX_HOURS,
    RESCHEDULE_MIN_NOTICE_HOURS,
} from "../constants/bookingStatus";

import {
    MIN_BOOKING_LEAD_HOURS,
    PICKUP_STEP_MINUTES,
    formatPickupHours,
} from "./pickupTime";

export const REFUND_PROCESSING_TIME = "5–7 business days";

export const hoursLabel = (hours) =>
    `${hours} hour${Number(hours) === 1 ? "" : "s"}`;

const pesos = (amount) =>
    `₱${Number(amount).toLocaleString("en-PH")}`;

/* 480 → "8:00 AM". */
const formatMinuteOfDay = (minute) => {
    const hour = Math.floor(minute / 60);

    return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${
        hour < 12 ? "AM" : "PM"
    }`;
};

const timeToMinute = (time) => {
    const [hour, minute] = String(time).split(":").map(Number);

    return hour * 60 + minute;
};

/*
 * Settings → Bookings booking hours, as a sentence; null when they're off.
 * The minimum notice only counts while they're open.
 */
export const describeBookingHours = (bookingHours) => {
    if (!bookingHours?.enabled) {
        return null;
    }

    const open = timeToMinute(bookingHours.openTime);
    const close = timeToMinute(bookingHours.closeTime);
    const firstMorningPickup = open + MIN_BOOKING_LEAD_HOURS * 60;

    return `Bookings are approved between ${formatMinuteOfDay(
        open
    )} and ${formatMinuteOfDay(close)} (Philippine time), and the ${hoursLabel(
        MIN_BOOKING_LEAD_HOURS
    )}' notice only counts during those hours.${
        firstMorningPickup <= close
            ? ` A booking made after ${formatMinuteOfDay(
                  close
              )} or before ${formatMinuteOfDay(
                  open
              )} can be picked up from ${formatMinuteOfDay(
                  firstMorningPickup
              )} at the earliest.`
            : ""
    }`;
};

/*
 * Choosing a pickup time, and what the booked time is used for. The pickup
 * window and booking hours come from Settings → Bookings (public settings).
 */
export const describePickupTimeRules = (
    bookingHours = null,
    pickupHours = null
) =>
    [
        `You choose a pickup date and time when you book, between ${formatPickupHours(
            pickupHours
        ).replace(" – ", " and ")} (Philippine time) in ${PICKUP_STEP_MINUTES}-minute steps, at least ${hoursLabel(MIN_BOOKING_LEAD_HOURS)} from when you book so there's time to pay and get approved. The return is at the same time on your return date, and rentals are priced in whole days.`,
        describeBookingHours(bookingHours),
        "Until pickup, cancellation refunds, the cancellation deadline, rescheduling notice and no-show timing are all measured from the pickup date and time you booked.",
    ].filter(Boolean);

/* 150 → "2 hours 30 minutes". */
const durationLabel = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return [hours > 0 && hoursLabel(hours), rest > 0 && `${rest} minutes`]
        .filter(Boolean)
        .join(" ");
};

/* Settings → Bookings: time kept free between rentals of the same vehicle. */
export const describeTurnaroundBuffer = (turnaroundBufferMinutes) =>
    `Each vehicle (and driver) needs at least ${durationLabel(
        Number(turnaroundBufferMinutes) || 0
    )} between rentals for cleaning and inspection, so a pickup can't be booked that close to another rental's return, and your return can't be that close to the next pickup. A vehicle that's out on a rental can still be booked for later times.`;

/* The rental period itself, which starts at the actual hand-over. */
export const describeRentalPeriodRules = () => [
    `Your rental period starts when the vehicle is actually handed over to you and runs for the days you booked (plus any approved extension), so it's due back at that same time on your return date. For example, released at 2:00 PM for 3 days, it's due back at 2:00 PM three days later. The vehicle can be released at most ${hoursLabel(EARLY_PICKUP_MAX_HOURS)} before your booked pickup time.`,
    "If the vehicle or your driver is booked soon after you, a late pickup can't push your return into that booking or the time between rentals: the due-back time is moved earlier instead, and the price doesn't change. Pick up on time to get your full rental period.",
    "Your booked schedule stays on record next to the actual pickup and due-back times. Late-return charges, early-return credits and extensions are measured from the due-back time set at pickup.",
];

/* Late returns, from the admin's penalty settings (null while loading). */
export const describeLateReturn = (latePenalty) => {
    if (!latePenalty) {
        return "Returning the vehicle after your due-back time adds a late-return charge based on how late it is.";
    }

    const unit = (latePenalty.chargingUnit || "Hour").toLowerCase();
    const grace = Number(latePenalty.gracePeriodMinutes) || 0;
    const cap = Number(latePenalty.maximumCap) || 0;

    return `Returning the vehicle after your due-back time is charged for every started ${unit} late${
        grace > 0 ? `, after a ${grace}-minute grace period` : ""
    }${cap > 0 ? `, up to ${pesos(cap)}` : ""}.`;
};

/* When a booking not picked up becomes a no-show. The refund side of a
   no-show is part of describeCancellationPolicy. */
export const describeNoShowTiming = (noShowGraceHours, autoMark = true) => {
    const grace = Number(noShowGraceHours) || 0;

    return `${
        grace > 0
            ? `If the vehicle isn't picked up within ${hoursLabel(grace)} of your booked pickup time`
            : "If the vehicle isn't picked up at your booked pickup time"
    }, the booking can be marked a no-show from then on.${
        autoMark
            ? " If it still isn't picked up by the end of that day, it's marked automatically."
            : ""
    }`;
};

export const describeCancellationProcess = ({
    requireCancellationReason,
    refundRequestWindowHours,
}) => [
    "An approved booking can be cancelled from My Bookings until its booked pickup time. After that, contact us instead.",
    requireCancellationReason
        ? "You'll be asked for a short reason when you cancel, and shown the exact refund before you confirm."
        : "You'll be shown the exact refund before you confirm a cancellation.",
    `Approved refunds usually arrive within ${REFUND_PROCESSING_TIME}, depending on the payment provider.`,
    `Overpaid, or had a problem with the vehicle? Request a refund from My Bookings within ${hoursLabel(refundRequestWindowHours)} of returning it.`,
];

export const describeRescheduling = () => [
    `A booking can be rescheduled (new dates and/or pickup time, same vehicle) from My Bookings at least ${hoursLabel(RESCHEDULE_MIN_NOTICE_HOURS)} before the booked pickup time, once the reservation fee is paid and as long as it has no extension.`,
    "Each booking can be rescheduled once, and the request needs admin approval. To change it again, cancel and book again.",
    "The price is recalculated at the vehicle's current daily rate: any extra is paid online, and anything you already paid above the new total is refunded.",
    "If you cancel after rescheduling, the refund is based on your original pickup time.",
];

export const describeExtensions = () => [
    "Need more time? Request an extension from My Bookings before you return the vehicle, one request at a time. It's subject to availability and admin approval.",
    "Once approved, the extension fee is paid online, and your due-back time moves to the new end.",
    "A rental is not extended just because the vehicle hasn't been returned yet. Without an approved extension, late-return charges apply.",
];

/* Late returns and the next booking (server lateReturnConflictService). */
export const describeLateReturnEffects = () => [
    "If your vehicle is still out with its previous renter close to your pickup, we'll warn you. If it can't be back and ready in time, you choose: another vehicle for the same dates at no extra cost (a cheaper one refunds the difference), waiting for it (your rental then starts when you pick it up, with the full booked duration), or a full refund. If you don't choose and it still isn't back by your pickup time plus the no-show grace, you're refunded in full automatically.",
    "Returning late yourself can leave the next customer without a vehicle. Besides late-return charges, costs the delay causes them (refunds or replacement vehicles) may be charged to your rental.",
];

export const CANCELLATION_POLICY_LOADING_TEXT =
    "How much of the reservation fee is refunded depends on when you cancel and whether your booking has been approved. The exact refund is shown before you confirm a cancellation.";

export const LICENSE_RULES = [
    "Bring your valid driver's license when you pick up the vehicle. Our staff check it before release.",
    "The license on your profile must not be expired, or you won't be able to book, and it should cover the type and transmission of the vehicle you book. Update it in your Profile first.",
    "Bring a valid government ID that matches your account name. Missing or mismatched documents can stop the release.",
    "No license, or yours doesn't cover this vehicle? Choose \"With Driver\" so our driver drives for you.",
];

export const FUEL_RULES = [
    "The fuel level (bar/percentage) is recorded when you pick up the vehicle.",
    "Return it with the same level. For example, released at 75%, return at about 75%.",
    "Returning with less fuel may add a refueling charge.",
];

/* The deposit amount itself is per vehicle (shown on its listing). */
export const DEPOSIT_RULES = [
    "It's returned after the vehicle passes the return inspection, minus any damage, late-return, fuel or other documented charges.",
    "If charges exceed the deposit, you pay the difference.",
];

export const INSPECTION_RULE =
    "Inspect the vehicle with our staff at pickup and return. Report any existing damage before you drive off.";

export const VEHICLE_USE_RULES = [
    "Only you (or, on a \"With Driver\" booking, your assigned driver) may drive the vehicle.",
    "No smoking or vaping, off-road driving, racing, towing, or ride-hailing/commercial use.",
    "Report any accident, new damage or warning light to us right away.",
    "Damage, missing items, excessive cleaning or a fuel shortage may be charged after the return inspection.",
];

export const MOTORCYCLE_AREA_RULE =
    "Motorcycles must stay within Luzon and may not go beyond Baguio.";

export const describePayment = () => [
    `Pay the reservation fee online (GCash or QRPh, through PayMongo) within ${hoursLabel(BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS)} of booking, or before your pickup time if that's sooner, or the reservation is released automatically.`,
    "Your booking is confirmed only once an admin approves it. Partner vehicles can take a little longer while we check with the owner.",
    "The rest of the rental is paid at pickup, unless you choose to pay in full online when you book.",
    "A pickup distance fee, if any, is paid together with the reservation fee; a return distance fee is paid at pickup.",
];
