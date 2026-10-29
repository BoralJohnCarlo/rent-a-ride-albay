import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useSearchParams } from "react-router-dom";

import { motion } from "framer-motion";
import { Ban, Handshake, RefreshCw, UsersRound } from "lucide-react";

import { ACTIVE_PILL_SPRING } from "../../../constants/animations";

import Alert from "../../../components/common/Alert";
import Avatar from "../../../components/common/Avatar";
import Button from "../../../components/common/Button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import Modal from "../../../components/common/Modal";
import ReviewField from "../../../components/common/ReviewField";
import ReviewSection from "../../../components/common/ReviewSection";

import SearchBar from "../../../components/common/SearchBar";
import UserCardGrid from "../../../components/cards/UserCardGrid";

import ValidIdHistory from "./ValidIdHistory";
import VerifyValidIdDialog from "../../../components/admin/VerifyValidIdDialog";
import AcceptedTerms from "../../../components/legal/AcceptedTerms";

import useToast from "../../../hooks/toast";
import useUser from "../../../hooks/users";
import useSettings from "../../../hooks/settings/useSettings";

const TABS = Object.freeze({
    USERS: "users",
    OPERATORS: "partners",
    BLACKLISTED: "blacklisted",
});

const BLACKLIST_PRESET_REASONS = [
    "Fraudulent activity",
    "Violation of terms of service",
    "Multiple booking cancellations",
    "Damaged vehicle / property",
    "Harassment or abusive behavior",
    "Fake identity or documents",
    "Repeated no-show without notice",
    "Other",
];

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

const fmtDate = (value) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "";

const fmtDateTime = (value) =>
    value
        ? new Date(value).toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "";

const fmtList = (value) =>
    Array.isArray(value)
        ? value.map((item) => `${item}`.trim()).filter(Boolean).join(", ")
        : "";

const fmtFullName = (user) =>
    [user?.firstName, user?.middleName, user?.lastName]
        .map((part) => `${part ?? ""}`.trim())
        .filter(Boolean)
        .join(" ");

const fmtAddress = (address) => {
    if (!address) return "";

    return [
        address.houseUnitLot,
        address.street,
        address.barangay,
        address.city,
        address.province,
        address.region,
        address.postalCode,
    ]
        .map((part) => `${part ?? ""}`.trim())
        .filter(Boolean)
        .join(", ");
};

const fmtEmergencyContact = (contact) => {
    if (!contact) return "";

    const parts = [
        contact.name,
        contact.relationship,
        contact.phoneNumber,
    ]
        .map((part) => `${part ?? ""}`.trim())
        .filter(Boolean);

    return parts.join(" · ");
};

const UserModeration = () => {
    const toast = useToast();

    const {
        users,
        blacklistedUsers,
        loading,
        error,
        getUsers,
        getBlacklistedUsers,
        updateUserStatus,
        blacklistUser,
        unblacklistUser,
        verifyValidId,
        unverifyValidId,
        grantRenewalAttempt,
        clearError,
    } = useUser();

    const { settings, getSettings } = useSettings();

    useEffect(() => {
        void getSettings();
    }, [getSettings]);

    const maxRenewalUploads =
        settings?.validIdRenewalSettings
            ?.maxUploadsPerYear ?? 1;

    // Settings → Registration; on unless turned off, like the server.
    const proofOfBillingEnabled =
        settings?.registrationSettings?.proofOfBillingEnabled !== false;

    const [searchParams, setSearchParams] =
        useSearchParams();

    const [activeTab, setActiveTab] =
        useState(TABS.USERS);

    const [search, setSearch] =
        useState("");

    const [selectedUser, setSelectedUser] =
        useState(null);

    const [grantAttemptDialogOpen, setGrantAttemptDialogOpen] =
        useState(false);

    const [grantAttemptAmount, setGrantAttemptAmount] =
        useState(1);

    const [
        selectedUserForGrant,
        setSelectedUserForGrant,
    ] = useState(null);

    const [viewModalOpen, setViewModalOpen] =
        useState(false);

    // The user whose ID the Verify dialog is open for.
    const [verifyTarget, setVerifyTarget] =
        useState(null);

    const [verifySubmitting, setVerifySubmitting] =
        useState(false);

    // Bumped after a verification so the ID history reloads.
    const [historyRefreshKey, setHistoryRefreshKey] =
        useState(0);

    const [
        statusDialogOpen,
        setStatusDialogOpen,
    ] = useState(false);

    const [
        blacklistDialogOpen,
        setBlacklistDialogOpen,
    ] = useState(false);

    const [
        unblacklistDialogOpen,
        setUnblacklistDialogOpen,
    ] = useState(false);

    const [blacklistReason, setBlacklistReason] =
        useState("");

    const [
        selectedPresetReason,
        setSelectedPresetReason,
    ] = useState("");

    const isCustomReason =
        selectedPresetReason === "Other" ||
        (!selectedPresetReason && blacklistReason);

    const finalBlacklistReason = isCustomReason
        ? blacklistReason
        : selectedPresetReason;

    const isReasonValid =
        finalBlacklistReason.trim().length >=
            MIN_REASON_LENGTH &&
        finalBlacklistReason.trim().length <=
            MAX_REASON_LENGTH;

    const loadUsers = useCallback(
        async () => {
            try {
                await getUsers();
            } catch (error) {
                toast.error(
                    typeof error === "string"
                        ? error
                        : "Unable to load users."
                );
            }
        },
        [getUsers, toast]
    );

    const loadBlacklistedUsers =
        useCallback(
            async () => {
                try {
                    await getBlacklistedUsers();
                } catch (error) {
                    toast.error(
                        typeof error === "string"
                            ? error
                            : "Unable to load blacklisted users."
                    );
                }
            },
            [
                getBlacklistedUsers,
                toast,
            ]
        );

    useEffect(() => {
        void loadUsers();
        void loadBlacklistedUsers();
    }, [
        loadUsers,
        loadBlacklistedUsers,
    ]);

    const visibleUsers = useMemo(() => {
        if (activeTab === TABS.BLACKLISTED) {
            return blacklistedUsers;
        }

        if (activeTab === TABS.OPERATORS) {
            return users.filter(
                (user) =>
                    user.role === "operator"
            );
        }

        return users.filter(
            (user) =>
                user.role === "customer"
        );
    }, [
        activeTab,
        users,
        blacklistedUsers,
    ]);

    const filteredUsers = useMemo(() => {
        const keyword = search
            .trim()
            .toLowerCase();

        if (!keyword) {
            return visibleUsers;
        }

        return visibleUsers.filter(
            (user) => {
                const fullName =
                    `${user.firstName} ${user.lastName}`
                        .toLowerCase();

                return (
                    fullName.includes(keyword) ||
                    user.email
                        ?.toLowerCase()
                        .includes(keyword) ||
                    user.phoneNumber
                        ?.toLowerCase()
                        .includes(keyword)
                );
            }
        );
    }, [search, visibleUsers]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearch("");
        clearError();
    };

    const handleView = (user) => {
        setSelectedUser(user);
        setViewModalOpen(true);
    };

    /*
     * Lets other admin pages (e.g. the booking detail drawer's "View
     * Profile" link) deep-link straight to a specific customer instead of
     * dropping the admin on the bare list to search for them again. Waits
     * for the users list to actually load before looking the id up, and
     * clears the param afterward so it doesn't re-trigger on tab changes
     * or refire if the modal is closed and reopened via the URL.
     */
    useEffect(() => {
        const userId = searchParams.get("userId");

        if (!userId || loading || users.length === 0) {
            return;
        }

        const match = users.find(
            (user) =>
                String(user._id ?? user.id) === userId
        );

        setSearchParams(
            (previous) => {
                const next = new URLSearchParams(previous);
                next.delete("userId");
                return next;
            },
            { replace: true }
        );

        if (match) {
            handleTabChange(TABS.USERS);
            handleView(match);
        } else {
            toast.error(
                "That customer could not be found."
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, users, loading]);

    const handleSuspend = (user) => {
        setSelectedUser(user);
        setStatusDialogOpen(true);
    };

    const handleBlacklist = (user) => {
        setSelectedUser(user);
        setBlacklistReason("");
        setSelectedPresetReason("");
        setBlacklistDialogOpen(true);
    };

    const handleUnblacklist = (user) => {
        setSelectedUser(user);
        setUnblacklistDialogOpen(true);
    };

    const handleVerify = (user) => {
        setVerifyTarget(user);
    };

    const confirmVerify = async (payload) => {
        if (!verifyTarget) {
            return;
        }

        const targetId = verifyTarget._id ?? verifyTarget.id;

        setVerifySubmitting(true);

        try {
            const response = await verifyValidId(
                targetId,
                payload
            );
            toast.success(
                "Valid ID verified successfully."
            );
            setVerifyTarget(null);
            setHistoryRefreshKey((key) => key + 1);
            setSelectedUser((prev) =>
                prev &&
                String(prev._id ?? prev.id) === String(targetId) &&
                response?.data
                    ? { ...prev, ...response.data }
                    : prev
            );
            await loadUsers();
        } catch (error) {
            toast.error(
                typeof error === "string"
                    ? error
                    : "Unable to verify valid ID."
            );
        } finally {
            setVerifySubmitting(false);
        }
    };

    const handleUnverify = async (user) => {
        try {
            await unverifyValidId(
                user._id ?? user.id
            );
            toast.success(
                "Valid ID unverified successfully."
            );
            await loadUsers();
        } catch (error) {
            toast.error(
                typeof error === "string"
                    ? error
                    : "Unable to unverify valid ID."
            );
        }
    };

    const handleGrantRenewalAttempt = (user) => {
        setSelectedUserForGrant(user);
        setGrantAttemptAmount(1);
        setGrantAttemptDialogOpen(true);
    };

    const confirmGrantRenewalAttempt =
        async () => {
            if (!selectedUserForGrant) {
                return;
            }

            try {
                await grantRenewalAttempt({
                    userId:
                        selectedUserForGrant._id ??
                        selectedUserForGrant.id,
                    amount: grantAttemptAmount,
                });
                toast.success(
                    `Granted ${grantAttemptAmount} renewal attempt(s) successfully.`
                );
                setGrantAttemptDialogOpen(false);
                setSelectedUserForGrant(null);
                setGrantAttemptAmount(1);
                await loadUsers();
            } catch (error) {
                toast.error(
                    typeof error === "string"
                        ? error
                        : "Unable to grant renewal attempt."
                );
            }
        };

    const confirmStatusUpdate =
        async () => {
            if (!selectedUser) {
                return;
            }

            try {
                await updateUserStatus(
                    selectedUser._id ??
                        selectedUser.id,
                    !selectedUser.isSuspended
                );

                toast.success(
                    selectedUser.isSuspended
                        ? "Partner account activated."
                        : "Partner account suspended."
                );

                setStatusDialogOpen(false);
                setSelectedUser(null);

                await loadUsers();
            } catch (error) {
                toast.error(
                    typeof error === "string"
                        ? error
                        : "Unable to update partner status."
                );
            }
        };

    const confirmBlacklist =
        async () => {
            if (!selectedUser) {
                return;
            }

            if (!isReasonValid) {
                toast.error(
                    `Blacklist reason must be between ${MIN_REASON_LENGTH} and ${MAX_REASON_LENGTH} characters.`
                );
                return;
            }

            try {
                await blacklistUser(
                    selectedUser._id ??
                        selectedUser.id,
                    finalBlacklistReason.trim()
                );

                toast.success(
                    "User blacklisted successfully."
                );

                setBlacklistDialogOpen(
                    false
                );
                setBlacklistReason("");
                setSelectedPresetReason("");
                setSelectedUser(null);

                await loadUsers();
                await loadBlacklistedUsers();
            } catch (error) {
                toast.error(
                    typeof error === "string"
                        ? error
                        : "Unable to blacklist user."
                );
            }
        };

    const confirmUnblacklist =
        async () => {
            if (!selectedUser) {
                return;
            }

            try {
                await unblacklistUser(
                    selectedUser._id ??
                        selectedUser.id
                );

                toast.success(
                    "User removed from blacklist."
                );

                setUnblacklistDialogOpen(
                    false
                );
                setSelectedUser(null);

                await loadBlacklistedUsers();
                await loadUsers();
            } catch (error) {
                toast.error(
                    typeof error === "string"
                        ? error
                        : "Unable to remove user from blacklist."
                );
            }
        };

    return (
        <div className="space-y-6">
            {error && (
                <Alert
                    variant="error"
                    message={error}
                />
            )}

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <div className="w-full max-w-xl">
                    <SearchBar
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder={
                            activeTab ===
                            TABS.BLACKLISTED
                                ? "Search blacklisted users..."
                                : activeTab ===
                                  TABS.OPERATORS
                                ? "Search partners..."
                                : "Search users..."
                        }
                    />
                </div>
            </div>

            {/* Section pill — same style as the Consignments tabs */}
            <div className="flex justify-center">
                <div
                    role="tablist"
                    aria-label="User groups"
                    className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-xl [scrollbar-width:none] dark:border-gray-800 dark:bg-gray-900/80 [&::-webkit-scrollbar]:hidden"
                >
                    {[
                        {
                            value: TABS.USERS,
                            label: "Users",
                            icon: UsersRound,
                            count: users.filter(
                                (user) => user.role === "customer"
                            ).length,
                        },
                        {
                            value: TABS.OPERATORS,
                            label: "Partners",
                            icon: Handshake,
                            count: users.filter(
                                (user) => user.role === "operator"
                            ).length,
                        },
                        {
                            value: TABS.BLACKLISTED,
                            label: "Blacklisted",
                            icon: Ban,
                            count: blacklistedUsers.length,
                        },
                    ].map((tab) => {
                        const active = activeTab === tab.value;
                        const Icon = tab.icon;

                        return (
                            <button
                                key={tab.value}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => handleTabChange(tab.value)}
                                className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                    active
                                        ? "text-white"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                                }`}
                            >
                                {active && (
                                    <motion.span
                                        layoutId="user-moderation-pill"
                                        className="absolute inset-0 rounded-full bg-blue-600 shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/20"
                                        transition={ACTIVE_PILL_SPRING}
                                    />
                                )}

                                <Icon className="relative h-4 w-4" />

                                <span className="relative">{tab.label}</span>

                                <span
                                    className={`relative rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                                        active
                                            ? "bg-white/25 text-white"
                                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <UserCardGrid
                users={filteredUsers}
                mode={activeTab}
                onView={handleView}
                onSuspend={handleSuspend}
                onBlacklist={handleBlacklist}
                onUnblacklist={handleUnblacklist}
                onVerify={handleVerify}
                onUnverify={handleUnverify}
                onGrantRenewalAttempt={
                    handleGrantRenewalAttempt
                }
            />

            <Modal
                isOpen={viewModalOpen}
                onClose={() => {
                    setViewModalOpen(false);
                    setSelectedUser(null);
                }}
                title="User Details"
                size="lg"
                footer={
                    <Button
                        onClick={() => {
                            setViewModalOpen(false);
                            setSelectedUser(
                                null
                            );
                        }}
                    >
                        Close
                    </Button>
                }
            >
                {selectedUser && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <Avatar
                                src={selectedUser.profileImage}
                                name={fmtFullName(selectedUser)}
                                size="xl"
                            />

                            <div className="min-w-0">
                                <h2 className="truncate text-xl font-bold text-gray-900 dark:text-white">
                                    {fmtFullName(selectedUser)}
                                </h2>

                                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                                    {selectedUser.email}
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                        {selectedUser.role}
                                    </span>
                                    <span
                                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                            selectedUser.isVerified
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                                : selectedUser.validIdExpired
                                                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                        }`}
                                    >
                                        {selectedUser.isVerified
                                            ? "ID Verified"
                                            : selectedUser.validIdExpired
                                            ? "ID Expired"
                                            : "ID Unverified"}
                                    </span>
                                    <span
                                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                            selectedUser.isSuspended
                                                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                        }`}
                                    >
                                        {selectedUser.isSuspended
                                            ? "Suspended"
                                            : "Active"}
                                    </span>
                                    {selectedUser.isApproved === false && (
                                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                            Pending Approval
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <ReviewSection title="Account">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <ReviewField
                                    label="User ID"
                                    value={
                                        selectedUser._id ??
                                        selectedUser.id
                                    }
                                />
                                <ReviewField
                                    label="Role"
                                    value={
                                        selectedUser.role
                                            ? `${selectedUser.role[0].toUpperCase()}${selectedUser.role.slice(1)}`
                                            : ""
                                    }
                                />
                                <ReviewField
                                    label="Account Status"
                                    value={
                                        selectedUser.isSuspended
                                            ? "Suspended"
                                            : "Active"
                                    }
                                />
                                <ReviewField
                                    label="Approval"
                                    value={
                                        selectedUser.isApproved ===
                                        false
                                            ? "Pending"
                                            : "Approved"
                                    }
                                />
                                <ReviewField
                                    label="Member Since"
                                    value={fmtDate(
                                        selectedUser.createdAt
                                    )}
                                />
                                <ReviewField
                                    label="Last Login"
                                    value={fmtDateTime(
                                        selectedUser.lastLogin
                                    )}
                                />
                                <ReviewField
                                    label="Last Updated"
                                    value={fmtDateTime(
                                        selectedUser.updatedAt
                                    )}
                                />
                            </div>
                        </ReviewSection>

                        {/* Accepted at registration (Settings → Terms & Policies). */}
                        <ReviewSection title="Terms Accepted">
                            <AcceptedTerms
                                acceptance={selectedUser.termsAcceptance}
                                legacyText="Not recorded — this account was created before Terms & Conditions versions were tracked."
                            />
                        </ReviewSection>

                        <ReviewSection title="Personal">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <ReviewField
                                    label="First Name"
                                    value={selectedUser.firstName}
                                />
                                <ReviewField
                                    label="Middle Name"
                                    value={selectedUser.middleName}
                                />
                                <ReviewField
                                    label="Last Name"
                                    value={selectedUser.lastName}
                                />
                                <ReviewField
                                    label="Birthdate"
                                    value={fmtDate(
                                        selectedUser.birthdate
                                    )}
                                />
                            </div>
                        </ReviewSection>

                        <ReviewSection title="Contact">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <ReviewField
                                    label="Email"
                                    value={selectedUser.email}
                                />
                                <ReviewField
                                    label="Phone Number"
                                    value={
                                        selectedUser.phoneNumber
                                    }
                                />
                                <ReviewField
                                    label="Alternative Contact"
                                    value={
                                        selectedUser.alternativeContact
                                    }
                                />
                                <ReviewField
                                    label="Emergency Contact"
                                    value={fmtEmergencyContact(
                                        selectedUser.emergencyContact
                                    )}
                                />
                                <div className="sm:col-span-2">
                                    <ReviewField
                                        label="Address"
                                        value={fmtAddress(
                                            selectedUser.address
                                        )}
                                    />
                                </div>
                            </div>
                        </ReviewSection>

                        <ReviewSection title="Identification">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <ReviewField
                                    label="Valid ID Type"
                                    value={
                                        selectedUser.validIdType
                                    }
                                />
                                <ReviewField
                                    label="Verification"
                                    value={
                                        selectedUser.isVerified
                                            ? "Verified"
                                            : selectedUser.verifiedByAdmin
                                            ? selectedUser.validIdExpired
                                                ? "On hold — valid ID expired"
                                                : "On hold — license expired"
                                            : "Not verified"
                                    }
                                />
                                <ReviewField
                                    label="ID Expiration"
                                    value={
                                        selectedUser.validIdExpirationDate
                                            ? `${fmtDate(
                                                  selectedUser.validIdExpirationDate
                                              )}${
                                                  selectedUser.validIdExpired
                                                      ? " (expired)"
                                                      : ""
                                              }`
                                            : "None recorded"
                                    }
                                />
                                <ReviewField
                                    label="Last Renewal"
                                    value={fmtDate(
                                        selectedUser.lastValidIdRenewalAt
                                    )}
                                />
                            </div>

                            {selectedUser.role === "customer" && (
                                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20 sm:flex-row sm:items-center">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                                        <RefreshCw size={17} />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                            ID Renewal Attempts
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-300/80">
                                            {`${
                                                selectedUser.validIdRenewalCount ??
                                                0
                                            } of ${maxRenewalUploads} used this year`}
                                        </p>
                                    </div>

                                    <Button
                                        size="sm"
                                        variant="warning"
                                        className="shrink-0"
                                        disabled={
                                            (selectedUser.validIdRenewalCount ??
                                                0) >=
                                            maxRenewalUploads
                                        }
                                        leftIcon={
                                            <RefreshCw
                                                size={14}
                                            />
                                        }
                                        onClick={() =>
                                            handleGrantRenewalAttempt(
                                                selectedUser
                                            )
                                        }
                                    >
                                        {(selectedUser.validIdRenewalCount ??
                                            0) >=
                                        maxRenewalUploads
                                            ? "Limit reached"
                                            : "Grant attempt"}
                                    </Button>
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                                {selectedUser.validIdImage && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            window.open(
                                                selectedUser.validIdImage,
                                                "_blank"
                                            )
                                        }
                                    >
                                        View Front
                                    </Button>
                                )}

                                {selectedUser.validIdBack && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            window.open(
                                                selectedUser.validIdBack,
                                                "_blank"
                                            )
                                        }
                                    >
                                        View Back
                                    </Button>
                                )}

                                {selectedUser.isVerified ? (
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={async () => {
                                            try {
                                                await unverifyValidId(
                                                    selectedUser._id ??
                                                        selectedUser.id
                                                );
                                                toast.success(
                                                    "Valid ID unverified successfully."
                                                );
                                                await getUsers();
                                                setSelectedUser(
                                                    (prev) => ({
                                                        ...prev,
                                                        isVerified: false,
                                                    })
                                                );
                                            } catch (error) {
                                                toast.error(
                                                    error?.response?.data?.message ||
                                                        error.message ||
                                                        "Unable to unverify valid ID."
                                                );
                                            }
                                        }}
                                    >
                                        Unverify
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="success"
                                        onClick={() =>
                                            handleVerify(selectedUser)
                                        }
                                    >
                                        Verify
                                    </Button>
                                )}
                            </div>
                        </ReviewSection>

                        <ReviewSection title="Valid ID History">
                            <ValidIdHistory
                                userId={
                                    selectedUser._id ??
                                    selectedUser.id
                                }
                                refreshKey={historyRefreshKey}
                            />
                        </ReviewSection>

                        {proofOfBillingEnabled && (
                            <ReviewSection title="Proof of Billing Address">
                                {selectedUser.proofOfBillingImage ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            window.open(
                                                selectedUser.proofOfBillingImage,
                                                "_blank",
                                                "noopener,noreferrer"
                                            )
                                        }
                                        className="group relative block h-40 w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        <img
                                            src={selectedUser.proofOfBillingImage}
                                            alt="Proof of billing address"
                                            className="h-full w-full object-cover transition group-hover:opacity-80"
                                        />

                                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                                            Open full size
                                        </span>
                                    </button>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Not provided.
                                    </p>
                                )}
                            </ReviewSection>
                        )}

                        <ReviewSection title="Driver's License">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <ReviewField
                                    label="Has Driver's License"
                                    value={
                                        selectedUser.hasDriversLicense === true
                                            ? "Yes"
                                            : selectedUser.hasDriversLicense === false
                                            ? "No — booking restricted to with-driver"
                                            : "Not specified"
                                    }
                                />
                                <ReviewField
                                    label="License Number"
                                    value={
                                        selectedUser.licenseNumber
                                    }
                                />
                                <ReviewField
                                    label="License Expiration"
                                    value={fmtDate(
                                        selectedUser.licenseExpirationDate
                                    )}
                                />
                                <ReviewField
                                    label="License Codes"
                                    value={fmtList(
                                        selectedUser.licenseCodes
                                    )}
                                />
                                <ReviewField
                                    label="Car Transmission"
                                    value={fmtList(
                                        selectedUser.carTransmission
                                    )}
                                />
                                <ReviewField
                                    label="Motorcycle Transmission"
                                    value={fmtList(
                                        selectedUser.motorcycleTransmission
                                    )}
                                />
                            </div>
                        </ReviewSection>

                        {(selectedUser.blacklistReason ||
                            selectedUser.blacklistedAt) && (
                            <ReviewSection title="Blacklist">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <ReviewField
                                        label="Blacklisted Date"
                                        value={fmtDate(
                                            selectedUser.blacklistedAt
                                        )}
                                    />
                                    <ReviewField
                                        label="Blacklisted By"
                                        value={
                                            selectedUser.blacklistedBy
                                                ? fmtFullName(
                                                      selectedUser.blacklistedBy
                                                  )
                                                : ""
                                        }
                                    />
                                    <div className="sm:col-span-2">
                                        <ReviewField
                                            label="Reason"
                                            value={
                                                selectedUser.blacklistReason
                                            }
                                        />
                                    </div>
                                </div>
                            </ReviewSection>
                        )}
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                isOpen={statusDialogOpen}
                onClose={() => {
                    setStatusDialogOpen(false);
                    setSelectedUser(null);
                }}
                onConfirm={
                    confirmStatusUpdate
                }
                loading={loading}
                title={
                    selectedUser?.isSuspended
                        ? "Activate Partner"
                        : "Suspend Partner"
                }
                message={
                    selectedUser?.isSuspended
                        ? `Are you sure you want to activate ${selectedUser?.firstName} ${selectedUser?.lastName}'s account?`
                        : `Are you sure you want to suspend ${selectedUser?.firstName} ${selectedUser?.lastName}'s account?`
                }
                confirmText={
                    selectedUser?.isSuspended
                        ? "Activate"
                        : "Suspend"
                }
                confirmVariant={
                    selectedUser?.isSuspended
                        ? "success"
                        : "warning"
                }
            />

            <ConfirmDialog
                isOpen={
                    unblacklistDialogOpen
                }
                onClose={() => {
                    setUnblacklistDialogOpen(
                        false
                    );
                    setSelectedUser(null);
                }}
                onConfirm={
                    confirmUnblacklist
                }
                loading={loading}
                title="Remove Blacklist"
                message={
                    selectedUser
                        ? `Are you sure you want to remove ${selectedUser.firstName} ${selectedUser.lastName} from the blacklist?`
                        : "Are you sure you want to remove this user from the blacklist?"
                }
                confirmText="Remove"
                confirmVariant="success"
            />

            <Modal
                isOpen={blacklistDialogOpen}
                onClose={() => {
                    setBlacklistDialogOpen(
                        false
                    );
                    setSelectedUser(null);
                    setBlacklistReason("");
                    setSelectedPresetReason("");
                }}
                title="Blacklist User"
                size="md"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setBlacklistDialogOpen(
                                    false
                                );
                                setSelectedUser(
                                    null
                                );
                                setBlacklistReason(
                                    ""
                                );
                                setSelectedPresetReason(
                                    ""
                                );
                            }}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="danger"
                            onClick={
                                confirmBlacklist
                            }
                            loading={loading}
                            disabled={
                                !isReasonValid
                            }
                        >
                            Blacklist User
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Provide a reason for
                        blacklisting{" "}
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {selectedUser?.firstName}{" "}
                            {selectedUser?.lastName}
                        </span>
                    </p>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Select a reason
                        </label>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {BLACKLIST_PRESET_REASONS.map(
                                (
                                    reason
                                ) => (
                                    <button
                                        key={
                                            reason
                                        }
                                        type="button"
                                        onClick={() => {
                                            setSelectedPresetReason(
                                                reason
                                            );
                                            if (
                                                reason !==
                                                "Other"
                                            ) {
                                                setBlacklistReason(
                                                    ""
                                                );
                                            }
                                        }}
                                        className={[
                                            "rounded-lg border px-3 py-2 text-left text-sm transition",
                                            selectedPresetReason ===
                                                reason
                                                ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800",
                                        ].join(
                                            " "
                                        )}
                                    >
                                        {
                                            reason
                                        }
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {isCustomReason && (
                        <div>
                            <label
                                htmlFor="blacklistReason"
                                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                            >
                                Custom reason
                            </label>

                            <textarea
                                id="blacklistReason"
                                value={
                                    blacklistReason
                                }
                                onChange={(event) =>
                                    setBlacklistReason(
                                        event.target.value
                                    )
                                }
                                rows={3}
                                placeholder="Describe the reason for blacklisting this user..."
                                maxLength={
                                    MAX_REASON_LENGTH
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                            />

                            <div
                                className={[
                                    "mt-1.5 flex justify-between text-xs",
                                    blacklistReason.trim().length <
                                    MIN_REASON_LENGTH
                                        ? "text-gray-400"
                                        : "text-green-600",
                                ].join(
                                    " "
                                )}
                            >
                                <span>
                                    {blacklistReason.trim().length <
                                    MIN_REASON_LENGTH
                                        ? `Minimum ${MIN_REASON_LENGTH} characters required`
                                        : "Minimum length met"}
                                </span>
                                <span>
                                    {
                                        blacklistReason.length
                                    }
                                    /
                                    {
                                        MAX_REASON_LENGTH
                                    }
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <VerifyValidIdDialog
                isOpen={Boolean(verifyTarget)}
                user={verifyTarget}
                loading={verifySubmitting}
                onClose={() => {
                    if (!verifySubmitting) {
                        setVerifyTarget(null);
                    }
                }}
                onConfirm={confirmVerify}
            />

            <ConfirmDialog
                isOpen={grantAttemptDialogOpen}
                onClose={() => {
                    setGrantAttemptDialogOpen(false);
                    setSelectedUserForGrant(null);
                    setGrantAttemptAmount(1);
                }}
                onConfirm={confirmGrantRenewalAttempt}
                loading={loading}
                title="Grant Renewal Attempt"
                message={
                    selectedUserForGrant
                        ? `Are you sure you want to grant ${grantAttemptAmount} renewal attempt(s) to ${selectedUserForGrant.firstName} ${selectedUserForGrant.lastName}?`
                        : "Are you sure you want to grant this renewal attempt?"
                }
                confirmText="Grant"
                confirmVariant="success"
            />
        </div>
    );
};

export default UserModeration;