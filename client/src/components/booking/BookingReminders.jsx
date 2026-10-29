import {
    Ban,
    CalendarClock,
    Car,
    Clock,
    CreditCard,
    FileText,
    Fuel,
    IdCard,
    Info,
    ShieldAlert,
    ShieldCheck,
    Timer,
    WalletCards,
} from "lucide-react";

import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";

import { describeEarlyReturnPolicy } from "../../utils/earlyReturnPolicy";
import { describeCancellationPolicy } from "../../utils/cancellationPolicy";
import {
    CANCELLATION_POLICY_LOADING_TEXT,
    DEPOSIT_RULES,
    FUEL_RULES,
    INSPECTION_RULE,
    LICENSE_RULES,
    MOTORCYCLE_AREA_RULE,
    VEHICLE_USE_RULES,
    describeCancellationProcess,
    describeExtensions,
    describeLateReturn,
    describeLateReturnEffects,
    describeNoShowTiming,
    describePayment,
    describePickupTimeRules,
    describeRentalPeriodRules,
    describeRescheduling,
    describeTurnaroundBuffer,
    hoursLabel,
} from "../../utils/bookingPolicyText";
import { BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS } from "../../constants/bookingStatus";
import { VEHICLE_TYPES } from "../../constants/vehicleConstants";

const pesos = (amount) =>
    `₱${Number(amount).toLocaleString("en-PH")}`;

const ReminderGroup = ({ icon: Icon, title, tone, dot, items }) => (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:border-gray-200 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-gray-700">
        <div className="flex items-center gap-3">
            <span
                className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    tone,
                ].join(" ")}
            >
                <Icon size={17} />
            </span>

            <h4 className="flex-1 text-sm font-bold text-gray-900 dark:text-white">
                {title}
            </h4>

            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {items.length}
            </span>
        </div>

        <ul className="mt-3 space-y-2 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
            {items.map((item) => (
                <li
                    key={item}
                    className="flex gap-2.5 text-[13px] leading-5 text-gray-600 dark:text-gray-300"
                >
                    <span
                        className={[
                            "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
                            dot,
                        ].join(" ")}
                    />
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    </section>
);

/* Vehicle-specific when the listing has a deposit, generic otherwise. */
const getDepositItems = (vehicle) => {
    const deposit = vehicle?.securityDeposit;
    const amount = Number(deposit?.amount);

    if (vehicle && !(deposit?.enabled && amount > 0)) {
        return null;
    }

    return [
        vehicle
            ? `This vehicle requires a ${pesos(amount)} security deposit, collected at pickup.`
            : "Some vehicles require a security deposit, collected at pickup. The amount is shown on the vehicle listing.",
        ...DEPOSIT_RULES,
    ];
};

const getQuickFacts = (paymentWindowHours) => [
    { icon: IdCard, label: "License & ID" },
    { icon: Timer, label: `Pay within ${paymentWindowHours}h` },
    { icon: Fuel, label: "Same fuel level" },
];

/*
 * Side card on the booking form listing what a customer should know before
 * they book: payment, license, refunds, penalties, fuel, deposit, changes and
 * pickup/return basics. Pass `vehicle` to show its own security deposit.
 */
const BookingReminders = ({ className = "", vehicle = null }) => {
    const {
        policy,
        latePenalty,
        noShowGraceHours,
        noShowPolicy,
        requireCancellationReason,
        refundRequestWindowHours,
        turnaroundBufferMinutes,
        bookingHours,
        pickupHours,
        earlyReturn,
    } = usePublicRefundSettings();

    const isMotorcycle =
        vehicle?.vehicleType === VEHICLE_TYPES.MOTORCYCLE;

    const depositItems = getDepositItems(vehicle);

    const vehicleName = [vehicle?.brand, vehicle?.model]
        .filter(Boolean)
        .join(" ");

    const vehicleImage =
        vehicle?.images?.find((image) => image?.isPrimary)?.url ??
        vehicle?.images?.[0]?.url ??
        null;

    const paymentItems = describePayment().filter(
        (item) =>
            item !==
                `Pay the reservation fee online (GCash or QRPh, through PayMongo) within ${hoursLabel(BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS)} of booking, or before your pickup time if that's sooner, or the reservation is released automatically.` &&
            item !==
                "Your booking is confirmed only once an admin approves it. Partner vehicles can take a little longer while we check with the owner."
    );

    const groups = [
        {
            icon: CreditCard,
            title: "Booking & Payment",
            tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
            dot: "bg-sky-500",
            items: paymentItems,
        },
        {
            icon: Clock,
            title: "Pickup Time & Rental Period",
            tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
            dot: "bg-violet-500",
            items: [
                ...describePickupTimeRules(bookingHours, pickupHours),
                describeTurnaroundBuffer(turnaroundBufferMinutes),
                ...describeRentalPeriodRules(),
                INSPECTION_RULE,
            ],
        },
        {
            icon: IdCard,
            title: "License & ID",
            tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
            dot: "bg-blue-500",
            items: LICENSE_RULES,
        },
        {
            icon: Fuel,
            title: "Fuel Level",
            tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
            dot: "bg-amber-500",
            items: FUEL_RULES,
        },
        {
            icon: WalletCards,
            title: "Cancellation & Refunds",
            tone: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
            dot: "bg-green-500",
            items: [
                ...(policy
                    ? describeCancellationPolicy(policy, noShowPolicy)
                    : [CANCELLATION_POLICY_LOADING_TEXT]),
                describeNoShowTiming(
                    noShowGraceHours,
                    noShowPolicy?.autoMark
                ),
                ...describeCancellationProcess({
                    requireCancellationReason,
                    refundRequestWindowHours,
                }),
            ],
        },
        {
            icon: CalendarClock,
            title: "Rescheduling",
            tone: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
            dot: "bg-teal-500",
            items: describeRescheduling(),
        },
        ...(depositItems
            ? [
                  {
                      icon: ShieldCheck,
                      title: "Security Deposit",
                      tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                      dot: "bg-indigo-500",
                      items: depositItems,
                  },
              ]
            : []),
        {
            icon: ShieldAlert,
            title: "Late Return & Extensions",
            tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
            dot: "bg-red-500",
            items: [
                describeLateReturn(latePenalty),
                ...describeExtensions(),
                ...describeLateReturnEffects(),
                ...describeEarlyReturnPolicy(earlyReturn),
            ],
        },
        {
            icon: Ban,
            title: "Vehicle Use & Charges",
            tone: "bg-gray-200 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300",
            dot: "bg-gray-500",
            items: [
                ...VEHICLE_USE_RULES,
                ...(isMotorcycle || !vehicle
                    ? [MOTORCYCLE_AREA_RULE]
                    : []),
            ],
        },
    ];

    const quickFacts = getQuickFacts(
        BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS
    );

    return (
        <aside
            className={[
                "flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm dark:border-gray-800 dark:bg-gray-950",
                className,
            ].join(" ")}
        >
            <header className="shrink-0">
                {/* Photo banner: the car being booked, darkened toward the
                    bottom so the title stays readable on any photo. */}
                <div className="relative h-52 overflow-hidden border-b border-gray-200 bg-gray-900 dark:border-gray-800">
                    {vehicleImage ? (
                        <img
                            src={vehicleImage}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/15">
                            <Car size={72} />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/55 to-gray-950/5" />

                    <div className="absolute inset-x-0 bottom-0 space-y-3 p-4">
                    <div className="flex items-end gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-gray-950 shadow-lg shadow-black/30">
                            <Info size={18} />
                        </span>

                        <div className="min-w-0">
                            <h3 className="text-lg font-bold leading-tight tracking-tight text-white">
                                Important Reminders
                            </h3>
                            <p className="truncate text-xs font-medium text-white/75">
                                {vehicleName
                                    ? `${vehicleName} · before you book`
                                    : "Before you book"}
                            </p>
                        </div>
                    </div>

                    {/* Glass pills sitting on the photo itself. */}
                    <ul className="flex flex-nowrap items-center gap-1.5">
                        {quickFacts.map(({ icon: Icon, label }) => (
                            <li
                                key={label}
                                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-white/20 bg-white/15 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md"
                            >
                                <Icon
                                    size={12}
                                    className="shrink-0 text-yellow-300"
                                />
                                <span className="truncate">{label}</span>
                            </li>
                        ))}
                    </ul>
                    </div>
                </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 [scrollbar-color:rgb(209_213_219)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:rgb(55_65_81)_transparent]">
                {groups.map((group) => (
                    <ReminderGroup
                        key={group.title}
                        {...group}
                    />
                ))}

                <p className="flex items-start gap-2 px-1 pb-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                    <FileText
                        size={14}
                        className="mt-0.5 shrink-0"
                    />
                    Full details are in the Terms &amp; Conditions you accept before submitting your booking.
                </p>
            </div>
        </aside>
    );
};

export default BookingReminders;
