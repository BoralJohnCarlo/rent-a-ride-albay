import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ClipboardList, Plus } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import PillSearch from "../../components/common/PillSearch";
import PillTabs from "../../components/common/PillTabs";

import ConsignmentCardGrid from "../../components/consignments/ConsignmentCardGrid";
import ConsignmentAppointmentsPanel from "../../components/consignments/ConsignmentAppointmentsPanel";
import OperatorPendingVehiclesPanel from "../../components/consignments/OperatorPendingVehiclesPanel";

import NewConsignmentDialog from "../../components/consignments/NewConsignmentDialog";
import WithdrawConsignmentDialog from "../../components/consignments/WithdrawConsignmentDialog";
import ConsignmentReview from "../../components/consignments/ConsignmentReview";
import BookInspectionDialog from "../../components/consignments/BookInspectionDialog";

import useConsignments from "../../hooks/consignments/useConsignments";
import useToast from "../../hooks/toast/useToast";

const PAGE_TRANSITION = {
    duration: 0.25,
};

const STATUS_ALL = "All";

// Approved applications become vehicles and leave this page, so there's
// nothing to filter them by.
const STATUS_OPTIONS = [
    STATUS_ALL,
    "Draft",
    "Pending",
    "Under Review",
    "Revision Requested",
    "Rejected",
    "Withdrawn",
    "Archived",
].map((status) => ({
    value: status,
    label: status === STATUS_ALL ? "All statuses" : status,
}));

const SECTIONS = [
    {
        value: "applications",
        label: "Applications",
        icon: ClipboardList,
    },
    {
        value: "appointments",
        label: "Appointments",
        icon: CalendarClock,
    },
];

const Consignments = () => {
    const {
        consignments,
        loading,
        withdrawConsignment,
        submitConsignment,
        getMyConsignments,
        bookInspectionAppointment,
    } = useConsignments();

    const toast = useToast();

    const [section, setSection] =
        useState("applications");

    const [search, setSearch] = useState("");

    const [statusFilter, setStatusFilter] =
        useState(STATUS_ALL);

    const [newDialogOpen, setNewDialogOpen] =
        useState(false);

    const [editDialogOpen, setEditDialogOpen] =
        useState(false);

    const [editingConsignment, setEditingConsignment] =
        useState(null);

    const [reviewDialogOpen, setReviewDialogOpen] =
        useState(false);

    const [withdrawDialogOpen, setWithdrawDialogOpen] =
        useState(false);

    const [bookInspectionDialogOpen, setBookInspectionDialogOpen] =
        useState(false);

    const [selectedConsignment, setSelectedConsignment] =
        useState(null);

    useEffect(() => {
        getMyConsignments();
    }, [getMyConsignments]);

    /*
     * Once approved, a consignment becomes a real vehicle — it moves to
     * "My Vehicles" and has nothing left for admin to decide, so it's
     * excluded here rather than left cluttering an "applications" page.
     */
    const pendingConsignments = useMemo(
        () =>
            consignments.filter(
                (consignment) =>
                    consignment.application?.status !==
                    "Approved"
            ),
        [consignments]
    );

    const filteredConsignments = useMemo(() => {
        const keyword = search
            .trim()
            .toLowerCase();

        return pendingConsignments.filter(
            (consignment) => {
                if (
                    statusFilter !== STATUS_ALL &&
                    consignment.application?.status !==
                        statusFilter
                ) {
                    return false;
                }

                if (!keyword) {
                    return true;
                }

                const applicant =
                    consignment.snapshots
                        ?.applicant;

                const vehicle =
                    consignment.snapshots
                        ?.vehicle;

                const applicantName =
                    applicant?.organization
                        ?.name ||
                    applicant?.identity
                        ?.displayName ||
                    [
                        applicant?.identity
                            ?.firstName,
                        applicant?.identity
                            ?.lastName,
                    ]
                        .filter(Boolean)
                        .join(" ");

                const searchable = [
                    consignment.consignmentCode,
                    vehicle?.brand,
                    vehicle?.model,
                    vehicle?.variant,
                    vehicle?.plateNumber,
                    applicantName,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return searchable.includes(
                    keyword
                );
            }
        );
    }, [
        pendingConsignments,
        search,
        statusFilter,
    ]);

    const handleRefresh = () => {
        getMyConsignments();
    };

    const handleOpenNewDialog = () => {
        setNewDialogOpen(true);
    };

    const handleCloseNewDialog = () => {
        setNewDialogOpen(false);
    };

    const handleEdit = (consignment) => {
        setEditingConsignment(consignment);
        setEditDialogOpen(true);
    };

    const handleCloseEdit = () => {
        setEditDialogOpen(false);
        setEditingConsignment(null);
    };

    const handleSubmit = async (consignment) => {
        try {
            await submitConsignment(
                consignment._id
            ).unwrap();

            toast.success(
                "Consignment application submitted successfully."
            );

            handleRefresh();
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to submit consignment application."
            );
        }
    };

    const handleOpenReview = (
        consignment
    ) => {
        setSelectedConsignment(
            consignment
        );

        setReviewDialogOpen(true);
    };

    const handleCloseReview = () => {
        setSelectedConsignment(null);

        setReviewDialogOpen(false);
    };

    const handleOpenWithdraw =
        (consignment) => {
            setSelectedConsignment(
                consignment
            );

            setWithdrawDialogOpen(true);
        };

    const handleCloseWithdraw =
        () => {
            setSelectedConsignment(
                null
            );

            setWithdrawDialogOpen(
                false
            );
        };

    const handleWithdraw =
        async (payload) => {
            if (
                !selectedConsignment
            ) {
                return;
            }

            try {
                await withdrawConsignment({
                    id: selectedConsignment._id,
                    payload,
                }).unwrap();

                toast.success(
                    "Consignment application withdrawn successfully."
                );

                handleCloseWithdraw();

                handleRefresh();
            } catch (error) {
                toast.error(
                    error?.message ||
                        "Unable to withdraw consignment application."
                );
            }
        };

    const handleOpenBookInspection =
        (consignment) => {
            setSelectedConsignment(
                consignment
            );

            setBookInspectionDialogOpen(true);
        };

    const handleCloseBookInspection =
        () => {
            setSelectedConsignment(null);

            setBookInspectionDialogOpen(false);
        };

    const handleBookInspection =
        async ({ date, time }) => {
            if (!selectedConsignment) {
                return;
            }

            try {
                await bookInspectionAppointment({
                    consignmentId:
                        selectedConsignment._id,
                    data: { date, time },
                }).unwrap();

                toast.success(
                    "Inspection appointment scheduled."
                );

                handleCloseBookInspection();

                handleRefresh();
            } catch (error) {
                toast.error(
                    error?.message ||
                        "Unable to schedule the inspection appointment."
                );
            }
        };

    const hasFilters =
        search.trim() ||
        statusFilter !== STATUS_ALL;

    const emptyState = hasFilters
        ? {
              title:
                  "No Matching Applications",
              description:
                  "Try changing your search or filters.",
          }
        : {
              title:
                  "No Consignment Applications",
              description:
                  "You haven't submitted any consignment applications yet.",
          };

    return (
        <>
            <div className="space-y-6">
                {/* Controls, centred: search + status filter (Applications
                    only) → section pill with the New Application button. */}
                <div className="flex flex-col items-center gap-3">
                    {section === "applications" && (
                        <PillSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search by code, vehicle, or plate..."
                            label="Search consignments"
                            filters={[
                                {
                                    value: statusFilter,
                                    onChange: setStatusFilter,
                                    options: STATUS_OPTIONS,
                                    label: "Filter by status",
                                },
                            ]}
                        />
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <PillTabs
                            label="Consignment sections"
                            layoutId="operator-consignment-section-pill"
                            value={section}
                            onChange={setSection}
                            options={SECTIONS}
                        />

                        <Button
                            size="sm"
                            leftIcon={<Plus size={16} />}
                            onClick={handleOpenNewDialog}
                            className="h-11 rounded-full! px-5!"
                        >
                            New Application
                        </Button>
                    </div>
                </div>

                {section === "appointments" ? (
                    <ConsignmentAppointmentsPanel
                        consignments={consignments}
                        loading={loading}
                        onView={handleOpenReview}
                    />
                ) : (
                    <>
                        <OperatorPendingVehiclesPanel />

                        {loading ? (
                            <LoadingSpinner fullScreen={false} />
                        ) : filteredConsignments.length === 0 ? (
                            <EmptyState
                                title={emptyState.title}
                                description={
                                    emptyState.description
                                }
                            />
                        ) : (
                            <AnimatePresence
                                mode="wait"
                                initial={false}
                            >
                                <motion.div
                                    key={`${statusFilter}-${search}`}
                                    layout
                                    initial={{
                                        opacity: 0,
                                        y: 12,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                    }}
                                    exit={{
                                        opacity: 0,
                                        y: -12,
                                    }}
                                    transition={PAGE_TRANSITION}
                                >
                                    <ConsignmentCardGrid
                                        consignments={
                                            filteredConsignments
                                        }
                                        onView={handleOpenReview}
                                        onSelect={handleOpenReview}
                                        onEdit={handleEdit}
                                        onSubmit={handleSubmit}
                                        onWithdraw={
                                            handleOpenWithdraw
                                        }
                                        onBookInspection={
                                            handleOpenBookInspection
                                        }
                                    />
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </>
                )}
            </div>

            <NewConsignmentDialog
                open={newDialogOpen}
                onClose={
                    handleCloseNewDialog
                }
                onSuccess={
                    handleRefresh
                }
            />

            <NewConsignmentDialog
                open={editDialogOpen}
                mode="edit"
                consignment={editingConsignment}
                onClose={handleCloseEdit}
                onSuccess={() => {
                    handleCloseEdit();
                    handleRefresh();
                }}
            />

            <WithdrawConsignmentDialog
                open={
                    withdrawDialogOpen
                }
                consignment={
                    selectedConsignment
                }
                loading={loading}
                onClose={
                    handleCloseWithdraw
                }
                onSubmit={
                    handleWithdraw
                }
            />

            <ConsignmentReview
                open={
                    reviewDialogOpen
                }
                consignment={
                    selectedConsignment
                }
                onClose={
                    handleCloseReview
                }
            />

            <BookInspectionDialog
                open={bookInspectionDialogOpen}
                consignment={selectedConsignment}
                loading={loading}
                onClose={handleCloseBookInspection}
                onSubmit={handleBookInspection}
            />
        </>
    );
};

export default Consignments;