import createError from "../utils/createError.js";

import mongoose from "mongoose";

import User from "../models/User.js";
import Voucher from "../models/Voucher.js";

import {
    VOUCHER_TYPE,
    VOUCHER_DISCOUNT_METHOD,
    VOUCHER_STATUS,
    VOUCHER_ASSIGNMENT_TYPE,
    VOUCHER_CODE_LENGTH,
} from "../constants/voucherConstants.js";

import { notifyUsers } from "./notificationService.js";
import { toBusinessDateKey } from "../utils/businessTime.js";

/*
 * A voucher's start/end are calendar days in Philippine time: valid from the
 * start of its start day through the end of its end day. Compared as Manila
 * date keys so the result doesn't depend on the server's own timezone, and so
 * the customer's "available vouchers" list and checkout validation agree.
 */
const getVoucherDateState = (voucher, now = new Date()) => {
    const todayKey = toBusinessDateKey(now);

    if (
        voucher.startDate &&
        todayKey < toBusinessDateKey(voucher.startDate)
    ) {
        return "upcoming";
    }

    if (
        voucher.endDate &&
        todayKey > toBusinessDateKey(voucher.endDate)
    ) {
        return "expired";
    }

    return "current";
};

const assertDiscountWithinLimit = (discountMethod, discountValue) => {
    if (
        discountMethod === VOUCHER_DISCOUNT_METHOD.PERCENTAGE &&
        Number(discountValue) > 100
    ) {
        throw createError(
            "Percentage discount cannot exceed 100.",
            400
        );
    }
};

const assertDateOrder = (startDate, endDate) => {
    if (
        startDate &&
        endDate &&
        new Date(startDate) >= new Date(endDate)
    ) {
        throw createError(
            "End date must be after start date.",
            400
        );
    }
};

/*
 * Specific-user vouchers are for customers only: the picker used to list
 * every account (admins and partners included), and a voucher assigned to
 * one of those could never be redeemed.
 */
const assertCustomerRecipients = async (assignedTo = []) => {
    const ids = [...new Set((assignedTo || []).map(String))];

    if (ids.length === 0) {
        throw createError(
            "Please select at least one customer for specific user assignment.",
            400
        );
    }

    const customerCount = await User.countDocuments({
        _id: { $in: ids },
        role: "customer",
    });

    if (customerCount !== ids.length) {
        throw createError(
            "Vouchers can only be assigned to customer accounts.",
            400
        );
    }

    return ids;
};

/*
 * Best-effort notice to customers a voucher has been assigned to.
 * A failure here must never fail voucher creation/update.
 */
const notifyVoucherRecipients = async (voucher, recipientIds) => {
    const ids = (recipientIds || []).filter(Boolean).map(String);

    if (ids.length === 0) {
        return;
    }

    try {
        await notifyUsers(ids, {
            type: "promo",
            title: "You Received a Voucher",
            message: `You've been given the voucher "${voucher.name}" (code ${voucher.code}). Apply it at checkout on your next booking.`,
            variant: "success",
            category: "Promo",
            metadata: {
                reference: voucher.code,
                relatedId: voucher._id,
                relatedModel: "Voucher",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify voucher recipients:",
            notificationError
        );
    }
};

const clamp = (value) =>
    Math.max(
        0,
        Math.round(
            value * 100
        ) / 100
    );

const generateVoucherCode = () => {
    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (
        let i = 0;
        i < VOUCHER_CODE_LENGTH;
        i++
    ) {
        const randomIndex =
            Math.floor(
                Math.random() * characters.length
            );

        code +=
            characters.charAt(
                randomIndex
            );
    }

    return code;
};

const generateUniqueVoucherCode =
    async () => {
        let code = generateVoucherCode();

        let existing =
            await Voucher.findOne({
                code,
            });

        while (existing) {
            code =
                generateVoucherCode();

            existing =
                await Voucher.findOne({
                    code,
                });
        }

        return code;
    };

const buildVoucherFilters = (
    queryParams
) => {
    const filters = {};

    if (queryParams.status) {
        filters.status =
            queryParams.status;
    }

    if (
        queryParams.type
    ) {
        filters.type =
            queryParams.type;
    }

    if (
        queryParams.discountMethod
    ) {
        filters.discountMethod =
            queryParams.discountMethod;
    }

    if (
        queryParams.search
    ) {
        filters.$or = [
            {
                code: {
                    $regex:
                        queryParams.search,
                    $options:
                        "i",
                },
            },
            {
                name: {
                    $regex:
                        queryParams.search,
                    $options:
                        "i",
                },
            },
        ];
    }

    return filters;
};
const DAY_MS = 24 * 60 * 60 * 1000;

const getActiveVouchersForUser = async (userId) => {
    const now = new Date();

    // A day of slack either side for the query; the exact Manila-day check
    // (same as checkout validation) is applied below.
    const candidates = await Voucher.find({
        status: VOUCHER_STATUS.ACTIVE,
        startDate: { $lte: new Date(now.getTime() + DAY_MS) },
        endDate: { $gte: new Date(now.getTime() - DAY_MS) },
        $or: [
            {
                assignmentType:
                    VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS,
            },
            {
                assignedTo: userId,
            },
        ],
    }).sort({
        createdAt: -1,
    });

    return candidates.filter(
        (voucher) => getVoucherDateState(voucher, now) === "current"
    );
};

const getPublicVoucherById =
    async (voucherId) => {
        const voucher =
            await Voucher.findById(
                voucherId
            ).select(
                "code name description type discountMethod discountValue startDate endDate"
            );

        if (!voucher) {
            throw createError(
                "Voucher not found.",
                404
            );
        }

        if (
            voucher.status !==
            VOUCHER_STATUS.ACTIVE
        ) {
            throw createError(
                "This voucher is not active.",
                400
            );
        }

        return voucher;
    };

const validateVoucherForUser =
    async (
        voucherCodeOrId,
        userId
    ) => {
        const normalizedCode =
            (voucherCodeOrId || "")
                .toUpperCase()
                .trim();

        const queryConditions = [
            {
                code: normalizedCode,
            },
        ];

        if (
            mongoose.Types.ObjectId.isValid(
                normalizedCode
            )
        ) {
            queryConditions.push({
                _id: normalizedCode,
            });
        }

        const voucher =
            await Voucher.findOne({
                $or: queryConditions,
            });

        if (!voucher) {
            throw createError(
                "Voucher code is invalid.",
                400
            );
        }

        if (
            voucher.status ===
            VOUCHER_STATUS.INACTIVE
        ) {
            throw createError(
                "This voucher is not active.",
                400
            );
        }

        const dateState =
            getVoucherDateState(voucher);

        if (dateState === "upcoming") {
            throw createError(
                "This voucher is not yet valid.",
                400
            );
        }

        if (dateState === "expired") {
            throw createError(
                "This voucher has expired.",
                400
            );
        }

        const isAssignedToAll =
            voucher.assignmentType ===
            VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS;

        const isAssignedToUser =
            voucher.assignedTo?.some(
                (assignedId) =>
                    assignedId.toString() ===
                    userId.toString()
            );

        if (
            !isAssignedToAll &&
            !isAssignedToUser
        ) {
            throw createError(
                "Voucher is not available to you.",
                400
            );
        }

        const userUsageCount =
            voucher.usedBy?.filter(
                (entry) =>
                    entry.user?.toString() ===
                    userId.toString()
            ).length || 0;

        if (
            userUsageCount >=
            voucher.maxUsagesPerUser
        ) {
            throw createError(
                "You have already used this voucher.",
                400
            );
        }

        return voucher;
    };

const applyVoucherDiscount = (
    voucher,
    pricing
) => {
    const {
        type,
        discountMethod,
        discountValue,
    } =
        voucher;

    const discount = {};

    if (
        type ===
        VOUCHER_TYPE.VEHICLE_PRICE
    ) {
        if (
            discountMethod ===
            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
        ) {
            const originalDailyRate =
                pricing.dailyRate || 0;

            const discountAmount =
                clamp(
                    originalDailyRate *
                        (discountValue /
                            100)
                );

            discount.discountedDailyRate =
                clamp(
                    originalDailyRate -
                        discountAmount
                );

            discount.dailyRateReduction =
                discountAmount;
        } else {
            const discountAmount =
                clamp(discountValue);

            discount.discountedDailyRate =
                clamp(
                    (pricing.dailyRate || 0) -
                        discountAmount
                );

            discount.dailyRateReduction =
                discountAmount;
        }

        const rentalDays =
            pricing.rentalDays || 1;

        discount.newSubtotal =
            clamp(
                discount.discountedDailyRate *
                    rentalDays
            );

        discount.subtotalDiscount =
            clamp(
                pricing.subtotal -
                    discount.newSubtotal
            );
    }

    if (
        type ===
        VOUCHER_TYPE.RESERVATION_FEE
    ) {
        if (
            discountMethod ===
            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
        ) {
            const originalReservationFee =
                pricing.reservationFee ||
                0;

            const discountAmount =
                clamp(
                    originalReservationFee *
                        (discountValue /
                            100)
                );

            discount.discountedReservationFee =
                clamp(
                    originalReservationFee -
                        discountAmount
                );

            discount.reservationFeeDiscount =
                discountAmount;
        } else {
            const discountAmount =
                clamp(discountValue);

            const originalFee =
                pricing.reservationFee ||
                0;

            discount.discountedReservationFee =
                clamp(
                    originalFee -
                        discountAmount
                );

            discount.reservationFeeDiscount =
                clamp(
                    Math.min(
                        discountAmount,
                        originalFee
                    )
                );
        }
    }

    if (
        type ===
        VOUCHER_TYPE.PICKUP_FEE
    ) {
        if (
            discountMethod ===
            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
        ) {
            const originalPickupFee =
                pricing.pickupDistanceFee || 0;

            const discountAmount =
                clamp(
                    originalPickupFee *
                        (discountValue /
                            100)
                );

            discount.discountedPickupDistanceFee =
                clamp(
                    originalPickupFee -
                        discountAmount
                );

            discount.pickupFeeDiscount =
                discountAmount;
        } else {
            const discountAmount =
                clamp(discountValue);

            const originalFee =
                pricing.pickupDistanceFee ||
                0;

            discount.discountedPickupDistanceFee =
                clamp(
                    originalFee -
                        discountAmount
                );

            discount.pickupFeeDiscount =
                clamp(
                    Math.min(
                        discountAmount,
                        originalFee
                    )
                );
        }
    }

    if (
        type ===
        VOUCHER_TYPE.TOTAL
    ) {
        // A whole-booking voucher covers the driver's fee too.
        const baseTotal =
            (pricing.subtotal || 0) +
            (pricing.reservationFee || 0) +
            (pricing.pickupDistanceFee || 0) +
            (pricing.returnDistanceFee || 0) +
            (pricing.driverFee || 0);

        if (
            discountMethod ===
            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
        ) {
            discount.totalDiscount =
                clamp(
                    Math.min(
                        baseTotal *
                            (discountValue /
                                100),
                        baseTotal
                    )
                );

            discount.newTotalAmount =
                clamp(
                    baseTotal -
                        discount.totalDiscount
                );
        } else {
            const discountAmount =
                clamp(discountValue);

            discount.totalDiscount =
                clamp(
                    Math.min(
                        discountAmount,
                        baseTotal
                    )
                );

            discount.newTotalAmount =
                clamp(
                    baseTotal -
                        discount.totalDiscount
                );
        }
    }

    return discount;
};

const calculatePricingWithVoucher = (
    pricing,
    voucher,
    userId
) => {
    const validatedVoucher =
        voucher;

    const voucherDiscount =
        applyVoucherDiscount(
            validatedVoucher,
            pricing
        );

    const updatedPricing = {
        ...pricing,
        ...voucherDiscount,
    };

    if (
        voucherDiscount.newTotalAmount ===
        undefined
    ) {
        const effectiveSubtotal =
            voucherDiscount.newSubtotal !==
            undefined
                ? voucherDiscount.newSubtotal
                : updatedPricing.subtotal ||
                  pricing.subtotal;

        const effectiveReservationFee =
            voucherDiscount.discountedReservationFee !==
            undefined
                ? voucherDiscount.discountedReservationFee
                : updatedPricing.reservationFee ??
                  pricing.reservationFee;

        const effectivePickupFee =
            voucherDiscount.discountedPickupDistanceFee !==
            undefined
                ? voucherDiscount.discountedPickupDistanceFee
                : updatedPricing.pickupDistanceFee ??
                  pricing.pickupDistanceFee;

        const effectiveReturnFee =
            updatedPricing.returnDistanceFee ??
            pricing.returnDistanceFee;

        // The driver fee is never discounted by a vehicle-rate, reservation
        // or pickup voucher, but it is still part of the total.
        const baseTotal =
            effectiveSubtotal +
            effectiveReservationFee +
            effectivePickupFee +
            effectiveReturnFee +
            (Number(pricing.driverFee) || 0);

        updatedPricing.totalAmount =
            clamp(baseTotal);
    } else {
        updatedPricing.totalAmount =
            voucherDiscount.newTotalAmount;
    }

    updatedPricing.voucher = {
        voucher:
            validatedVoucher._id,
        code:
            validatedVoucher.code,
        name:
            validatedVoucher.name,
        type:
            validatedVoucher.type,
        discountMethod:
            validatedVoucher.discountMethod,
        discountValue:
            validatedVoucher.discountValue,
        discount:
            voucherDiscount,
    };

    return updatedPricing;
};

const createVoucher = async (
    voucherData,
    currentUserId
) => {
    const {
        name,
        description,
        type,
        discountMethod,
        discountValue,
        startDate,
        endDate,
        maxUsagesPerUser,
        assignmentType,
        assignedTo,
        status,
        source,
        relatedRental,
    } =
        voucherData;

    assertDateOrder(startDate, endDate);
    assertDiscountWithinLimit(discountMethod, discountValue);

    // System-issued credits (source set by the caller) are already scoped
    // to their customer; check the admin's hand-picked recipients.
    const recipients =
        assignmentType ===
        VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS
            ? source
                ? assignedTo
                : await assertCustomerRecipients(assignedTo)
            : [];

    const code =
        await generateUniqueVoucherCode();

    const voucher =
        await Voucher.create({
            code,
            name,
            description,
            type,
            discountMethod,
            discountValue,
            startDate,
            endDate,
            maxUsagesPerUser,
            assignmentType,
            assignedTo: recipients,
            // The form's Status was silently dropped, so a voucher saved as
            // "Inactive" went live immediately.
            ...(status ? { status } : {}),
            source: source || "manual",
            relatedRental: relatedRental || null,
            audit: {
                createdBy:
                    currentUserId ||
                    null,
            },
        });

    if (
        voucher.assignmentType ===
            VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS &&
        Array.isArray(voucher.assignedTo)
    ) {
        await notifyVoucherRecipients(voucher, voucher.assignedTo);
    }

    return (
        await voucher.populate(
            "audit.createdBy",
            "firstName lastName email"
        )
    );
};

const getVouchers = async (
    filters = {},
    currentUserId = null
) => {
    let query = Voucher.find();

    if (
        filters.status &&
        filters.status !== "all"
    ) {
        query = query.where({
            status: filters.status,
        });
    }

    if (filters.type) {
        query = query.where({
            type: filters.type,
        });
    }

    if (filters.search) {
        const escapedSearch =
            filters.search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const searchRegex =
            new RegExp(
                escapedSearch,
                "i"
            );

        query = query.where({
            $or: [
                {
                    code: {
                        $regex:
                            searchRegex,
                    },
                },
                {
                    name: {
                        $regex:
                            searchRegex,
                    },
                },
            ],
        });
    }

    return (
        await query
            .populate(
                "assignedTo",
                "firstName lastName email"
            )
            .populate(
                "audit.createdBy",
                "firstName lastName email"
            )
            .populate(
                "audit.updatedBy",
                "firstName lastName email"
            )
            .sort({
                createdAt: -1,
            })
    );
};

const getVoucherById =
    async (voucherId) => {
        const voucher =
            await Voucher.findById(
                voucherId
            ).populate(
                "assignedTo",
                "firstName lastName email"
            ).populate(
                "usedBy.user",
                "firstName lastName email"
            ).populate(
                "audit.createdBy",
                "firstName lastName email"
            ).populate(
                "audit.updatedBy",
                "firstName lastName email"
            );

        if (!voucher) {
            throw createError(
                "Voucher not found.",
                404
            );
        }

        return voucher;
    };

const updateVoucherById = async (
    voucherId,
    updateData,
    currentUserId
) => {
    const voucher =
        await Voucher.findById(
            voucherId
        );

    if (!voucher) {
        throw createError(
            "Voucher not found.",
            404
        );
    }

    const {
        name,
        description,
        type,
        discountMethod,
        discountValue,
        startDate,
        endDate,
        maxUsagesPerUser,
        assignmentType,
        assignedTo,
        status,
    } =
        updateData;

    /*
     * Auto-issued vouchers (early-return credit) were decided by the
     * approval that created them; the admin UI hides Edit for them, and the
     * API now agrees. Only switching them on/off is allowed.
     */
    if (voucher.source && voucher.source !== "manual") {
        const touchesOtherFields = [
            name,
            description,
            type,
            discountMethod,
            discountValue,
            startDate,
            endDate,
            maxUsagesPerUser,
            assignmentType,
            assignedTo,
        ].some((value) => value !== undefined);

        if (touchesOtherFields) {
            throw createError(
                "Auto-issued vouchers can't be edited. You can only change their status.",
                400
            );
        }
    }

    // Validate the voucher as it will be after the edit, not just the
    // fields sent (e.g. switching to "percentage" while keeping ₱500).
    assertDateOrder(
        startDate ?? voucher.startDate,
        endDate ?? voucher.endDate
    );
    assertDiscountWithinLimit(
        discountMethod ?? voucher.discountMethod,
        discountValue ?? voucher.discountValue
    );

    const effectiveAssignmentType =
        assignmentType ?? voucher.assignmentType;

    let checkedRecipients;

    if (
        effectiveAssignmentType ===
            VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS &&
        (assignmentType !== undefined || assignedTo !== undefined)
    ) {
        checkedRecipients = await assertCustomerRecipients(
            assignedTo ?? voucher.assignedTo
        );
    }

    const updates = {
        name,
        description,
        type,
        discountMethod,
        discountValue,
        startDate,
        endDate,
        maxUsagesPerUser,
        assignmentType,
        status,
        "audit.updatedBy":
            currentUserId ||
            null,
    };

    if (checkedRecipients) {
        updates.assignedTo = checkedRecipients;
    } else if (
        assignmentType ===
        VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS
    ) {
        updates.assignedTo = [];
    }

    Object.keys(
        updates
    ).forEach(
        (key) =>
            updates[key] ===
            undefined &&
            delete updates[key]
    );

    if (
        startDate &&
        voucher.startDate &&
        new Date(
            startDate
        ).getTime() !==
            new Date(
                voucher.startDate
            ).getTime()
    ) {
        const isBeforeStart =
            new Date() <
            new Date(startDate);

        if (isBeforeStart) {
            updates.usageCount = 0;
        }
    }

    const previousRecipientIds = new Set(
        (voucher.assignedTo || []).map((id) => String(id))
    );

    const updatedVoucher = await Voucher.findByIdAndUpdate(
        voucherId,
        {
            $set: updates,
        },
        {
            new: true,
            runValidators: true,
        }
    ).populate(
        "assignedTo",
        "firstName lastName email"
    ).populate(
        "usedBy.user",
        "firstName lastName email"
    ).populate(
        "audit.createdBy",
        "firstName lastName email"
    ).populate(
        "audit.updatedBy",
        "firstName lastName email"
    );

    if (
        updatedVoucher?.assignmentType ===
        VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS
    ) {
        const newlyAdded = (updatedVoucher.assignedTo || [])
            .map((entry) => String(entry?._id || entry))
            .filter((id) => !previousRecipientIds.has(id));

        await notifyVoucherRecipients(updatedVoucher, newlyAdded);
    }

    return updatedVoucher;
};

const deleteVoucherById = async (
    voucherId
) => {
    const voucher =
        await Voucher.findById(
            voucherId
        );

    if (!voucher) {
        throw createError(
            "Voucher not found.",
            404
        );
    }

    if (
        voucher.status ===
        VOUCHER_STATUS.ACTIVE
    ) {
        throw createError(
            "Cannot delete an active voucher. Set it to inactive first.",
            400
        );
    }

    await Voucher.findByIdAndDelete(
        voucherId
    );
};

const getAvailableVouchers = async (
    userId
) => {
    return (
        await getActiveVouchersForUser(
            userId
        )
    );
};

const getVoucherByCode =
    async (code) => {
        const normalizedCode =
            (code || "")
                .toUpperCase()
                .trim();

        const voucher =
            await Voucher.findOne({
                code:
                    normalizedCode,
            }).populate(
                "assignedTo",
                "firstName lastName email"
            );

        if (!voucher) {
            throw createError(
                "Voucher not found.",
                404
            );
        }

        return voucher;
    };

const recordVoucherUsage =
    async (
        voucherId,
        userId,
        bookingId
    ) => {
        await Voucher.findByIdAndUpdate(
            voucherId,
            {
                $inc: {
                    usageCount: 1,
                },
                $push: {
                    usedBy: {
                        user: userId,
                        booking:
                            bookingId,
                        usedAt:
                            new Date(),
                    },
                },
            },
            {
                new: true,
            }
        );
    };

/*
 * Records a customer's use of a voucher only if they still have a use left,
 * in one conditional write. validateVoucherForUser checks the same limit, but
 * two bookings submitted together both pass that check — and a single-use
 * voucher (e.g. early-return credit) would be spent twice. Returns whether the
 * use was claimed; the caller gives it back with releaseVoucherUsage if the
 * booking then isn't created.
 */
const claimVoucherUsage =
    async (
        voucherId,
        userId,
        bookingId,
        session = null
    ) => {
        const userObjectId =
            new mongoose.Types.ObjectId(
                String(userId)
            );

        const claimed =
            await Voucher.findOneAndUpdate(
                {
                    _id: voucherId,
                    $expr: {
                        $lt: [
                            {
                                $size: {
                                    $filter: {
                                        input: {
                                            $ifNull: [
                                                "$usedBy",
                                                [],
                                            ],
                                        },
                                        cond: {
                                            $eq: [
                                                "$$this.user",
                                                userObjectId,
                                            ],
                                        },
                                    },
                                },
                            },
                            {
                                $ifNull: [
                                    "$maxUsagesPerUser",
                                    1,
                                ],
                            },
                        ],
                    },
                },
                {
                    $inc: {
                        usageCount: 1,
                    },
                    $push: {
                        usedBy: {
                            user: userObjectId,
                            booking:
                                bookingId,
                            usedAt:
                                new Date(),
                        },
                    },
                },
                {
                    new: true,
                    session,
                }
            );

        return Boolean(claimed);
    };

/*
 * Gives a voucher back when the booking it was applied to never reached
 * pickup (rejected, cancelled, expired) — the discount was never redeemed, so
 * the customer shouldn't lose it. That matters most for the single-use
 * vouchers issued as early-return credit, which are the customer's own
 * earned balance.
 *
 * Keyed on the booking so it is idempotent: only a voucher that still has a
 * usage entry for this booking is touched, so calling it twice (or for a
 * booking that never used a voucher) does nothing. Returns whether a usage
 * was actually released.
 */
const releaseVoucherUsage =
    async (
        voucherId,
        bookingId
    ) => {
        if (!voucherId || !bookingId) {
            return false;
        }

        const released =
            await Voucher.findOneAndUpdate(
                {
                    _id: voucherId,
                    "usedBy.booking":
                        bookingId,
                },
                {
                    $pull: {
                        usedBy: {
                            booking:
                                bookingId,
                        },
                    },
                    $inc: {
                        usageCount: -1,
                    },
                },
                {
                    new: true,
                }
            );

        if (!released) {
            return false;
        }

        // usageCount can drift below the number of entries (an admin reset
        // zeroes it) — never let a release push it negative.
        if (released.usageCount < 0) {
            await Voucher.updateOne(
                {
                    _id: released._id,
                    usageCount: {
                        $lt: 0,
                    },
                },
                {
                    $set: {
                        usageCount: 0,
                    },
                }
            );
        }

        return true;
    };

export {
    getVoucherDateState,
    generateUniqueVoucherCode,
    buildVoucherFilters,
    getActiveVouchersForUser,
    getPublicVoucherById,
    validateVoucherForUser,
    applyVoucherDiscount,
    calculatePricingWithVoucher,
    createVoucher,
    getVouchers,
    getVoucherById,
    updateVoucherById,
    deleteVoucherById,
    getAvailableVouchers,
    getVoucherByCode,
    recordVoucherUsage,
    claimVoucherUsage,
    releaseVoucherUsage,
};
