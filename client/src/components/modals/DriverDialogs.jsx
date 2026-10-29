import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../common/Button";
import Input from "../common/Input";
import ConfirmDialog from "../common/ConfirmDialog";
import Modal from "../common/Modal";

import DriverForm from "../forms/DriverForm";

import { getDriverUpcomingBookings } from "../../api/driverApi";
import formatDate from "../../utils/formatDate";

const getDriverFullName = (driver) =>
    [
        driver?.firstName,
        driver?.lastName,
    ]
        .filter(Boolean)
        .join(" ") || "this driver";

const DriverDialogs = ({
    mode = null,
    driver = null,
    users = [],
    isOpen = false,
    loading = false,
    errors = null,
    onClose,
    onSubmit,
}) => {
    const isFormMode =
        mode === "create" ||
        mode === "edit" ||
        mode === "view";

    const [archiveReason, setArchiveReason] =
        useState("");

    useEffect(() => {
        if (!isOpen || mode !== "archive") {
            setArchiveReason("");
        }
    }, [isOpen, mode]);

    // Bookings that still count on this driver, shown before suspending.
    const [upcomingBookings, setUpcomingBookings] =
        useState(null);

    const driverId = driver?._id;

    useEffect(() => {
        setUpcomingBookings(null);

        if (!isOpen || mode !== "suspend" || !driverId) {
            return undefined;
        }

        let cancelled = false;

        getDriverUpcomingBookings(driverId)
            .then((response) => {
                if (!cancelled) {
                    setUpcomingBookings(response?.data ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUpcomingBookings([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, mode, driverId]);

    const driverName =
        getDriverFullName(driver);

    if (!isOpen || !mode) {
        return null;
    }

    if (isFormMode) {
        const isViewMode =
            mode === "view";

        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={
                    mode === "create"
                        ? "Add Driver"
                        : mode === "edit"
                        ? "Edit Driver"
                        : "Driver Details"
                }
                size="xl"
                closeOnOverlayClick={!loading}
                closeOnEscape={!loading}
            >
                <DriverForm
                    mode={mode}
                    driver={driver}
                    users={users}
                    loading={loading}
                    errors={errors}
                    onSubmit={onSubmit}
                    onCancel={onClose}
                />

                {isViewMode && (
                    <div className="flex justify-end border-t border-gray-200 pt-6 dark:border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                            Close
                        </button>
                    </div>
                )}
            </Modal>
        );
    }

    if (
        mode === "suspend" ||
        mode === "activate"
    ) {
        const isSuspending =
            mode === "suspend";

        return (
            <ConfirmDialog
                isOpen={isOpen}
                onClose={onClose}
                onConfirm={() =>
                    onSubmit?.(driver)
                }
                loading={loading}
                title={
                    isSuspending
                        ? "Suspend Driver"
                        : "Activate Driver"
                }
                message={
                    isSuspending ? (
                        <div className="space-y-3">
                            <p>
                                Are you sure you want to suspend{" "}
                                {driverName}? The driver will no longer be
                                treated as an active driver.
                            </p>

                            {upcomingBookings === null ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Checking their bookings...
                                </p>
                            ) : upcomingBookings.length > 0 ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-500/30 dark:bg-amber-500/10">
                                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                        {upcomingBookings.length} booking
                                        {upcomingBookings.length > 1
                                            ? "s still count"
                                            : " still counts"}{" "}
                                        on this driver
                                    </p>
                                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/90">
                                        They can't be approved or picked up
                                        with a suspended driver — open each
                                        one to change its driver.
                                    </p>
                                    <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                                        {upcomingBookings
                                            .slice(0, 5)
                                            .map((booking) => (
                                                <li key={booking._id}>
                                                    <Link
                                                        to={`/admin/bookings?booking=${booking._id}`}
                                                        className="font-mono font-semibold underline underline-offset-2"
                                                    >
                                                        {booking.bookingCode}
                                                    </Link>{" "}
                                                    · {booking.status} ·{" "}
                                                    {formatDate(
                                                        booking.startDate
                                                    )}
                                                </li>
                                            ))}
                                        {upcomingBookings.length > 5 && (
                                            <li>
                                                and{" "}
                                                {upcomingBookings.length - 5}{" "}
                                                more
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        `Are you sure you want to activate ${driverName}?`
                    )
                }
                confirmText={
                    isSuspending
                        ? "Suspend"
                        : "Activate"
                }
                confirmVariant={
                    isSuspending
                        ? "danger"
                        : "success"
                }
            />
        );
    }

    if (mode === "archive") {
        const handleArchive = () => {
            onSubmit?.({
                driver,
                reason: archiveReason.trim(),
            });
        };

        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Archive Driver"
                size="sm"
                closeOnOverlayClick={!loading}
                closeOnEscape={!loading}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            variant="danger"
                            onClick={
                                handleArchive
                            }
                            loading={loading}
                        >
                            Archive
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Are you sure you want
                        to archive{" "}
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {driverName}
                        </span>
                        ? Archived drivers
                        will no longer be
                        available in the active
                        driver list.
                    </p>

                    <Input
                        label="Archive Reason"
                        value={
                            archiveReason
                        }
                        onChange={(event) =>
                            setArchiveReason(
                                event.target
                                    .value
                            )
                        }
                        placeholder="Enter the reason for archiving this driver"
                        disabled={loading}
                        helperText="Optional. This reason will be stored with the driver's archive record."
                    />
                </div>
            </Modal>
        );
    }

    if (mode === "restore") {
    const archiveReason =
        driver?.archive?.reason?.trim();

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={() =>
                onSubmit?.(driver)
            }
            loading={loading}
            title="Restore Driver"
            message={
                <div className="space-y-3">
                    <p>
                        Are you sure you want to
                        restore {driverName}?
                    </p>

                    {archiveReason ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Archive Reason
                            </p>

                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                                {archiveReason}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No archive reason was
                                provided.
                            </p>
                        </div>
                    )}
                </div>
            }
            confirmText="Restore"
            confirmVariant="success"
        />
    );
}

    return null;
};

export default DriverDialogs;