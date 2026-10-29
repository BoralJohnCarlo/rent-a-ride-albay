import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import Button from "../common/Button";
import Modal from "../common/Modal";
import Input from "../common/Input";
import Textarea from "../common/Textarea";
import PendingVehicleGrid from "../pendingVehicles/PendingVehicleGrid";

import usePendingVehicles from "../../hooks/pendingVehicles/usePendingVehicles";
import useToast from "../../hooks/toast/useToast";
import { updatePendingVehicleStatus } from "../../api/pendingVehicleApi";

const LIST_PARAMS = {
    sortBy: "createdAt",
    sortOrder: "desc",
    limit: 50,
};

const PendingVehiclesPanel = () => {
    const toast = useToast();

    const {
        pendingVehicles,
        loading,
        loadPendingVehicles,
        loadPendingVehicleCounts,
    } = usePendingVehicles();

    const [selectedId, setSelectedId] = useState(null);
    const [action, setAction] = useState({
        open: false,
        mode: "approve",
        vehicle: null,
        reason: "",
        dailyRate: "",
        reservationFee: "",
        loading: false,
    });
    const [priceError, setPriceError] = useState("");

    const reload = () => {
        loadPendingVehicles(LIST_PARAMS);
        loadPendingVehicleCounts();
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openAction = (mode) => (vehicle) => {
        setPriceError("");
        setAction({
            open: true,
            mode,
            vehicle,
            reason: "",
            dailyRate: vehicle?.pricing?.dailyRate || "",
            reservationFee: vehicle?.pricing?.reservationFee || "",
            loading: false,
        });
    };

    const closeAction = () =>
        setAction((prev) => ({ ...prev, open: false }));

    const confirmAction = async () => {
        const { mode, vehicle, reason, dailyRate, reservationFee } = action;
        if (!vehicle) return;

        if (mode === "reject" && !reason.trim()) {
            toast.warning("Please provide a reason for rejection.");
            return;
        }

        let pricing;

        if (mode === "approve") {
            const parsedDailyRate = Number(dailyRate);
            const parsedReservationFee = Number(reservationFee);

            if (!dailyRate || !Number.isFinite(parsedDailyRate) || parsedDailyRate <= 0) {
                setPriceError("Enter a valid daily rate.");
                return;
            }

            if (
                reservationFee === "" ||
                !Number.isFinite(parsedReservationFee) ||
                parsedReservationFee < 0
            ) {
                setPriceError("Enter a valid reservation fee.");
                return;
            }

            setPriceError("");
            pricing = {
                dailyRate: parsedDailyRate,
                reservationFee: parsedReservationFee,
            };
        }

        setAction((prev) => ({ ...prev, loading: true }));

        try {
            await updatePendingVehicleStatus(vehicle._id, {
                status: mode === "approve" ? "approved" : "rejected",
                rejectionReason: mode === "reject" ? reason.trim() : "",
                rejectionDetails: mode === "reject" ? reason.trim() : "",
                ...(pricing ? { pricing } : {}),
            });
            reload();
            toast.success(
                mode === "approve"
                    ? "Vehicle approved and added to the fleet."
                    : "Vehicle rejected."
            );
            setAction({
                open: false,
                mode: "approve",
                vehicle: null,
                reason: "",
                dailyRate: "",
                reservationFee: "",
                loading: false,
            });
        } catch (error) {
            setAction((prev) => ({ ...prev, loading: false }));
            toast.error(
                error?.response?.data?.message ||
                    (mode === "approve"
                        ? "Failed to approve vehicle."
                        : "Failed to reject vehicle.")
            );
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <div className="mb-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Pending Vehicles
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Vehicles submitted by existing partners, awaiting fleet
                    approval.
                </p>
            </div>

            <PendingVehicleGrid
                pendingVehicles={pendingVehicles}
                loading={loading}
                onSelect={setSelectedId}
                onView={setSelectedId}
                onApprove={openAction("approve")}
                onReject={openAction("reject")}
                selectedId={selectedId}
            />

            <Modal
                isOpen={action.open && action.mode === "approve"}
                onClose={closeAction}
                title="Approve Vehicle"
                size="md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeAction}
                            disabled={action.loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="success"
                            loading={action.loading}
                            onClick={confirmAction}
                        >
                            Approve
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        This vehicle wasn't priced at registration —
                        set its rental pricing to add it to the fleet
                        and make it available for booking.
                    </p>

                    <Input
                        type="number"
                        label="Daily Rate (₱)"
                        required
                        min="0"
                        step="0.01"
                        value={action.dailyRate}
                        onChange={(event) =>
                            setAction((prev) => ({
                                ...prev,
                                dailyRate: event.target.value,
                            }))
                        }
                        placeholder="0.00"
                        disabled={action.loading}
                    />

                    <Input
                        type="number"
                        label="Reservation Fee (₱)"
                        required
                        min="0"
                        step="0.01"
                        value={action.reservationFee}
                        onChange={(event) =>
                            setAction((prev) => ({
                                ...prev,
                                reservationFee: event.target.value,
                            }))
                        }
                        placeholder="0.00"
                        disabled={action.loading}
                    />

                    {priceError && (
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {priceError}
                        </p>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={action.open && action.mode === "reject"}
                onClose={closeAction}
                title="Reject Vehicle"
                size="md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeAction}
                            disabled={action.loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={action.loading}
                            disabled={!action.reason.trim()}
                            onClick={confirmAction}
                        >
                            Reject
                        </Button>
                    </>
                }
            >
                <Textarea
                    label="Reason for rejection"
                    value={action.reason}
                    onChange={(event) =>
                        setAction((prev) => ({
                            ...prev,
                            reason: event.target.value,
                        }))
                    }
                    rows={4}
                    required
                    disabled={action.loading}
                    placeholder="Explain why this vehicle is being rejected. The partner will see this."
                />
            </Modal>
        </motion.div>
    );
};

export default PendingVehiclesPanel;
