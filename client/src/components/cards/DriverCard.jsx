import { motion } from "framer-motion";
import {
    Archive,
    Eye,
    ExternalLink,
    IdCard,
    Pencil,
    RotateCcw,
    UserCheck,
    UserX,
} from "lucide-react";

import Avatar from "../common/Avatar";
import StatusChip from "../common/StatusChip";
import CardActionMenu from "./CardActionMenu";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const formatDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
          });
};

const MetaCell = ({ label, value, tone = "" }) => (
    <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {label}
        </p>
        <p
            className={`mt-0.5 truncate text-sm font-medium ${
                tone || "text-gray-800 dark:text-gray-200"
            }`}
            title={typeof value === "string" ? value : undefined}
        >
            {value}
        </p>
    </div>
);

const DAY_SHORT = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
};

const formatSchedule = (schedule = {}) => {
    const days = (schedule.workingDays ?? [])
        .map((day) => DAY_SHORT[day] ?? day)
        .join(", ");
    const hours =
        schedule.startTime && schedule.endTime
            ? `${schedule.startTime}–${schedule.endTime}`
            : "";

    return [days, hours].filter(Boolean).join(" · ") || "Not set";
};

const DriverCard = ({
    driver,
    isArchivedView = false,
    onView,
    onEdit,
    onStatusChange,
    onArchive,
    onRestore,
}) => {
    const fullName =
        [driver.firstName, driver.lastName]
            .filter(Boolean)
            .join(" ") || "Unnamed Driver";

    const license = driver.license ?? {};
    const expiry = license.expiryDate
        ? new Date(license.expiryDate)
        : null;
    const licenseExpired =
        expiry && !Number.isNaN(expiry.getTime()) && expiry < new Date();

    const actions = [
        {
            label: "View details",
            icon: Eye,
            onClick: () => onView?.(driver),
        },
    ];

    if (isArchivedView) {
        actions.push({
            label: "Restore",
            icon: RotateCcw,
            variant: "success",
            onClick: () => onRestore?.(driver),
        });
    } else {
        actions.push(
            {
                label: "Edit",
                icon: Pencil,
                onClick: () => onEdit?.(driver),
            },
            // The public profile 404s for archived drivers.
            {
                label: "View public profile",
                icon: ExternalLink,
                href: `/drivers/${driver._id}`,
            }
        );

        if (driver.status === "Active") {
            actions.push({
                label: "Suspend",
                icon: UserX,
                variant: "danger",
                onClick: () => onStatusChange?.(driver, "Suspended"),
            });
        }

        if (driver.status === "Suspended") {
            actions.push({
                label: "Activate",
                icon: UserCheck,
                variant: "success",
                onClick: () => onStatusChange?.(driver, "Active"),
            });
        }

        actions.push({
            label: "Archive",
            icon: Archive,
            variant: "danger",
            onClick: () => onArchive?.(driver),
        });
    }

    return (
        <motion.article
            layout
            layoutId={`driver-${driver._id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                layout: CARD_LAYOUT_TRANSITION,
                duration: 0.25,
                ease: "easeOut",
            }}
            role="button"
            tabIndex={0}
            aria-label={`View details for ${fullName}`}
            onClick={() => onView?.(driver)}
            onKeyDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ")
                ) {
                    event.preventDefault();
                    onView?.(driver);
                }
            }}
            className={[
                "group relative cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900",
                isArchivedView
                    ? "border-gray-200 opacity-90 dark:border-gray-800"
                    : "border-gray-200 hover:border-blue-300 dark:border-gray-800 dark:hover:border-blue-800",
            ].join(" ")}
        >
            <div
                className="absolute right-4 top-4"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
            >
                <CardActionMenu actions={actions} />
            </div>

            {/* Header */}
            <div className="flex items-start gap-3.5 pr-10">
                <Avatar
                    src={driver.profileImage}
                    name={fullName}
                    size="lg"
                    rounded={false}
                    className="shrink-0 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700"
                />

                <div className="min-w-0 pt-0.5">
                    <h3 className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
                        {fullName}
                    </h3>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                        {driver.driverCode || "No driver code"}
                        {driver.email ? ` · ${driver.email}` : ""}
                    </p>
                </div>
            </div>

            {/* Status pills */}
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                {isArchivedView ? (
                    <StatusChip status="Archived" size="sm" />
                ) : (
                    <>
                        {driver.status && (
                            <StatusChip status={driver.status} size="sm" />
                        )}
                        {driver.availability && (
                            <StatusChip
                                status={driver.availability}
                                size="sm"
                            />
                        )}
                    </>
                )}

                {license.licenseType && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        <IdCard size={11} />
                        {license.licenseType}
                        {license.restrictionCodes?.length
                            ? ` · ${license.restrictionCodes.join(", ")}`
                            : ""}
                    </span>
                )}
            </div>

            {/* Meta grid */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <MetaCell
                    label="Phone"
                    value={driver.phoneNumber || "Not set"}
                />

                <MetaCell
                    label={
                        licenseExpired
                            ? "License expired"
                            : "License expiry"
                    }
                    value={formatDate(license.expiryDate) ?? "Not set"}
                    tone={
                        licenseExpired
                            ? "text-red-600 dark:text-red-400"
                            : ""
                    }
                />

                <div className="col-span-2">
                    {isArchivedView ? (
                        <MetaCell
                            label="Archived"
                            value={
                                [
                                    formatDate(driver.archive?.archivedAt),
                                    driver.archive?.reason,
                                ]
                                    .filter(Boolean)
                                    .join(" · ") || "—"
                            }
                        />
                    ) : (
                        <MetaCell
                            label="Schedule"
                            value={formatSchedule(driver.schedule)}
                        />
                    )}
                </div>
            </div>
        </motion.article>
    );
};

export default DriverCard;
