import { useState } from "react";
import { motion } from "framer-motion";

import {
    Archive,
    Calendar,
    CalendarClock,
    Check,
    Eye,
    ImageOff,
    Pencil,
    RotateCcw,
    Search,
    Send,
    Undo2,
    X,
} from "lucide-react";

import getConsignmentCardData from "../../utils/getConsignmentCardData";
import formatDate from "../../utils/formatDate";

import Badge from "../common/Badge";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";
import CardActionMenu from "../cards/CardActionMenu";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const ConsignmentCard = ({
    consignment,
    onSelect,
    onView,
    onEdit,
    onSubmit,
    onWithdraw,
    onReview,
    onApprove,
    onReject,
    onRequestRevision,
    onArchive,
    onRestore,
    onBookInspection,
    onReviewReschedule,
    className = "",
}) => {
    const item =
        getConsignmentCardData(
            consignment
        );

    const [imageError, setImageError] =
    useState(false);

    const status =
        item.status.toLowerCase();

    const inspectionStatus =
        consignment?.application?.inspection?.status?.toLowerCase();

    const isArchived =
        consignment?.archive?.isArchived ??
        false;

    // A Draft or a Revision-Requested application can still be edited and
    // (re)submitted by its owner.
    const isEditable =
        status === "draft" ||
        status === "revision requested";

    const canWithdraw =
        status === "pending" ||
        status ===
            "under review" ||
        status ===
            "revision requested";

const cardActions = [
    {
        label: "View",
        icon: Eye,
        onClick: () =>
            onView?.(consignment),
    },

    isEditable &&
    onEdit && {
        label: "Edit",
        icon: Pencil,
        variant: "primary",
        onClick: () =>
            onEdit?.(
                consignment
            ),
    },

    isEditable &&
        onSubmit && {
            label:
                status === "revision requested"
                    ? "Resubmit"
                    : "Submit",
            icon: Send,
            variant: "success",
            onClick: () =>
                onSubmit?.(
                    consignment
                ),
        },

    canWithdraw &&
        onWithdraw && {
            label: "Withdraw",
            icon: Undo2,
            variant: "danger",
            onClick: () =>
                onWithdraw?.(
                    consignment
                ),
        },

    status === "pending" &&
        onReview && {
            label: "Start Review",
            icon: Search,
            variant: "primary",
            onClick: () =>
                onReview?.(
                    consignment
                ),
        },

    status ===
        "under review" &&
        [
            "passed",
            "conditional pass",
        ].includes(inspectionStatus) &&
        onApprove && {
            label: "Approve",
            icon: Check,
            variant: "success",
            onClick: () =>
                onApprove?.(
                    consignment
                ),
        },

    (status === "pending" ||
        status === "under review") &&
        onReject && {
            label: "Reject",
            icon: X,
            variant: "danger",
            onClick: () =>
                onReject?.(
                    consignment
                ),
        },

    (status === "pending" ||
        status === "under review") &&
        onRequestRevision && {
            label: "Request Revision",
            icon: Undo2,
            variant: "warning",
            onClick: () =>
                onRequestRevision?.(
                    consignment
                ),
        },

    [
        "approved",
        "rejected",
        "withdrawn",
    ].includes(status) &&
        !isArchived &&
        onArchive && {
            label: "Archive",
            icon: Archive,
            variant: "secondary",
            onClick: () =>
                onArchive?.(
                    consignment
                ),
        },

isArchived &&
        onRestore && {
            label: "Restore",
            icon: RotateCcw,
            variant: "secondary",
            onClick: () =>
                onRestore?.(
                    consignment
                ),
        },

    ["pending", "under review"].includes(status) &&
        onBookInspection && {
            label: consignment?.application?.inspection
                ?.scheduledDate
                ? "Reschedule Inspection"
                : "Schedule Inspection",
            icon: Calendar,
            variant: "warning",
            onClick: () =>
                onBookInspection?.(
                    consignment
                ),
        },

    consignment?.reschedule?.status === "Pending" &&
        onReviewReschedule && {
            label: "Review Reschedule",
            icon: CalendarClock,
            variant: "warning",
            onClick: () =>
                onReviewReschedule?.(
                    consignment
                ),
        },

].filter(Boolean);

    return (
        <motion.article
            layout
            layoutId={`consignment-${item.id}`}
            onClick={() =>
                onSelect?.(
                    consignment
                )
            }
            transition={{
                layout: CARD_LAYOUT_TRANSITION,
            }}
            className={[
                "group",
                "flex",
                "h-[450px]",
                "flex-col",
                "cursor-pointer",
                "overflow-visible",
                "rounded-3xl",
                "border",
                "border-gray-200",
                "bg-white",
                "dark:border-gray-800",
                "dark:bg-gray-900",
                "shadow-md",
                "transition-all",
                "duration-300",
                "hover:-translate-y-1",
                "hover:border-gray-300",
                "dark:hover:border-gray-600",
                "hover:shadow-2xl",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <motion.div
                layoutId={`consignment-image-${item.id}`}
                className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-800"
            >
                {item.image && !imageError ? (
                    <img
                        src={item.image}
                        alt={
                            item.title
                        }
                        onError={() => setImageError(true)}
                        className="
                            h-full
                            w-full
                            object-cover
                            transition-transform
                            duration-500
                            group-hover:scale-105
                        "
                    />
                ) : (
                    <div
                        className="
                            flex
                            h-full
                            flex-col
                            items-center
                            justify-center
                            gap-1
                            bg-gray-50
                            text-gray-400
                            dark:bg-gray-800/50
                            dark:text-gray-500
                        "
                    >
                        <ImageOff
                            size={30}
                            strokeWidth={
                                1.5
                            }
                        />

                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                No
                                Image
                            </p>

                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                Upload
                                later
                            </p>
                        </div>
                    </div>
                )}

                <div className="absolute right-4 top-4 z-50">
                    <div
                        className="
                            rounded-full
                            bg-white/90
                            backdrop-blur-sm
                            shadow-md
                            transition
                            hover:bg-white
                            dark:bg-gray-800/90
                            dark:hover:bg-gray-800
                        "
                        onClick={(
                            event
                        ) =>
                            event.stopPropagation()
                        }
                    >
                        <CardActionMenu
                            actions={
                                cardActions
                            }
                        />
                    </div>
                </div>
            </motion.div>

            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
                <div>
                    <div className="min-w-0 flex-1">
                        <motion.h3
                            layoutId={`consignment-title-${item.id}`}
                            className="
                                truncate
                                text-base
                                font-bold
                                tracking-tight
                                text-gray-900
                                dark:text-white
                            "
                        >
                            {item.title}
                        </motion.h3>

                        <p
                            className="
                                mt-1
                                text-sm
                                font-medium
                                tracking-wide
                                text-gray-500
                                dark:text-gray-400
                            "
                        >
                            {item.consignmentCode}
                        </p>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusChip
                        status={
                            item.status
                        }
                    />

                    <Badge variant="info">
                        {item.vehicleType}
                    </Badge>

                    {consignment?.reschedule
                        ?.status === "Pending" && (
                        <Badge variant="warning">
                            Reschedule Pending
                        </Badge>
                    )}
                </div>

                <div className="mt-3">
                    <p
                        className="
                            truncate
                            text-sm
                            font-medium
                            text-gray-800
                            dark:text-gray-100
                        "
                    >
                        {item.applicantName}
                    </p>
                </div>

                                <div
                    className="
                        mt-3
                        flex
                        flex-wrap
                        gap-x-4
                        gap-y-1
                        text-sm
                        text-gray-600
                        dark:text-gray-300
                    "
                >
                    <span>
                        {item.transmission}
                    </span>

                    <span>
                        {item.fuelType}
                    </span>
                </div>

                <motion.div
                    layoutId={`consignment-price-${item.id}`}
                    className="mt-auto flex items-end justify-between gap-3 pt-3"
                >
                    <div
                        className="
                            inline-flex
                            items-end
                            gap-1
                            rounded-full
                            border
                            border-green-200
                            bg-green-100/70
                            px-5
                            py-2
                            shadow-sm
                            dark:border-green-900/50
                            dark:bg-green-900/30
                        "
                    >
                        <Price
                            value={
                                (Number(item.dailyRate) || 0) +
                                (Number(item.reservationFee) || 0)
                            }
                            className="
                                text-2xl
                                font-black
                                tracking-tight
                                text-green-800
                                dark:text-green-300
                            "
                        />

                        <span
                            className="
                                mb-1
                                text-xs
                                font-semibold
                                uppercase
                                tracking-wide
                                text-green-700
                                dark:text-green-400
                            "
                        >
                            /day
                        </span>
                    </div>

                    <div
                        className="
                            text-right
                            text-xs
                            leading-5
                            text-gray-400
                            dark:text-gray-500
                        "
                    >
                        <p>
                            Submitted
                        </p>

                        <p>
                            {item.submittedAt
                                ? formatDate(
                                      item.submittedAt
                                  )
                                : "Draft"}
                        </p>
                    </div>
                </motion.div>
            </div>
        </motion.article>
    );
};

export default ConsignmentCard;
