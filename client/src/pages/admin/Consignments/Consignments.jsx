import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Archive,
    CalendarClock,
    CalendarDays,
    CarFront,
    CheckCircle2,
    ClipboardList,
    Clock3,
    FileEdit,
    FilePen,
    LayoutGrid,
    ScanSearch,
    Search,
    TableProperties,
    Undo2,
    Users,
    X,
    XCircle,
} from "lucide-react";

import Alert from "../../../components/common/Alert";
import Button from "../../../components/common/Button";
import Pagination from "../../../components/common/Pagination";
import EmptyState from "../../../components/common/EmptyState";
import ExportExcelPill from "../../../components/common/ExportExcelPill";

import ConsignmentStatsRow from "../../../components/consignments/ConsignmentStatsRow";
import ConsignmentSectionTabs from "../../../components/consignments/ConsignmentSectionTabs";
import ConsignmentTable from "../../../components/tables/ConsignmentTable";
import ConsignmentCardGrid from "../../../components/consignments/ConsignmentCardGrid";
import ConsignmentReview from "../../../components/consignments/ConsignmentReview";
import VerifyValidIdDialog from "../../../components/admin/VerifyValidIdDialog";
import OperatorCardGrid from "../../../components/consignments/OperatorCardGrid";
import InspectionCalendarPanel from "../../../components/consignments/InspectionCalendarPanel";
import ConsignmentAppointmentsPanel from "../../../components/consignments/ConsignmentAppointmentsPanel";
import PendingVehiclesPanel from "../../../components/consignments/PendingVehiclesPanel";

import ApproveConsignmentDialog from "../../../components/consignments/ApproveConsignmentDialog";
import RejectConsignmentDialog from "../../../components/consignments/RejectConsignmentDialog";
import RequestRevisionDialog from "../../../components/consignments/RequestRevisionDialog";
import ArchiveConsignmentDialog from "../../../components/consignments/ArchiveConsignmentDialog";
import RescheduleReviewDialog from "../../../components/consignments/RescheduleReviewDialog";
import InspectConsignmentDialog from "../../../components/consignments/InspectConsignmentDialog";
import NewConsignmentDialog from "../../../components/consignments/NewConsignmentDialog";

import {
    ACTIVE_PILL_SPRING,
} from "../../../constants/animations";

import useConsignments from "../../../hooks/consignments/useConsignments";
import usePendingVehicles from "../../../hooks/pendingVehicles/usePendingVehicles";
import { usePayouts } from "../../../hooks/payouts/usePayouts";
import useUser from "../../../hooks/users/useUser";
import useToast from "../../../hooks/toast/useToast";
import { getConsignments as fetchConsignmentsApi } from "../../../api/consignmentApi";
import {
    exportPartnersToExcel,
    getExportErrorMessage,
} from "../../../api/exportApi";
import {
    downloadBlob,
    manilaDateStamp,
} from "../../../utils/downloadFile";

const VIEW_STORAGE_KEY = "consignment-view";
const PAGE_SIZE = 12;

const SECTION_CONTENT_VARIANTS = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
};

/* Statuses still being worked on — the list's default (no card selected). */
const OPEN_STATUSES = ["Draft", "Pending", "Under Review", "Revision Requested"];

/* Heading wording for a card-selected list. */
const STATUS_LIST_LABELS = {
    Draft: "Draft",
    Pending: "Awaiting review",
    "Under Review": "Under review",
    "Revision Requested": "Revision requested",
};

const Consignments = () => {
    const {
        consignments,
        loading,
        error,
        getConsignments,
        submitConsignment,
        reviewConsignment,
        inspectConsignment,
        approveConsignment,
        archiveConsignment,
        restoreConsignment,
        approveReschedule,
        rejectReschedule,
    } = useConsignments();

    const { counts: pendingVehicleCounts, loadPendingVehicleCounts } =
        usePendingVehicles();

    const { settings: payoutSettings, loadPayoutSettings } = usePayouts();
    const platformCommissionRate =
        payoutSettings?.platformCommissionRate ?? 10;

    const { verifyValidId, unverifyValidId } = useUser();

    const toast = useToast();

    const [section, setSection] = useState("applications");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("All");
    const [page, setPage] = useState(1);
    const [expandedRows, setExpandedRows] = useState([]);
    const [viewMode, setViewMode] = useState(
        () => localStorage.getItem(VIEW_STORAGE_KEY) ?? "table"
    );

    // Archived consignments are excluded from the default (active) list, so the
    // "Archived" filter loads them into their own bucket. The active list and
    // therefore the stat tiles stay accurate.
    const [archivedList, setArchivedList] = useState([]);
    const [archivedLoading, setArchivedLoading] = useState(false);

    const [exportingPartners, setExportingPartners] = useState(false);

    /* ------------------------------- dialogs ------------------------------- */

    const [reviewTarget, setReviewTarget] = useState(null);
    // The partner whose ID the Verify dialog is open for.
    const [verifyIdTarget, setVerifyIdTarget] = useState(null);
    const [verifyIdSubmitting, setVerifyIdSubmitting] = useState(false);
    const [editingConsignment, setEditingConsignment] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const emptyDialog = { open: false, consignment: null, loading: false };
    const [approveDialog, setApproveDialog] = useState(emptyDialog);
    const [rejectDialog, setRejectDialog] = useState(emptyDialog);
    const [revisionDialog, setRevisionDialog] = useState(emptyDialog);
    const [inspectionDialog, setInspectionDialog] = useState(emptyDialog);
    const [rescheduleDialog, setRescheduleDialog] = useState(emptyDialog);
    const [archiveDialog, setArchiveDialog] = useState({
        open: false,
        mode: "archive",
        consignment: null,
        loading: false,
    });

    /* ------------------------------- effects ------------------------------ */

    useEffect(() => {
        getConsignments();
    }, [getConsignments]);

    useEffect(() => {
        loadPendingVehicleCounts();
    }, [loadPendingVehicleCounts]);

    useEffect(() => {
        loadPayoutSettings();
    }, [loadPayoutSettings]);

    useEffect(() => {
        localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
        if (viewMode !== "table") {
            setExpandedRows([]);
        }
    }, [viewMode]);

    useEffect(() => {
        setPage(1);
    }, [search, status, section]);

    useEffect(() => {
        if (status !== "Archived") {
            return;
        }
        let cancelled = false;
        setArchivedLoading(true);
        fetchConsignmentsApi({ status: "Archived" })
            .then(({ data }) => {
                if (!cancelled) setArchivedList(data?.data ?? []);
            })
            .catch(() => {
                if (!cancelled) setArchivedList([]);
            })
            .finally(() => {
                if (!cancelled) setArchivedLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [status]);

    /* ------------------------------- derived ----------------------------- */

    /* With no status card selected, the list shows the open applications —
       still being worked on. Settled ones (Approved, Rejected, Withdrawn,
       Archived) appear only when their card is clicked. `All` counts
       that open set. */
    const statusCounts = useMemo(() => {
        const counts = { All: 0 };
        consignments.forEach((consignment) => {
            const current = consignment.application?.status;
            if (current) {
                counts[current] = (counts[current] || 0) + 1;
                if (OPEN_STATUSES.includes(current)) counts.All += 1;
            }
        });
        counts.Archived = archivedList.length;
        return counts;
    }, [consignments, archivedList]);

    const approvedOperators = useMemo(
        () =>
            consignments.filter(
                (c) => c.application?.status === "Approved"
            ),
        [consignments]
    );

    const sourceList =
        status === "Archived" ? archivedList : consignments;

    const filteredConsignments = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return sourceList.filter((consignment) => {
            const applicant = consignment.snapshots?.applicant;
            const vehicle = consignment.snapshots?.vehicle;

            const haystack = [
                consignment.consignmentCode,
                applicant?.organization?.name,
                applicant?.identity?.displayName,
                vehicle?.brand,
                vehicle?.model,
                vehicle?.variant,
                vehicle?.plateNumber,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch = !keyword || haystack.includes(keyword);
            const current = consignment.application?.status;
            const matchesStatus =
                status === "All"
                    ? OPEN_STATUSES.includes(current)
                    : current === status;

            return matchesSearch && matchesStatus;
        });
    }, [sourceList, search, status]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredConsignments.length / PAGE_SIZE)
    );

    const pagedConsignments = useMemo(
        () =>
            filteredConsignments.slice(
                (page - 1) * PAGE_SIZE,
                page * PAGE_SIZE
            ),
        [filteredConsignments, page]
    );

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const listLoading =
        status === "Archived" ? archivedLoading : loading;

    /*
     * These status cards only mean something on the Applications section
     * (that's the table that actually reads `status`) - so clicking one
     * from Partners/Appointments/Calendar/Pending Vehicles has to jump back
     * there too, not just set the status underneath a section that ignores
     * it. `active` mirrors that: a card never reads as selected while its
     * filter isn't the one actually driving the visible list.
     */
    const goToStatus = (value) => {
        setSearch("");
        setSection("applications");
        setStatus((current) =>
            current === value && section === "applications" ? "All" : value
        );
    };

    const isActiveStatus = (value) =>
        section === "applications" && status === value;

    const statItems = [
        {
            label: "Drafts",
            value: statusCounts.Draft ?? 0,
            icon: FilePen,
            tone: "sky",
            onClick: () => goToStatus("Draft"),
            active: isActiveStatus("Draft"),
        },
        {
            label: "Awaiting Review",
            value: statusCounts.Pending ?? 0,
            icon: Clock3,
            tone: "amber",
            onClick: () => goToStatus("Pending"),
            active: isActiveStatus("Pending"),
        },
        {
            label: "Under Review",
            value: statusCounts["Under Review"] ?? 0,
            icon: ScanSearch,
            tone: "blue",
            onClick: () => goToStatus("Under Review"),
            active: isActiveStatus("Under Review"),
        },
        {
            label: "Approved Partners",
            value: statusCounts.Approved ?? 0,
            icon: CheckCircle2,
            tone: "green",
            onClick: () => goToStatus("Approved"),
            active: isActiveStatus("Approved"),
        },
        {
            label: "Pending Vehicles",
            value: pendingVehicleCounts?.total ?? 0,
            icon: CarFront,
            tone: "violet",
            onClick: () => changeSection("pending-vehicles"),
            active: section === "pending-vehicles",
        },
        {
            label: "Withdrawn",
            value: statusCounts.Withdrawn ?? 0,
            icon: Undo2,
            tone: "slate",
            onClick: () => goToStatus("Withdrawn"),
            active: isActiveStatus("Withdrawn"),
        },
        {
            label: "Rejected",
            value: statusCounts.Rejected ?? 0,
            icon: XCircle,
            tone: "orange",
            onClick: () => goToStatus("Rejected"),
            active: isActiveStatus("Rejected"),
        },
        {
            label: "Revision Requested",
            value: statusCounts["Revision Requested"] ?? 0,
            icon: FileEdit,
            tone: "purple",
            onClick: () => goToStatus("Revision Requested"),
            active: isActiveStatus("Revision Requested"),
        },
        {
            label: "Archived",
            value: statusCounts.Archived ?? 0,
            icon: Archive,
            tone: "gray",
            onClick: () => goToStatus("Archived"),
            active: isActiveStatus("Archived"),
        },
    ];

    const sections = [
        {
            value: "applications",
            label: "Applications",
            icon: ClipboardList,
            count: statusCounts.All,
        },
        { value: "operators", label: "Partners", icon: Users },
        {
            value: "appointments",
            label: "Appointments",
            icon: CalendarClock,
        },
        {
            value: "calendar",
            label: "Inspection Calendar",
            icon: CalendarDays,
        },
        {
            value: "pending-vehicles",
            label: "Pending Vehicles",
            icon: CarFront,
            count: pendingVehicleCounts?.total ?? 0,
        },
    ];

    const changeSection = (next) => {
        setSearch("");
        setStatus("All");
        setSection(next);
    };

    /* The Partners tab's list: one sheet per partner, one per approved
       vehicle. */
    const handleExportPartners = async () => {
        setExportingPartners(true);

        try {
            const file = await exportPartnersToExcel();

            downloadBlob(
                file,
                `approved-partners-${manilaDateStamp()}.xlsx`
            );

            toast.success(
                `${approvedOperators.length.toLocaleString()} approved vehicle${approvedOperators.length === 1 ? "" : "s"} exported.`,
                "Export ready"
            );
        } catch (exportError) {
            toast.error(
                await getExportErrorMessage(exportError),
                "Export failed"
            );
        } finally {
            setExportingPartners(false);
        }
    };

    /* ------------------------------ handlers ----------------------------- */

    const refreshList = () =>
        getConsignments(
            status === "Archived" ? { status: "Archived" } : undefined
        );

    const handleExpandAll = () =>
        setExpandedRows(pagedConsignments.map((c) => c._id));
    const handleCollapseAll = () => setExpandedRows([]);

    const handleView = (consignment) => setReviewTarget(consignment);
    const handleCloseReview = () => setReviewTarget(null);

    const handleEdit = (consignment) => {
        setEditingConsignment(consignment);
        setEditDialogOpen(true);
    };

    const handleSubmit = async (consignment) => {
        try {
            await submitConsignment(consignment._id).unwrap();
            toast.success("Consignment submitted successfully.");
        } catch (err) {
            toast.error(err?.message || "Failed to submit consignment.");
        }
    };

    const handleReview = async (consignment) => {
        try {
            await reviewConsignment({
                id: consignment._id,
                payload: { decision: "review" },
            }).unwrap();
            toast.success("Application moved to Under Review.");
            await refreshList();
        } catch (err) {
            toast.error(err?.message || "Failed to start review.");
        }
    };

    const handleApprove = (consignment) =>
        setApproveDialog({ open: true, consignment, loading: false });

    const confirmApprove = async (payload) => {
        try {
            setApproveDialog((prev) => ({ ...prev, loading: true }));
            await approveConsignment({
                id: approveDialog.consignment._id,
                payload,
            }).unwrap();
            toast.success("Consignment approved successfully.");
            setApproveDialog(emptyDialog);
        } catch (err) {
            setApproveDialog((prev) => ({ ...prev, loading: false }));
            toast.error(err?.message || "Failed to approve consignment.");
        }
    };

    const handleReject = (consignment) =>
        setRejectDialog({ open: true, consignment, loading: false });

    const confirmReject = async (payload) => {
        try {
            setRejectDialog((prev) => ({ ...prev, loading: true }));
            await reviewConsignment({
                id: rejectDialog.consignment._id,
                payload: { decision: "reject", ...payload },
            }).unwrap();
            toast.success("Consignment rejected successfully.");
            setRejectDialog(emptyDialog);
        } catch (err) {
            setRejectDialog((prev) => ({ ...prev, loading: false }));
            toast.error(err?.message || "Failed to reject consignment.");
        }
    };

    const handleRequestRevision = (consignment) =>
        setRevisionDialog({ open: true, consignment, loading: false });

    const confirmRevision = async (payload) => {
        try {
            setRevisionDialog((prev) => ({ ...prev, loading: true }));
            await reviewConsignment({
                id: revisionDialog.consignment._id,
                payload: { decision: "revision", ...payload },
            }).unwrap();
            toast.success("Revision requested successfully.");
            setRevisionDialog(emptyDialog);
        } catch (err) {
            setRevisionDialog((prev) => ({ ...prev, loading: false }));
            toast.error(err?.message || "Failed to request revision.");
        }
    };

    const handleInspect = (consignment) =>
        setInspectionDialog({ open: true, consignment, loading: false });

    const confirmInspect = async (payload) => {
        try {
            setInspectionDialog((prev) => ({ ...prev, loading: true }));
            await inspectConsignment({
                id: inspectionDialog.consignment._id,
                payload,
            }).unwrap();
            toast.success("Vehicle inspection completed successfully.");
            setInspectionDialog(emptyDialog);
        } catch (err) {
            setInspectionDialog((prev) => ({ ...prev, loading: false }));
            toast.error(err?.message || "Failed to complete inspection.");
        }
    };

    const handleArchive = (consignment, mode = "archive") =>
        setArchiveDialog({ open: true, mode, consignment, loading: false });

    const handleRestore = (consignment) =>
        setArchiveDialog({
            open: true,
            mode: "restore",
            consignment,
            loading: false,
        });

    const confirmArchive = async (payload) => {
        try {
            setArchiveDialog((prev) => ({ ...prev, loading: true }));
            if (archiveDialog.mode === "archive") {
                await archiveConsignment({
                    id: archiveDialog.consignment._id,
                    payload,
                }).unwrap();
                toast.success("Consignment archived successfully.");
            } else {
                await restoreConsignment(
                    archiveDialog.consignment._id
                ).unwrap();
                toast.success("Consignment restored successfully.");
            }
            setArchiveDialog({
                open: false,
                mode: "archive",
                consignment: null,
                loading: false,
            });
            getConsignments();
            if (status === "Archived") {
                setArchivedLoading(true);
                fetchConsignmentsApi({ status: "Archived" })
                    .then(({ data }) => setArchivedList(data?.data ?? []))
                    .catch(() => setArchivedList([]))
                    .finally(() => setArchivedLoading(false));
            }
        } catch (err) {
            setArchiveDialog((prev) => ({ ...prev, loading: false }));
            toast.error(err?.message || "Failed to update consignment.");
        }
    };

    const handleReviewReschedule = (consignment) =>
        setRescheduleDialog({ open: true, consignment, loading: false });

    const closeRescheduleDialog = () => setRescheduleDialog(emptyDialog);

    const confirmApproveReschedule = async (remarks) => {
        try {
            setRescheduleDialog((prev) => ({ ...prev, loading: true }));
            await approveReschedule({
                consignmentId: rescheduleDialog.consignment._id,
                data: { remarks },
            }).unwrap();
            toast.success("Reschedule request approved.");
            closeRescheduleDialog();
            await refreshList();
        } catch (err) {
            setRescheduleDialog((prev) => ({ ...prev, loading: false }));
            toast.error(
                err?.message || "Failed to approve reschedule request."
            );
        }
    };

    const confirmRejectReschedule = async (remarks) => {
        try {
            setRescheduleDialog((prev) => ({ ...prev, loading: true }));
            await rejectReschedule({
                consignmentId: rescheduleDialog.consignment._id,
                data: { remarks },
            }).unwrap();
            toast.success("Reschedule request rejected.");
            closeRescheduleDialog();
            await refreshList();
        } catch (err) {
            setRescheduleDialog((prev) => ({ ...prev, loading: false }));
            toast.error(
                err?.message || "Failed to reject reschedule request."
            );
        }
    };

    // Opens the Verify dialog, which also records the ID's expiry date.
    const handleVerifyOperatorId = (operator) => {
        if (operator?._id ?? operator?.id) {
            setVerifyIdTarget(operator);
        }
    };

    const confirmVerifyOperatorId = async (payload) => {
        const operatorId = verifyIdTarget?._id ?? verifyIdTarget?.id;
        if (!operatorId) return;
        setVerifyIdSubmitting(true);
        try {
            const response = await verifyValidId(operatorId, payload);
            toast.success("Partner's valid ID verified.");
            setVerifyIdTarget(null);
            setReviewTarget((prev) =>
                prev
                    ? {
                          ...prev,
                          audit: {
                              ...prev.audit,
                              createdBy: {
                                  ...prev.audit?.createdBy,
                                  isVerified: true,
                                  validIdExpirationDate:
                                      response?.data
                                          ?.validIdExpirationDate ??
                                      null,
                              },
                          },
                      }
                    : prev
            );
            await refreshList();
        } catch (err) {
            toast.error(
                typeof err === "string"
                    ? err
                    : err?.message || "Failed to verify valid ID."
            );
        } finally {
            setVerifyIdSubmitting(false);
        }
    };

    const handleUnverifyOperatorId = async (operator) => {
        const operatorId = operator?._id ?? operator?.id;
        if (!operatorId) return;
        try {
            await unverifyValidId(operatorId);
            toast.success("Partner's valid ID unverified.");
            setReviewTarget((prev) =>
                prev
                    ? {
                          ...prev,
                          audit: {
                              ...prev.audit,
                              createdBy: {
                                  ...prev.audit?.createdBy,
                                  isVerified: false,
                              },
                          },
                      }
                    : prev
            );
            await refreshList();
        } catch (err) {
            toast.error(err?.message || "Failed to unverify valid ID.");
        }
    };

    const workflowHandlers = {
        onView: handleView,
        onEdit: handleEdit,
        onSubmit: handleSubmit,
        onReview: handleReview,
        onInspect: handleInspect,
        onApprove: handleApprove,
        onReject: handleReject,
        onRequestRevision: handleRequestRevision,
        onArchive: handleArchive,
        onRestore: handleRestore,
        onReviewReschedule: handleReviewReschedule,
    };

    /* -------------------------------- render ----------------------------- */

    return (
        <>
            <div className="space-y-6">
                {/* Search + Table/Cards — one pill, on top. Only the
                    Applications list uses them. */}
                {section === "applications" && (
                    <div className="mx-auto flex w-full max-w-4xl items-center gap-1 rounded-full border border-gray-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
                        <div className="relative min-w-0 flex-1">
                            <Search
                                size={17}
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search code, partner, vehicle, plate…"
                                aria-label="Search applications"
                                className="h-10 w-full rounded-full bg-transparent pl-11 pr-9 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:bg-gray-100/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-800/60"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    aria-label="Clear search"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <span
                            aria-hidden="true"
                            className="h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700"
                        />

                        <div
                            role="tablist"
                            aria-label="View"
                            className="flex shrink-0 items-center gap-0.5"
                        >
                            {[
                                { value: "table", label: "Table", icon: TableProperties },
                                { value: "cards", label: "Cards", icon: LayoutGrid },
                            ].map((option) => {
                                const active = viewMode === option.value;
                                const Icon = option.icon;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setViewMode(option.value)}
                                        className={`relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                                            active
                                                ? "text-white"
                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                        }`}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="consignment-view-pill"
                                                className="absolute inset-0 rounded-full bg-blue-600 shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/20"
                                                transition={ACTIVE_PILL_SPRING}
                                            />
                                        )}
                                        <Icon size={14} className="relative" />
                                        <span className="relative hidden sm:inline">
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <ConsignmentSectionTabs
                    variant="pill"
                    size="sm"
                    value={section}
                    onChange={changeSection}
                    sections={sections}
                />

                <ConsignmentStatsRow items={statItems} />

                <AnimatePresence mode="wait">
                    <motion.div
                        key={section}
                        variants={SECTION_CONTENT_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.2 }}
                    >
                        {section === "applications" && (
                            <div className="space-y-4">
                                {error && (
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <div className="flex-1">
                                            <Alert
                                                variant="error"
                                                message={
                                                    typeof error === "string"
                                                        ? error
                                                        : error?.message ||
                                                          "Failed to load consignments."
                                                }
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => getConsignments()}
                                        >
                                            Retry
                                        </Button>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                        {status === "All"
                                            ? "Open applications"
                                            : `${STATUS_LIST_LABELS[status] ?? status} applications`}
                                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                            {filteredConsignments.length}
                                        </span>
                                    </p>

                                    {status !== "All" && (
                                        <button
                                            type="button"
                                            onClick={() => setStatus("All")}
                                            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                            Show open applications
                                        </button>
                                    )}
                                </div>

                                <AnimatePresence mode="wait">
                                    {viewMode === "table" ? (
                                        <motion.div
                                            key="table"
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -12 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ConsignmentTable
                                                consignments={pagedConsignments}
                                                loading={listLoading}
                                                expandedRows={expandedRows}
                                                onExpandedRowsChange={
                                                    setExpandedRows
                                                }
                                                onExpandAll={handleExpandAll}
                                                onCollapseAll={
                                                    handleCollapseAll
                                                }
                                                {...workflowHandlers}
                                            />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="cards"
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -12 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            {!listLoading &&
                                            filteredConsignments.length ===
                                                0 ? (
                                                <EmptyState
                                                    icon={ClipboardList}
                                                    title="No applications found"
                                                    description="No consignment applications match the current search or filter."
                                                />
                                            ) : (
                                                <ConsignmentCardGrid
                                                    consignments={
                                                        pagedConsignments
                                                    }
                                                    loading={listLoading}
                                                    {...workflowHandlers}
                                                />
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {!listLoading &&
                                    filteredConsignments.length > 0 && (
                                        <div className="flex flex-col items-center gap-3 pt-1 sm:flex-row sm:justify-between">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                Showing{" "}
                                                {pagedConsignments.length} of{" "}
                                                {filteredConsignments.length}{" "}
                                                {filteredConsignments.length ===
                                                1
                                                    ? "application"
                                                    : "applications"}
                                            </p>

                                            {totalPages > 1 && (
                                                <Pagination
                                                    currentPage={page}
                                                    totalPages={totalPages}
                                                    onPageChange={setPage}
                                                />
                                            )}
                                        </div>
                                    )}
                            </div>
                        )}

                        {section === "operators" && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                        Approved partners
                                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                            {approvedOperators.length}
                                        </span>
                                    </p>

                                    <ExportExcelPill
                                        onClick={handleExportPartners}
                                        loading={exportingPartners}
                                        disabled={
                                            loading ||
                                            approvedOperators.length === 0
                                        }
                                    />
                                </div>

                                <OperatorCardGrid
                                    operators={approvedOperators}
                                    loading={loading}
                                />
                            </div>
                        )}

                        {section === "appointments" && (
                            <ConsignmentAppointmentsPanel
                                consignments={consignments}
                                loading={loading}
                                showApplicant
                                onView={handleView}
                            />
                        )}

                        {section === "calendar" && <InspectionCalendarPanel />}

                        {section === "pending-vehicles" && (
                            <PendingVehiclesPanel />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ------------------------- application dialogs ------------------------- */}

            <ConsignmentReview
                open={Boolean(reviewTarget)}
                consignment={reviewTarget}
                onClose={handleCloseReview}
                onReview={handleReview}
                onInspect={handleInspect}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestRevision={handleRequestRevision}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onReviewReschedule={handleReviewReschedule}
                onVerifyId={handleVerifyOperatorId}
                onUnverifyId={handleUnverifyOperatorId}
            />

            <VerifyValidIdDialog
                isOpen={Boolean(verifyIdTarget)}
                user={verifyIdTarget}
                loading={verifyIdSubmitting}
                onClose={() => {
                    if (!verifyIdSubmitting) setVerifyIdTarget(null);
                }}
                onConfirm={confirmVerifyOperatorId}
            />

            <NewConsignmentDialog
                open={editDialogOpen}
                mode="edit"
                consignment={editingConsignment}
                onClose={() => {
                    setEditDialogOpen(false);
                    setEditingConsignment(null);
                }}
                onSuccess={async () => {
                    setEditDialogOpen(false);
                    setEditingConsignment(null);
                    await getConsignments();
                }}
            />

            <ApproveConsignmentDialog
                open={approveDialog.open}
                consignment={approveDialog.consignment}
                loading={approveDialog.loading}
                platformCommissionRate={platformCommissionRate}
                onClose={() => setApproveDialog(emptyDialog)}
                onSubmit={confirmApprove}
            />

            <RejectConsignmentDialog
                open={rejectDialog.open}
                consignment={rejectDialog.consignment}
                loading={rejectDialog.loading}
                onClose={() => setRejectDialog(emptyDialog)}
                onSubmit={confirmReject}
            />

            <RequestRevisionDialog
                open={revisionDialog.open}
                consignment={revisionDialog.consignment}
                loading={revisionDialog.loading}
                onClose={() => setRevisionDialog(emptyDialog)}
                onSubmit={confirmRevision}
            />

            <InspectConsignmentDialog
                open={inspectionDialog.open}
                consignment={inspectionDialog.consignment}
                loading={inspectionDialog.loading}
                onClose={() => setInspectionDialog(emptyDialog)}
                onSubmit={confirmInspect}
            />

            <ArchiveConsignmentDialog
                open={archiveDialog.open}
                consignment={archiveDialog.consignment}
                loading={archiveDialog.loading}
                mode={archiveDialog.mode}
                onClose={() =>
                    setArchiveDialog({
                        open: false,
                        mode: "archive",
                        consignment: null,
                        loading: false,
                    })
                }
                onSubmit={confirmArchive}
            />

            <RescheduleReviewDialog
                open={rescheduleDialog.open}
                consignment={rescheduleDialog.consignment}
                loading={rescheduleDialog.loading}
                onClose={closeRescheduleDialog}
                onApprove={confirmApproveReschedule}
                onReject={confirmRejectReschedule}
            />
        </>
    );
};

export default Consignments;
