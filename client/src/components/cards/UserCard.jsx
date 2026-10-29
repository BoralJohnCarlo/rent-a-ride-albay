import { motion } from "framer-motion";
import {
    Ban,
    CheckCircle2,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    ShieldOff,
    User,
    UserCheck,
    UserX,
} from "lucide-react";

import Avatar from "../common/Avatar";
import CardActionMenu from "./CardActionMenu";
import useSettings from "../../hooks/settings/useSettings";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const PILL = {
    customer:
        "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
    operator:
        "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30",
    verified:
        "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
    unverified:
        "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    suspended:
        "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
    active:
        "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
};

const ROLE_META = {
    operator: {
        label: "Partner",
        pill: PILL.operator,
        hoverBorder:
            "hover:border-violet-300 dark:hover:border-violet-800",
    },
    customer: {
        label: "Customer",
        pill: PILL.customer,
        hoverBorder:
            "hover:border-sky-300 dark:hover:border-sky-800",
    },
};

const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
          });
};

const Pill = ({ icon: Icon, className, children }) => (
    <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}
    >
        {Icon && <Icon size={11} />}
        {children}
    </span>
);

const MetaCell = ({ label, value }) => (
    <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
            {value}
        </p>
    </div>
);

const UserCard = ({
    user,
    mode = "users",
    onView,
    onSuspend,
    onBlacklist,
    onUnblacklist,
    onVerify,
    onUnverify,
    onGrantRenewalAttempt,
    className = "",
}) => {
    const userId = user._id ?? user.id;
    const fullName = `${user.firstName} ${user.lastName}`;

    const { settings } = useSettings();

    const maxUploadsPerYear =
        settings?.validIdRenewalSettings
            ?.maxUploadsPerYear ?? 1;

    const renewalCount = user?.validIdRenewalCount ?? 0;
    const renewalLimitReached =
        renewalCount >= maxUploadsPerYear;

    const isBlacklisted = mode === "blacklisted";
    const isOperatorMode =
        mode === "operators" || mode === "partners";

    const roleMeta =
        ROLE_META[user.role] ?? ROLE_META.customer;

    const cardActions = [
        {
            label: "View Profile",
            icon: User,
            onClick: () => onView?.(user),
        },
    ];

    if (mode === "users") {
        cardActions.push({
            label: "Blacklist",
            icon: Ban,
            variant: "danger",
            onClick: () => onBlacklist?.(user),
        });

        if (user.isVerified) {
            cardActions.push({
                label: "Unverify ID",
                icon: ShieldOff,
                onClick: () => onUnverify?.(user),
            });
        } else {
            cardActions.push({
                label: "Verify ID",
                icon: ShieldCheck,
                onClick: () => onVerify?.(user),
            });
        }

        cardActions.push({
            label: `Grant Renewal Attempt (${renewalCount}/${maxUploadsPerYear})`,
            icon: RefreshCw,
            disabled: renewalLimitReached,
            onClick: () => onGrantRenewalAttempt?.(user),
        });
    }

    if (isOperatorMode) {
        if (user.isSuspended) {
            cardActions.push({
                label: "Activate",
                icon: UserCheck,
                variant: "success",
                onClick: () => onSuspend?.(user),
            });
        } else {
            cardActions.push({
                label: "Suspend",
                icon: UserX,
                variant: "warning",
                onClick: () => onSuspend?.(user),
            });
        }

        if (user.isVerified) {
            cardActions.push({
                label: "Unverify ID",
                icon: ShieldOff,
                onClick: () => onUnverify?.(user),
            });
        } else {
            cardActions.push({
                label: "Verify ID",
                icon: ShieldCheck,
                onClick: () => onVerify?.(user),
            });
        }
    }

    if (mode === "blacklisted") {
        cardActions.push({
            label: "Remove Blacklist",
            icon: UserCheck,
            variant: "success",
            onClick: () => onUnblacklist?.(user),
        });
    }

    return (
        <motion.article
            layout
            layoutId={`user-${userId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                layout: CARD_LAYOUT_TRANSITION,
                duration: 0.25,
                ease: "easeOut",
            }}
            onClick={() => onView?.(user)}
            className={[
                "group relative cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:bg-gray-900",
                isBlacklisted
                    ? "border-rose-200 dark:border-rose-900/50"
                    : `border-gray-200 dark:border-gray-800 ${roleMeta.hoverBorder}`,
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div
                className="absolute right-4 top-4"
                onClick={(event) => event.stopPropagation()}
            >
                <CardActionMenu actions={cardActions} />
            </div>

            {/* Header */}
            <div className="flex items-start gap-3.5 pr-10">
                <div className="relative shrink-0">
                    <Avatar
                        src={user.profileImage}
                        name={fullName}
                        size="lg"
                        rounded={false}
                        className="rounded-xl ring-1 ring-gray-200 dark:ring-gray-700"
                    />

                    {user.isVerified && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-gray-900">
                            <CheckCircle2 size={12} />
                        </span>
                    )}
                </div>

                <div className="min-w-0 pt-0.5">
                    <h3 className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
                        {fullName}
                    </h3>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                    </p>
                </div>
            </div>

            {/* Status pills */}
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                <Pill className={roleMeta.pill}>
                    {roleMeta.label}
                </Pill>

                <Pill
                    icon={
                        user.isVerified
                            ? ShieldCheck
                            : ShieldAlert
                    }
                    className={
                        user.isVerified
                            ? PILL.verified
                            : PILL.unverified
                    }
                >
                    {user.isVerified
                        ? "Verified"
                        : user.validIdExpired
                        ? "ID Expired"
                        : "Unverified"}
                </Pill>

                {isOperatorMode && (
                    <Pill
                        className={
                            user.isSuspended
                                ? PILL.suspended
                                : PILL.active
                        }
                    >
                        {user.isSuspended
                            ? "Suspended"
                            : "Active"}
                    </Pill>
                )}
            </div>

            {/* Meta grid */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                {user.phoneNumber && (
                    <MetaCell
                        label="Phone"
                        value={user.phoneNumber}
                    />
                )}

                <MetaCell
                    label="Joined"
                    value={formatDate(user.createdAt)}
                />

                {isBlacklisted && user.blacklistedAt ? (
                    <MetaCell
                        label="Blacklisted"
                        value={formatDate(user.blacklistedAt)}
                    />
                ) : (
                    mode === "users" && (
                        <MetaCell
                            label="ID Renewals"
                            value={`${renewalCount} / ${maxUploadsPerYear}`}
                        />
                    )
                )}
            </div>

            {isBlacklisted && user.blacklistReason && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/30">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                        Reason
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-rose-800 dark:text-rose-200">
                        {user.blacklistReason}
                    </p>
                </div>
            )}
        </motion.article>
    );
};

export default UserCard;
