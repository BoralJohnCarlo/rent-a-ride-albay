import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import Button from "../common/Button";
import Modal from "../common/Modal";
import Input from "../common/Input";
import Textarea from "../common/Textarea";
import PendingVehicleGrid from "../pendingVehicles/PendingVehicleGrid";

import usePendingVehicles from "../../hooks/pendingVehicles/usePendingVehicles";
import useToast from "../../hooks/toast/useToast";
import { getPendingVehicles, updatePendingVehicleStatus } from "../../api/pendingVehicleApi";

const LIST_PARAMS = {
    sortBy: "createdAt",
    sortOrder: "desc",
    limit: 50,
};

const PendingVehiclesPanel = () => {
    const toast = useToast();

    const { loadPendingVehicleCounts } = usePendingVehicles();
    // Keep the page request independent of the dashboard count request.
    const [pendingVehicles, setPendingVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [reloadCount, setReloadCount] = useState(0);

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
        setReloadCount(value => value + 1);
        loadPendingVehicleCounts();
    };

    useEffect(() => {
        loadPendingVehicleCounts();
    }, [loadPendingVehicleCounts]);

    useEffect(() => {
        let cancelled = false;
        let changingPage = false;
        const load = async () => {
            setLoading(true);
            setListError("");
            setSelectedId(null);
            try {
                const result = await getPendingVehicles({ ...LIST_PARAMS, page });
                if (cancelled) return;
                const pages = Math.max(1, result.pagination?.pages || 1);
                setPagination({ total: result.pagination?.total || 0, pages });
                // Approving the final item on a page can remove that page.
                if (page > pages) {
                    changingPage = true;
                    setPage(pages);
                    return;
                }
                setPendingVehicles(result.data || []);
            } catch (error) {
                if (!cancelled) setListError(error.response?.data?.message || "Unable to load pending vehicles. Please retry.");
            } finally {
                if (!cancelled && !changingPage) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [page, reloadCount]);

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

        if (mode === "approve" && !vehicle.approvalRecoveryRequired) {
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

            {listError ? <div role="alert" className="space-y-3 rounded-xl border border-red-200 p-4 text-sm text-red-700 dark:text-red-300">
                <p>{listError}</p>
                <Button variant="outline" className="w-full sm:w-auto" onClick={reload}>Retry loading vehicles</Button>
            </div> : <PendingVehicleGrid
                pendingVehicles={pendingVehicles}
                loading={loading}
                onSelect={setSelectedId}
                onView={setSelectedId}
                onApprove={openAction("approve")}
                onReject={openAction("reject")}
                selectedId={selectedId}
            />}

            <nav aria-label="Pending vehicle pages" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p aria-live="polite" className="text-sm text-gray-600 dark:text-gray-300">Page {page} of {pagination.pages} · {pagination.total} submissions</p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="outline" className="min-h-11" disabled={loading || action.loading || !!listError || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
                    <Button variant="outline" className="min-h-11" disabled={loading || action.loading || !!listError || page >= pagination.pages} onClick={() => setPage(value => value + 1)}>Next</Button>
                </div>
            </nav>

            <Modal
                isOpen={action.open && action.mode === "approve"}
                onClose={closeAction}
                title={action.vehicle?.approvalRecoveryRequired ? "Retry approval" : "Approve Vehicle"}
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
                            {action.vehicle?.approvalRecoveryRequired ? "Retry approval" : "Approve"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {action.vehicle?.approvalRecoveryRequired ? <p className="text-sm text-gray-600 dark:text-gray-300">Finish the saved approval and send the partner's confirmation. Existing pricing and vehicle details will be preserved.</p> : <>
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
                    </>}
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
