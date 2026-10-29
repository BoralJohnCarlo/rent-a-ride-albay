import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import TableToolbar from "../../components/tables/TableToolbar";

import ConsignmentCardGrid from "../../components/consignments/ConsignmentCardGrid";
import ConsignmentFilters from "../../components/consignments/ConsignmentFilters";

import NewConsignmentDialog from "../../components/consignments/NewConsignmentDialog";
import WithdrawConsignmentDialog from "../../components/consignments/WithdrawConsignmentDialog";
import ConsignmentReview from "../../components/consignments/ConsignmentReview";

import useConsignments from "../../hooks/consignments/useConsignments";
import useToast from "../../hooks/toast/useToast";

const PAGE_TRANSITION = {
    duration: 0.25,
};

const STATUS_ALL = "All";

const Consignments = () => {
    const {
        consignments,
        loading,
        withdrawConsignment,
        getMyConsignments,
    } = useConsignments();

    const toast = useToast();

    const [search, setSearch] = useState("");

    const [statusFilter, setStatusFilter] =
        useState(STATUS_ALL);

    const [showFilters, setShowFilters] =
        useState(false);

    const [newDialogOpen, setNewDialogOpen] =
        useState(false);

    const [reviewDialogOpen, setReviewDialogOpen] =
        useState(false);

    const [withdrawDialogOpen, setWithdrawDialogOpen] =
        useState(false);

    const [selectedConsignment, setSelectedConsignment] =
        useState(null);

    useEffect(() => {
        getMyConsignments();
    }, [getMyConsignments]);

    const filteredConsignments = useMemo(() => {
        const keyword = search
            .trim()
            .toLowerCase();

        return consignments.filter(
            (consignment) => {
                if (
                    statusFilter !== STATUS_ALL &&
                    consignment.status !==
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
        consignments,
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
                    ...payload,
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
                <TableToolbar
                    search={search}
                    onSearch={setSearch}
                    searchPlaceholder="Search consignments..."
                    addLabel="New Application"
                    onAdd={
                        handleOpenNewDialog
                    }
                    showFilter
                    onFilter={() =>
                        setShowFilters(
                            (previous) =>
                                !previous
                        )
                    }
                />

                <AnimatePresence initial={false}>
                    {showFilters && (
                        <motion.div
                            key="filters"
                            initial={{
                                opacity: 0,
                                height: 0,
                            }}
                            animate={{
                                opacity: 1,
                                height: "auto",
                            }}
                            exit={{
                                opacity: 0,
                                height: 0,
                            }}
                            transition={
                                PAGE_TRANSITION
                            }
                            className="overflow-hidden"
                        >
                            <ConsignmentFilters
                                status={
                                    statusFilter
                                }
                                onStatusChange={
                                    setStatusFilter
                                }
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading ? (
                    <LoadingSpinner
                        fullScreen={false}
                    />
                ) : filteredConsignments.length ===
                  0 ? (
                    <EmptyState
                        title={
                            emptyState.title
                        }
                        description={
                            emptyState.description
                        }
                        action={
                            !hasFilters && (
                                <Button
                                    onClick={
                                        handleOpenNewDialog
                                    }
                                >
                                    New Application
                                </Button>
                            )
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
                            transition={
                                PAGE_TRANSITION
                            }
                        >
                            <ConsignmentCardGrid
                                consignments={
                                    filteredConsignments
                                }
                                onView={
                                    handleOpenReview
                                }
                                onSelect={
                                    handleOpenReview
                                }
                                onWithdraw={
                                    handleOpenWithdraw
                                }
                            />
                        </motion.div>
                    </AnimatePresence>
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
        </>
    );
};

export default Consignments;