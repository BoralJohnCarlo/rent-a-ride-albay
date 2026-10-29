import createError from "../utils/createError.js";

import Discount from "../models/Discount.js";
import Vehicle from "../models/Vehicle.js";

import {
    DISCOUNT_SCOPE,
    DISCOUNT_METHOD,
    DISCOUNT_STATUS,
} from "../constants/discountConstants.js";

import {
    businessDayStart,
    toBusinessDateKey,
} from "../utils/businessTime.js";

import { getVoucherDateState } from "./voucherService.js";

/*
 * Vehicle discounts lower a vehicle's daily rate automatically while they
 * run (Manila calendar days, inclusive, judged at the moment of pricing).
 * When several apply to a vehicle the one taking the most off wins - they
 * never stack with each other. A voucher still applies on top, to the
 * discounted rate.
 *
 * A booking keeps a snapshot of the discount it was priced with
 * (pricing.vehicleDiscount). Re-pricing that booking later (admin edit,
 * extension, reschedule, a forced vehicle change) uses the better of that
 * snapshot and whatever runs at that time, so a customer never loses the
 * deal they booked because the sale has since ended.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const roundMoney = (value) =>
    Math.round((Number(value) || 0) * 100) / 100;

/* Pesos off one day at `baseRate`, never more than the rate itself. */
const computeAmountOff = (baseRate, discountMethod, discountValue) => {
    const base = Math.max(0, Number(baseRate) || 0);
    const value = Math.max(0, Number(discountValue) || 0);

    if (discountMethod === DISCOUNT_METHOD.PERCENTAGE) {
        return roundMoney((base * Math.min(value, 100)) / 100);
    }

    return roundMoney(Math.min(value, base));
};

const appliesToVehicle = (discount, vehicleId) =>
    discount.scope === DISCOUNT_SCOPE.ALL_VEHICLES ||
    (discount.vehicles || []).some(
        (entry) => String(entry?._id ?? entry) === String(vehicleId)
    );

/* Discounts running right now (active, and today within their days). */
const getActiveDiscounts = async (now = new Date()) => {
    // A day of slack either side; the exact Manila-day check is below.
    const candidates = await Discount.find({
        status: DISCOUNT_STATUS.ACTIVE,
        startDate: { $lte: new Date(now.getTime() + DAY_MS) },
        endDate: { $gte: new Date(now.getTime() - DAY_MS) },
    })
        .sort({ createdAt: -1 })
        .lean();

    return candidates.filter(
        (discount) => getVoucherDateState(discount, now) === "current"
    );
};

/*
 * The daily rate a vehicle is priced at, given the discounts running
 * (`activeDiscounts`, from getActiveDiscounts) and optionally a booking's
 * locked snapshot. Returns { dailyRate, originalDailyRate, discount } where
 * `discount` is the snapshot to store on the booking, or null.
 */
const resolveVehicleRate = (
    vehicle,
    activeDiscounts = [],
    { lockedDiscount = null } = {}
) => {
    const originalDailyRate = roundMoney(vehicle?.pricing?.dailyRate);

    const candidates = activeDiscounts
        .filter((discount) => appliesToVehicle(discount, vehicle?._id))
        .map((discount) => ({
            discount: discount._id,
            name: discount.name,
            label: discount.label || "",
            discountMethod: discount.discountMethod,
            discountValue: discount.discountValue,
            endDate: discount.endDate,
        }));

    if (lockedDiscount?.discountMethod) {
        candidates.push({
            discount: lockedDiscount.discount ?? null,
            name: lockedDiscount.name ?? "",
            label: lockedDiscount.label ?? "",
            discountMethod: lockedDiscount.discountMethod,
            discountValue: lockedDiscount.discountValue,
            endDate: null,
        });
    }

    let best = null;

    for (const candidate of candidates) {
        const amountPerDay = computeAmountOff(
            originalDailyRate,
            candidate.discountMethod,
            candidate.discountValue
        );

        if (amountPerDay > 0 && (!best || amountPerDay > best.amountPerDay)) {
            best = { ...candidate, amountPerDay };
        }
    }

    return {
        dailyRate: roundMoney(originalDailyRate - (best?.amountPerDay || 0)),
        originalDailyRate,
        discount: best,
    };
};

/* resolveVehicleRate against the discounts running now. */
const resolveVehicleRateNow = async (vehicle, options = {}) =>
    resolveVehicleRate(vehicle, await getActiveDiscounts(), options);

/*
 * Records the discount on a booking's pricing (from calculatePricing, which
 * was given resolved.dailyRate). Mutates and returns `pricing`.
 */
const applyVehicleDiscountToPricing = (pricing, resolved) => {
    if (resolved?.discount) {
        const { endDate: _endDate, ...snapshot } = resolved.discount;

        pricing.originalDailyRate = resolved.originalDailyRate;
        pricing.vehicleDiscount = snapshot;
    } else {
        pricing.originalDailyRate = null;
        pricing.vehicleDiscount = null;
    }

    return pricing;
};

/* What a vehicle card / details page shows about a running discount. */
const toPublicDiscount = (resolved) =>
    resolved?.discount
        ? {
              name: resolved.discount.name,
              label: resolved.discount.label,
              discountMethod: resolved.discount.discountMethod,
              discountValue: resolved.discount.discountValue,
              amountOff: resolved.discount.amountPerDay,
              originalDailyRate: resolved.originalDailyRate,
              discountedDailyRate: resolved.dailyRate,
              endDate: resolved.discount.endDate,
          }
        : null;

/* Adds `activeDiscount` (or null) to each vehicle for the listings. */
const attachActiveDiscounts = async (vehicles = []) => {
    const list = Array.isArray(vehicles) ? vehicles : [vehicles];

    if (list.length === 0) {
        return vehicles;
    }

    const activeDiscounts = await getActiveDiscounts();

    const withDiscounts = list.map((vehicle) => {
        const plain =
            typeof vehicle?.toObject === "function"
                ? vehicle.toObject()
                : vehicle;

        return {
            ...plain,
            activeDiscount: toPublicDiscount(
                resolveVehicleRate(plain, activeDiscounts)
            ),
        };
    });

    return Array.isArray(vehicles) ? withDiscounts : withDiscounts[0];
};

/*
|--------------------------------------------------------------------------
| Admin management
|--------------------------------------------------------------------------
*/

/*
 * The admin form sends "YYYY-MM-DD"; stored as the start of that Manila day
 * so the day reads back the same whatever the server's timezone.
 */
const toDiscountDay = (value) => {
    if (value === undefined || value === null || value === "") {
        return value;
    }

    const text = String(value);

    if (DATE_KEY_PATTERN.test(text)) {
        return businessDayStart(text);
    }

    const date = new Date(text);

    if (Number.isNaN(date.getTime())) {
        throw createError("Invalid date.", 400);
    }

    return businessDayStart(toBusinessDateKey(date));
};

const assertDiscountRules = ({
    discountMethod,
    discountValue,
    startDate,
    endDate,
}) => {
    if (!(Number(discountValue) > 0)) {
        throw createError(
            "Discount value must be greater than 0.",
            400
        );
    }

    if (
        discountMethod === DISCOUNT_METHOD.PERCENTAGE &&
        Number(discountValue) > 100
    ) {
        throw createError(
            "Percentage discount cannot exceed 100.",
            400
        );
    }

    // A one-day sale (start = end) is allowed.
    if (
        startDate &&
        endDate &&
        toBusinessDateKey(endDate) < toBusinessDateKey(startDate)
    ) {
        throw createError(
            "End date can't be before the start date.",
            400
        );
    }
};

const assertVehiclesExist = async (vehicleIds = []) => {
    const ids = [...new Set((vehicleIds || []).map(String))];

    if (ids.length === 0) {
        throw createError(
            "Select at least one vehicle for this discount.",
            400
        );
    }

    const found = await Vehicle.countDocuments({ _id: { $in: ids } });

    if (found !== ids.length) {
        throw createError(
            "One or more selected vehicles no longer exist.",
            400
        );
    }

    return ids;
};

const VEHICLE_SUMMARY_FIELDS =
    "brand model year plateNumber vehicleCode images pricing.dailyRate status";

const withDateState = (discount) => {
    const plain =
        typeof discount?.toObject === "function"
            ? discount.toObject()
            : discount;

    return {
        ...plain,
        dateState: getVoucherDateState(plain),
    };
};

const getDiscounts = async ({ status, scope } = {}) => {
    const filter = {};

    if (status && status !== "all") {
        filter.status = status;
    }

    if (scope && scope !== "all") {
        filter.scope = scope;
    }

    const discounts = await Discount.find(filter)
        .populate("vehicles", VEHICLE_SUMMARY_FIELDS)
        .populate("audit.createdBy", "firstName lastName")
        .populate("audit.updatedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean();

    return discounts.map(withDateState);
};

const getDiscountById = async (discountId) => {
    const discount = await Discount.findById(discountId)
        .populate("vehicles", VEHICLE_SUMMARY_FIELDS)
        .lean();

    if (!discount) {
        throw createError("Discount not found.", 404);
    }

    return withDateState(discount);
};

const createDiscount = async (data, currentUserId) => {
    const scope = data.scope || DISCOUNT_SCOPE.ALL_VEHICLES;
    const startDate = toDiscountDay(data.startDate);
    const endDate = toDiscountDay(data.endDate);

    assertDiscountRules({
        discountMethod: data.discountMethod,
        discountValue: data.discountValue,
        startDate,
        endDate,
    });

    const vehicles =
        scope === DISCOUNT_SCOPE.SPECIFIC_VEHICLES
            ? await assertVehiclesExist(data.vehicles)
            : [];

    const discount = await Discount.create({
        name: data.name,
        label: data.label || "",
        description: data.description || "",
        scope,
        vehicles,
        discountMethod: data.discountMethod,
        discountValue: Number(data.discountValue),
        startDate,
        endDate,
        status: data.status || DISCOUNT_STATUS.ACTIVE,
        audit: {
            createdBy: currentUserId || null,
        },
    });

    return getDiscountById(discount._id);
};

const updateDiscountById = async (discountId, data, currentUserId) => {
    const discount = await Discount.findById(discountId);

    if (!discount) {
        throw createError("Discount not found.", 404);
    }

    const startDate =
        data.startDate !== undefined
            ? toDiscountDay(data.startDate)
            : undefined;
    const endDate =
        data.endDate !== undefined ? toDiscountDay(data.endDate) : undefined;

    // Checked as the discount will be after the edit, not just the fields
    // sent (e.g. switching to "percentage" while keeping ₱500).
    assertDiscountRules({
        discountMethod: data.discountMethod ?? discount.discountMethod,
        discountValue: data.discountValue ?? discount.discountValue,
        startDate: startDate ?? discount.startDate,
        endDate: endDate ?? discount.endDate,
    });

    const scope = data.scope ?? discount.scope;

    const updates = {
        name: data.name,
        label: data.label,
        description: data.description,
        scope: data.scope,
        discountMethod: data.discountMethod,
        discountValue:
            data.discountValue !== undefined
                ? Number(data.discountValue)
                : undefined,
        startDate,
        endDate,
        status: data.status,
        "audit.updatedBy": currentUserId || null,
    };

    if (scope === DISCOUNT_SCOPE.ALL_VEHICLES) {
        updates.vehicles = [];
    } else if (data.scope !== undefined || data.vehicles !== undefined) {
        updates.vehicles = await assertVehiclesExist(
            data.vehicles ?? discount.vehicles
        );
    }

    Object.keys(updates).forEach(
        (key) => updates[key] === undefined && delete updates[key]
    );

    await Discount.updateOne(
        { _id: discountId },
        { $set: updates },
        { runValidators: true }
    );

    return getDiscountById(discountId);
};

/*
 * Bookings carry their own snapshot, so deleting never touches them. A
 * running discount must be switched off first (like vouchers), so a live
 * sale isn't removed by a stray click; ended ones can go directly.
 */
const deleteDiscountById = async (discountId) => {
    const discount = await Discount.findById(discountId).lean();

    if (!discount) {
        throw createError("Discount not found.", 404);
    }

    if (
        discount.status === DISCOUNT_STATUS.ACTIVE &&
        getVoucherDateState(discount) !== "expired"
    ) {
        throw createError(
            "Can't delete an active discount. Set it to inactive first.",
            400
        );
    }

    await Discount.deleteOne({ _id: discountId });
};

export {
    computeAmountOff,
    getActiveDiscounts,
    resolveVehicleRate,
    resolveVehicleRateNow,
    applyVehicleDiscountToPricing,
    toPublicDiscount,
    attachActiveDiscounts,
    getDiscounts,
    getDiscountById,
    createDiscount,
    updateDiscountById,
    deleteDiscountById,
};
