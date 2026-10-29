import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    Archive,
    Building2,
    Car,
    CheckCircle2,
    ChevronsDownUp,
    ChevronsUpDown,
    Handshake,
    LayoutGrid,
    Layers,
    Plus,
    Search,
    SlidersHorizontal,
    TableProperties,
    X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import Pagination from "../../../components/common/Pagination";
import Modal from "../../../components/common/Modal";
import ExportExcelPill from "../../../components/common/ExportExcelPill";

import {
    ACTIVE_PILL_SPRING,
    PAGE_TRANSITION,
} from "../../../constants/animations";
import {
    STAGGER_CONTAINER,
    STAGGER_ITEM,
} from "../../../constants/motionConstants";

import VehicleDialogs from "../../../components/modals/VehicleDialogs";
import VehicleArchiveDialog from "../../../components/modals/VehicleArchiveDialog";
import RenewRegistrationDialog from "../../../components/vehicle/RenewRegistrationDialog";
import AdminAvailabilityCalendarDialog from "../../../components/vehicle/AdminAvailabilityCalendarDialog";
import VehicleFilters from "../../../components/filters/VehicleFilters";
import VehicleCategoryFilters from "../../../components/filters/VehicleCategoryFilters";
import VehicleCategoryDialogs from "../../../components/modals/VehicleCategoryDialogs";
import VehicleCategoryAssignDialog from "../../../components/modals/VehicleCategoryAssignDialog";
import VehicleCategoryVehicleRemoveDialog from "../../../components/modals/VehicleCategoryVehicleRemoveDialog";
import VehicleCategoryDeleteDialog from "../../../components/modals/VehicleCategoryDeleteDialog";

import VehicleTable from "../../../components/tables/VehicleTable";
import VehicleCategoryTable from "../../../components/tables/VehicleCategoryTable";

import VehicleCardList from "../../../components/vehicle/VehicleCardList";
import VehicleMaintenanceDialog from "../../../components/vehicle/VehicleMaintenanceDialog";
import { VEHICLE_MAINTENANCE_MODE } from "../../../constants/vehicleConstants";
import VehicleAvailabilityRequestsPanel from "../../../components/vehicle/VehicleAvailabilityRequestsPanel";

import { getVehicleBookingSchedule } from "../../../api/vehicleApi";
import {
    exportVehiclesToExcel,
    getExportErrorMessage,
} from "../../../api/exportApi";
import {
    downloadBlob,
    manilaDateStamp,
} from "../../../utils/downloadFile";

import useVehicle from "../../../hooks/vehicles/useVehicle";
import useVehicleCategory from "../../../hooks/categories";
import { usePayouts } from "../../../hooks/payouts/usePayouts";
import useToast from "../../../hooks/toast/useToast";
import useMediaQuery from "../../../hooks/ui/useMediaQuery";

const VIEW_STORAGE_KEY = "vehicle-view";

/* Pinned vehicles are a per-admin, per-browser convenience — newest pin
   first, so a just-pinned vehicle lands top-left. */
const PIN_STORAGE_KEY = "admin-fleet-pinned-vehicles";

const readPinnedIds = () => {
    try {
        const stored = JSON.parse(
            localStorage.getItem(PIN_STORAGE_KEY) ?? "[]"
        );

        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
};

const VEHICLE_PAGE_SIZE = 24;

// Mirrors MAX_EXPORT_VEHICLES on the server.
const MAX_EXPORT_VEHICLES = 3000;
const CATEGORY_PAGE_SIZE = 10;

const FLEET_TONES = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    emerald:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    indigo:
        "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    purple:
        "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
};

/* Doubles as a quick filter when onClick is given — same pattern as the
   admin Bookings page's KpiCard, kept consistent across the admin section. */
const FleetStatCard = ({
    label,
    value,
    hint,
    icon: Icon,
    tone,
    onClick,
    active,
}) => {
    const Tag = onClick ? "button" : "div";

    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-all ${
                onClick
                    ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                    : ""
            } ${
                active
                    ? "border-blue-300 bg-blue-50/70 ring-2 ring-blue-200 dark:border-blue-500/50 dark:bg-blue-950/30 dark:ring-blue-500/20"
                    : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {label}
                </p>
                <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        FLEET_TONES[tone] ?? FLEET_TONES.blue
                    }`}
                >
                    <Icon size={17} />
                </span>
            </div>
            <p className="mt-3 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                {value}
            </p>
            {hint && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {hint}
                </p>
            )}
        </Tag>
    );
};

const INITIAL_FILTERS = {
    ownership: "",
    vehicleType: "",
    status: "",
    condition: "",
    category: "",
    isFeatured: "",
    bookingEnabled: "",
};

const INITIAL_DIALOG = {
    open: false,
    mode: "create",
    vehicle: null,
};

const INITIAL_CATEGORY_FILTERS = {
    search: "",
    vehicleType: "",
    status: "",
};

const INITIAL_CATEGORY_DIALOG = {
    open: false,
    mode: "create",
    vehicleCategory: null,
};

const INITIAL_ASSIGN_DIALOG = {
    open: false,
    category: null,
    search: "",
    selectedVehicles: [],
    loading: false,
};

const INITIAL_REMOVE_VEHICLE_DIALOG = {
    open: false,
    vehicle: null,
    category: null,
    loading: false,
};

const INITIAL_DELETE_DIALOG = {
    open: false,
    category: null,
    loading: false,
};

const Vehicles = () => {
    const {
        vehicles,
        counts,
        loading,
        getVehicles,
        getVehicleCounts,
        archiveVehicle,
        restoreVehicle,
        updateVehicle,
    } = useVehicle();

    const {
        vehicleCategories,
        loading: categoryLoading,
        getVehicleCategories,
        deleteVehicleCategory,
    } = useVehicleCategory();

    const { settings: payoutSettings, loadPayoutSettings } = usePayouts();
    const platformCommissionRate =
        payoutSettings?.platformCommissionRate ?? 10;

    const toast = useToast();

    /* Deep links (e.g. from the dashboard leaderboard) can open the fleet
       pre-searched: /admin/vehicles?search=ABC123&tab=archived */
    const [searchParams] = useSearchParams();

    const [search, setSearch] =
        useState(() => searchParams.get("search") ?? "");

    const [filters, setFilters] =
        useState(INITIAL_FILTERS);

    const [activeTab, setActiveTab] =
        useState(() =>
            searchParams.get("tab") === "archived"
                ? "archived"
                : "active"
        );

    const [showFilters, setShowFilters] =
        useState(false);

    const [dialog, setDialog] =
        useState(INITIAL_DIALOG);

    const [
    archiveDialog,
    setArchiveDialog,
    ] = useState({
        open: false,
        mode: "archive",
        vehicle: null,
        loading: false,
    });

    const [
    renewRegistrationDialog,
    setRenewRegistrationDialog,
    ] = useState({
        open: false,
        vehicle: null,
    });

    const [
    availabilityDialog,
    setAvailabilityDialog,
    ] = useState({
        open: false,
        vehicle: null,
    });

    /*
     * Re-derived from the live `vehicles` list (rather than trusting the
     * snapshot captured when the dialog opened) so a just-added or
     * just-removed blocked date shows up in the dialog immediately, without
     * needing to close and reopen it.
     */
    const availabilityDialogVehicle =
        availabilityDialog.vehicle
            ? (vehicles.find(
                  (vehicle) =>
                      vehicle._id ===
                      availabilityDialog.vehicle._id
              ) ?? availabilityDialog.vehicle)
            : null;

    const [
    leavingVehicleId,
    setLeavingVehicleId,
    ] = useState(null);

    const [
    leavingRowId,
    setLeavingRowId,
    ] = useState(null);

    const [
    expandedRows,
    setExpandedRows,
    ] = useState([]);

    const [preferredView, setViewMode] =
        useState(() => {
            return (
                localStorage.getItem(
                    VIEW_STORAGE_KEY
                ) ?? "table"
            );
        });

    // The wide table doesn't fit a phone: cards there, saved choice kept.
    const isPhone = useMediaQuery("(width < 48rem)");
    const viewMode = isPhone ? "cards" : preferredView;

    const [page, setPage] = useState(1);

    const [pinnedIds, setPinnedIds] =
        useState(readPinnedIds);

    // Table's "Next Booking" column. null = not loaded (or failed).
    const [bookingSchedule, setBookingSchedule] =
        useState(null);

    const [exporting, setExporting] = useState(false);

    // Category management state
    const [categoryFilters, setCategoryFilters] =
        useState(INITIAL_CATEGORY_FILTERS);
    
    const [showCategoryFilters, setShowCategoryFilters] =
        useState(false);

    const [showCategoriesModal, setShowCategoriesModal] =
        useState(false);

    const [categoryDialog, setCategoryDialog] =
        useState(INITIAL_CATEGORY_DIALOG);

    const [
    categoryAssignDialog,
    setCategoryAssignDialog,
    ] = useState(INITIAL_ASSIGN_DIALOG);

    const [
    removeVehicleDialog,
    setRemoveVehicleDialog,
    ] = useState(INITIAL_REMOVE_VEHICLE_DIALOG);

    const [
    deleteDialog,
    setDeleteDialog,
    ] = useState(INITIAL_DELETE_DIALOG);

    const [categoryPage, setCategoryPage] = useState(1);

    useEffect(() => {
        const query = {};

        if (activeTab === "archived") {
            query.status = "Archived";
        }

        if (filters.ownership) {
            query.ownership =
                filters.ownership;
        }

        getVehicles(query);
    }, [
        activeTab,
        filters.ownership,
        getVehicles,
    ]);

    useEffect(() => {
        loadPayoutSettings();
    }, [loadPayoutSettings]);

    useEffect(() => {
        localStorage.setItem(
            VIEW_STORAGE_KEY,
            preferredView
        );
    }, [preferredView]);

    useEffect(() => {
        if (viewMode !== "table") {
            setExpandedRows([]);
        }
    }, [viewMode]);

    useEffect(() => {
        try {
            localStorage.setItem(
                PIN_STORAGE_KEY,
                JSON.stringify(pinnedIds)
            );
        } catch {
            // Storage blocked: pins just last for this visit.
        }
    }, [pinnedIds]);

    /* Re-fetched whenever the vehicle list reloads, so a booking made or
       a rental returned since shows up with the rest of the refresh. */
    useEffect(() => {
        if (
            viewMode !== "table" ||
            activeTab === "archived"
        ) {
            return;
        }

        let cancelled = false;

        getVehicleBookingSchedule()
            .then((response) => {
                if (!cancelled) {
                    setBookingSchedule(
                        response?.data ?? {}
                    );
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setBookingSchedule(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [vehicles, viewMode, activeTab]);

    const handleTogglePin = useCallback(
        (vehicle) => {
            setPinnedIds((previous) =>
                previous.includes(vehicle._id)
                    ? previous.filter(
                          (id) => id !== vehicle._id
                      )
                    : [vehicle._id, ...previous]
            );
        },
        []
    );

    useEffect(() => {
        getVehicleCounts({
            status:
                activeTab === "archived"
                    ? "Archived"
                    : undefined,
            ownership:
                filters.ownership ||
                undefined,
        });
    }, [
        activeTab,
        filters.ownership,
        getVehicleCounts,
    ]);

    // Category management effects
    useEffect(() => {
        getVehicleCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredVehicles = useMemo(() => {
        const keyword =
            search.trim().toLowerCase();

        return vehicles.filter(
            (vehicle) => {
                const matchesSearch =
                    !keyword ||
                    [
                        vehicle.brand,
                        vehicle.model,
                        vehicle.plateNumber,
                        vehicle.vehicleCode,
                    ]
                    .filter(Boolean)
                    .some((value) =>
                        value
                            .toString()
                            .toLowerCase()
                            .includes(
                                keyword
                            )
                    );

                const matchesType =
                    !filters.vehicleType ||
                    vehicle.vehicleType ===
                    filters.vehicleType;

                const matchesStatus =
                    !filters.status ||
                    vehicle.status ===
                    filters.status;

                const matchesCondition =
                    !filters.condition ||
                    vehicle.condition ===
                    filters.condition;

                const matchesCategory =
                    !filters.category ||
                    vehicle.category
                        ?._id ===
                    filters.category ||
                    vehicle.category ===
                    filters.category;

                const matchesFeatured =
                    filters.isFeatured ===
                    "" ||
                    vehicle.isFeatured ===
                    (filters.isFeatured ===
                        "true");

                const matchesBooking =
                    filters.bookingEnabled ===
                    "" ||
                    vehicle.availability
                        ?.bookingEnabled ===
                    (filters.bookingEnabled ===
                        "true");

                return (
                    matchesSearch &&
                    matchesType &&
                    matchesStatus &&
                    matchesCondition &&
                    matchesCategory &&
                    matchesFeatured &&
                    matchesBooking
                );
            }
        );
    }, [
        vehicles,
        search,
        filters,
    ]);

    const filteredCategories =
        useMemo(() => {
            return vehicleCategories.filter(
                (category) => {
                    const matchesSearch =
                        !categoryFilters.search ||
                        category.name
                            .toLowerCase()
                            .includes(
                                categoryFilters.search.toLowerCase()
                            );

                    const matchesVehicleType =
                        !categoryFilters.vehicleType ||
                        category.vehicleType ===
                            categoryFilters.vehicleType;

                    const matchesStatus =
                        !categoryFilters.status ||
                        category.status ===
                            categoryFilters.status;

                    return (
                        matchesSearch &&
                        matchesVehicleType &&
                        matchesStatus
                    );
                }
            );
        }, [
            vehicleCategories,
            categoryFilters,
        ]);

    const totalVehiclePages = Math.max(
        1,
        Math.ceil(
            filteredVehicles.length /
                VEHICLE_PAGE_SIZE
        )
    );

    /* Pinned first (newest pin first), before paging, so pins always sit
       at the top-left of page 1; the rest keep their usual order. */
    const orderedVehicles = useMemo(() => {
        if (!pinnedIds.length) {
            return filteredVehicles;
        }

        const pinRank = new Map(
            pinnedIds.map((id, index) => [id, index])
        );

        const pinned = filteredVehicles
            .filter((vehicle) => pinRank.has(vehicle._id))
            .sort(
                (a, b) =>
                    pinRank.get(a._id) - pinRank.get(b._id)
            );

        return [
            ...pinned,
            ...filteredVehicles.filter(
                (vehicle) => !pinRank.has(vehicle._id)
            ),
        ];
    }, [filteredVehicles, pinnedIds]);

    const pagedVehicles = useMemo(
        () =>
            orderedVehicles.slice(
                (page - 1) * VEHICLE_PAGE_SIZE,
                page * VEHICLE_PAGE_SIZE
            ),
        [orderedVehicles, page]
    );

    useEffect(() => {
        if (page > totalVehiclePages) {
            setPage(totalVehiclePages);
        }
    }, [page, totalVehiclePages]);

    useEffect(() => {
        setPage(1);
    }, [activeTab, search, filters]);

    const totalCategoryPages = Math.max(
        1,
        Math.ceil(
            filteredCategories.length /
                CATEGORY_PAGE_SIZE
        )
    );

    const pagedCategories = useMemo(
        () =>
            filteredCategories.slice(
                (categoryPage - 1) *
                    CATEGORY_PAGE_SIZE,
                categoryPage *
                    CATEGORY_PAGE_SIZE
            ),
        [filteredCategories, categoryPage]
    );

    useEffect(() => {
        if (categoryPage > totalCategoryPages) {
            setCategoryPage(totalCategoryPages);
        }
    }, [categoryPage, totalCategoryPages]);

    useEffect(() => {
        setCategoryPage(1);
    }, [categoryFilters]);

    const [maintenanceVehicle, setMaintenanceVehicle] =
        useState(null);
    // Preselected maintenance type: the off-road button opens on "Off road".
    const [maintenanceMode, setMaintenanceMode] = useState(null);

    const handleOpenMaintenance = (vehicle) => {
        setMaintenanceMode(null);
        setMaintenanceVehicle(vehicle);
    };

    const handleOffRoad = (vehicle) => {
        setMaintenanceMode(VEHICLE_MAINTENANCE_MODE.OFF_ROAD);
        setMaintenanceVehicle(vehicle);
    };

    const refreshVehicles = () =>
        getVehicles(
            activeTab === "archived"
                ? { status: "Archived" }
                : filters.ownership
                  ? { ownership: filters.ownership }
                  : {}
        );

    const handleRestoreVehicle = (
        vehicle
    ) => {
        setArchiveDialog({
            open: true,
            mode: "restore",
            vehicle,
            loading: false,
        });
    };

    const handleAddVehicle = () => {
        setDialog({
            open: true,
            mode: "create",
            vehicle: null,
        });
    };

    const handleEditVehicle = (
        vehicle
    ) => {
        setDialog({
            open: true,
            mode: "edit",
            vehicle,
        });
    };

    const handleViewVehicle = (
        vehicle
    ) => {
        setDialog({
            open: true,
            mode: "view",
            vehicle,
        });
    };

    const handleCloseDialog = () => {
        setDialog(INITIAL_DIALOG);
    };

    const handleArchiveDialogClose =
    () => {
        if (archiveDialog.loading) {
            return;
        }

        setArchiveDialog({
            open: false,
            mode: "archive",
            vehicle: null,
            loading: false,
        });
    };

    const handleArchiveDialogConfirm =
    async () => {
        const {
            vehicle,
            mode,
        } = archiveDialog;

        if (!vehicle) {
            return;
        }

        setArchiveDialog(
            (previous) => ({
                ...previous,
                loading: true,
            })
        );

        try {
            if (mode === "archive") {
                if (viewMode === "cards") {
                    setLeavingVehicleId(
                        vehicle._id
                    );
                } else {
                    setLeavingRowId(
                        vehicle._id
                    );
                }

                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            350
                        )
                );

                await archiveVehicle(
                    vehicle._id
                );
            } else {
                await restoreVehicle(
                    vehicle._id
                );
            }

            await Promise.all([
                getVehicles({
                    status:
                        activeTab ===
                        "archived"
                            ? "Archived"
                            : undefined,
                    ownership:
                        filters.ownership ||
                        undefined,
                }),
                getVehicleCounts({
                    status:
                        activeTab ===
                        "archived"
                            ? "Archived"
                            : undefined,
                }),
            ]);

            toast.success(
                mode === "archive"
                    ? `${vehicle.brand} ${vehicle.model} was archived successfully.`
                    : `${vehicle.brand} ${vehicle.model} was restored successfully.`
            );

        } catch (error) {
            toast.error(
                error?.message ||
                "Something went wrong while updating the vehicle."
            );

        } finally {
            setArchiveDialog({
                open: false,
                mode: "archive",
                vehicle: null,
                loading: false,
            });

            setLeavingVehicleId(null);
            setLeavingRowId(null);
        }
    };

    const handleArchiveVehicle = (
        vehicle
    ) => {
        setArchiveDialog({
            open: true,
            mode: "archive",
            vehicle,
            loading: false,
        });
    };

    const handleRenewRegistration = (
        vehicle
    ) => {
        setRenewRegistrationDialog({
            open: true,
            vehicle,
        });
    };

    const handleRenewRegistrationDialogClose =
    () => {
        setRenewRegistrationDialog({
            open: false,
            vehicle: null,
        });
    };

    const handleManageAvailability = (
        vehicle
    ) => {
        setAvailabilityDialog({
            open: true,
            vehicle,
        });
    };

    const handleAvailabilityDialogClose =
    () => {
        setAvailabilityDialog({
            open: false,
            vehicle: null,
        });
    };

    /* Exactly what's on screen: the current tab, search and filters, every
       page, in the same order (pinned first). */
    const handleExport = async () => {
        const count = orderedVehicles.length;

        if (count > MAX_EXPORT_VEHICLES) {
            toast.error(
                `That's ${count.toLocaleString()} vehicles — export up to ${MAX_EXPORT_VEHICLES.toLocaleString()} at a time. Narrow the filters and try again.`,
                "Too many to export"
            );
            return;
        }

        setExporting(true);

        try {
            const file = await exportVehiclesToExcel(
                orderedVehicles.map((vehicle) => vehicle._id)
            );

            downloadBlob(
                file,
                `fleet-${activeTab}-${manilaDateStamp()}.xlsx`
            );

            toast.success(
                `${count.toLocaleString()} vehicle${count === 1 ? "" : "s"} exported.`,
                "Export ready"
            );
        } catch (exportError) {
            toast.error(
                await getExportErrorMessage(exportError),
                "Export failed"
            );
        } finally {
            setExporting(false);
        }
    };

    const handleResetFilters = () => {
        setSearch("");
        setFilters(INITIAL_FILTERS);
    };

    const handleExpandAll = () => {
        setExpandedRows(
            filteredVehicles.map(
                (vehicle) =>
                    vehicle._id
            )
        );
    };

    const handleCollapseAll =
        () => {
            setExpandedRows([]);
        };

    // Category management handlers
    const handleCategorySearch =
        useCallback((value) => {
            setCategoryFilters((previous) => ({
                ...previous,
                search: value,
            }));
        }, []);

    const handleCategoryCreate =
        useCallback(() => {
            setCategoryDialog({
                open: true,
                mode: "create",
                vehicleCategory: null,
            });
        }, []);

    const handleCategoryEdit =
        useCallback((category) => {
            setCategoryDialog({
                open: true,
                mode: "edit",
                vehicleCategory: category,
            });
        }, []);

    const handleCategoryCloseDialog =
        useCallback(() => {
            setCategoryDialog({
                open: false,
                mode: "create",
                vehicleCategory: null,
            });

            getVehicleCategories();
        }, [getVehicleCategories]);

    const handleCategoryDelete =
        useCallback((category) => {
            setDeleteDialog({
                open: true,
                category,
                loading: false,
            });
        }, []);

    const handleCategoryDeleteClose =
        useCallback(() => {
            if (deleteDialog.loading) {
                return;
            }

            setDeleteDialog({
                open: false,
                category: null,
                loading: false,
            });
        }, [deleteDialog.loading]);

    const handleCategoryDeleteConfirm =
        useCallback(async () => {
            if (!deleteDialog.category) {
                return;
            }

            setDeleteDialog((previous) => ({
                ...previous,
                loading: true,
            }));

            try {
                await deleteVehicleCategory(
                    deleteDialog.category._id
                ).unwrap();

                await getVehicleCategories();

                toast.success(
                    "Vehicle category deleted successfully."
                );

                setDeleteDialog({
                    open: false,
                    category: null,
                    loading: false,
                });
            } catch (error) {
                toast.error(
                    error ||
                    "Unable to delete vehicle category."
                );

                setDeleteDialog((previous) => ({
                    ...previous,
                    loading: false,
                }));
            }
        }, [
            deleteDialog.category,
            deleteVehicleCategory,
            getVehicleCategories,
            toast,
        ]);

    const handleRemoveVehicle = useCallback(
        (vehicle, category) => {
            setRemoveVehicleDialog({
                open: true,
                vehicle,
                category,
                loading: false,
            });
        },
        []
    );

    const handleRemoveVehicleClose =
        useCallback(() => {
            if (removeVehicleDialog.loading) {
                return;
            }

            setRemoveVehicleDialog({
                open: false,
                vehicle: null,
                category: null,
                loading: false,
            });
        }, [removeVehicleDialog.loading]);

    const handleRemoveVehicleConfirm =
        useCallback(async () => {
            if (!removeVehicleDialog.vehicle) {
                return;
            }

            setRemoveVehicleDialog((previous) => ({
                ...previous,
                loading: true,
            }));

            try {
                await updateVehicle(
                    removeVehicleDialog.vehicle._id,
                    {
                        category: null,
                    }
                ).unwrap();

                await getVehicleCategories();
                await getVehicles();

                toast.success(
                    "Vehicle removed from category successfully."
                );

                setRemoveVehicleDialog({
                    open: false,
                    vehicle: null,
                    category: null,
                    loading: false,
                });
            } catch (error) {
                toast.error(
                    error?.message ||
                    error ||
                    "Unable to remove vehicle from category."
                );

                setRemoveVehicleDialog((previous) => ({
                    ...previous,
                    loading: false,
                }));
            }
        }, [
            removeVehicleDialog.vehicle,
            updateVehicle,
            getVehicleCategories,
            getVehicles,
            toast,
        ]);

    const handleAssignVehicles =
        useCallback(
            async (category) => {
                await getVehicles();

                setCategoryAssignDialog({
                    open: true,
                    category,
                    search: "",
                    loading: false,
                    selectedVehicles:
                        (category?.vehicles ?? []).map(
                            (vehicle) => vehicle._id
                        ),
                });
            },
            [getVehicles]
        );

    const handleAssignDialogClose =
        useCallback(() => {
            setCategoryAssignDialog({
                open: false,
                category: null,
                search: "",
                selectedVehicles: [],
                loading: false,
            });
        }, []);

    const handleAssignSearch =
        useCallback((value) => {
            setCategoryAssignDialog((previous) => ({
                ...previous,
                search: value,
            }));
        }, []);

    const handleAssignSelectionChange =
        useCallback((selectedVehicles) => {
            setCategoryAssignDialog((previous) => ({
                ...previous,
                selectedVehicles,
            }));
        }, []);

    const handleAssignConfirm =
        useCallback(async () => {
            if (!categoryAssignDialog.category) {
                return;
            }

            setCategoryAssignDialog((previous) => ({
                ...previous,
                loading: true,
            }));

            try {
                const selectedIds =
                    categoryAssignDialog.selectedVehicles;

                const updates = vehicles.map(
                    (vehicle) => {
                        const shouldBeAssigned =
                            selectedIds.includes(
                                vehicle._id
                            );

                        if (!shouldBeAssigned) {
                            return null;
                        }

                        if (
                            vehicle.category?._id ===
                            categoryAssignDialog.category._id
                        ) {
                            return null;
                        }

                        return updateVehicle(
                            vehicle._id,
                            {
                                category:
                                    categoryAssignDialog.category._id,
                            }
                        ).unwrap();
                    }
                );

                await Promise.all(
                    updates.filter(Boolean)
                );

                await Promise.all([
                    getVehicleCategories(),
                    getVehicles(),
                ]);

                toast.success(
                    "Vehicles assigned successfully."
                );

                setCategoryAssignDialog({
                    open: false,
                    category: null,
                    search: "",
                    selectedVehicles: [],
                    loading: false,
                });
            } catch (error) {
                toast.error(
                    error?.message ||
                    error ||
                    "Unable to assign vehicles."
                );

                setCategoryAssignDialog((previous) => ({
                    ...previous,
                    loading: false,
                }));
            }
        }, [
            categoryAssignDialog,
            vehicles,
            updateVehicle,
            getVehicleCategories,
            getVehicles,
            toast,
        ]);

    const handleCategoryFilterChange =
        useCallback((nextFilters) => {
            setCategoryFilters(nextFilters);
        }, []);

    const handleCategoryResetFilters =
        useCallback(() => {
            setCategoryFilters({
                ...INITIAL_CATEGORY_FILTERS,
            });
        }, []);

    /* Doubles as the Active/Archived tab switch and the ownership
       filter — one row instead of two separate toggle rows. */
    const fleetStats = [
        {
            key: "total",
            label: "Total Fleet",
            value: counts.total ?? 0,
            hint: "All vehicles",
            icon: Car,
            tone: "blue",
            onClick: () =>
                setFilters((previous) => ({
                    ...previous,
                    ownership: "",
                })),
            active: !filters.ownership,
        },
        {
            key: "active",
            label: "Active",
            value: counts.active ?? 0,
            hint: "Currently listed",
            icon: CheckCircle2,
            tone: "emerald",
            onClick: () => setActiveTab("active"),
            active: activeTab === "active",
        },
        {
            key: "archived",
            label: "Archived",
            value: counts.archived ?? 0,
            hint: "Hidden from booking",
            icon: Archive,
            tone: "amber",
            onClick: () => setActiveTab("archived"),
            active: activeTab === "archived",
        },
        {
            key: "company",
            label: "Company-Owned",
            value: counts.company ?? 0,
            hint: "Owned by us",
            icon: Building2,
            tone: "indigo",
            onClick: () =>
                setFilters((previous) => ({
                    ...previous,
                    ownership: "Company",
                })),
            active: filters.ownership === "Company",
        },
        {
            key: "consigned",
            label: "Consigned",
            value: counts.consigned ?? 0,
            hint: "Partner-owned",
            icon: Handshake,
            tone: "rose",
            onClick: () =>
                setFilters((previous) => ({
                    ...previous,
                    ownership: "Consigned",
                })),
            active: filters.ownership === "Consigned",
        },
        {
            key: "categories",
            label: "Categories",
            value: vehicleCategories.length ?? 0,
            hint: "Manage categories",
            icon: Layers,
            tone: "purple",
            onClick: () => setShowCategoriesModal(true),
            active: showCategoriesModal,
        },
    ];

    /* Theme-aware pill shell shared by the toolbar pills below. */
    const PILL =
        "flex items-center gap-1 rounded-full border border-gray-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80";
    const PILL_BUTTON =
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
    const PILL_SM =
        "flex items-center gap-0.5 rounded-full border border-gray-200/80 bg-white/80 p-0.5 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80";
    const PILL_BUTTON_SM =
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
    const PILL_MD =
        "flex items-center gap-1 rounded-full border border-gray-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80";
    const PILL_BUTTON_MD =
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
    const PILL_BUTTON_IDLE =
        "text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";

    const VIEW_OPTIONS = [
        { value: "table", label: "Table", icon: TableProperties },
        { value: "cards", label: "Cards", icon: LayoutGrid },
    ];

    return (
        <div className="space-y-6">
            {/* Search + Filters — one pill, above the stat cards — with the
                Excel export beside it (exports the filtered list). */}
            <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
                <div className={`${PILL} min-w-0 flex-1`}>
                    <div className="relative min-w-0 flex-1">
                        <Search
                            size={17}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Search by code, brand, model or plate..."
                            aria-label="Search vehicles"
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

                    <button
                        type="button"
                        onClick={() =>
                            setShowFilters((previous) => !previous)
                        }
                        aria-pressed={showFilters}
                        className={`${PILL_BUTTON} h-10 ${
                            showFilters
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                                : PILL_BUTTON_IDLE
                        }`}
                    >
                        <SlidersHorizontal size={16} />
                        <span className="hidden sm:inline">Filters</span>
                    </button>
                </div>

                <ExportExcelPill
                    size="pill"
                    onClick={handleExport}
                    loading={exporting}
                    disabled={loading || orderedVehicles.length === 0}
                />
            </div>

            {/* View controls under the search, stacked and centred:
                Table/Cards + Add Vehicle, then a smaller Expand/Collapse pill */}
            <div className="-mt-3 flex flex-col items-center gap-2">
                {/* Phones only have Add Vehicle in here (no view toggle). */}
                <div
                    className={`${PILL_MD} ${
                        activeTab === "active" ? "" : "max-md:hidden"
                    }`}
                >
                    <div
                        role="tablist"
                        aria-label="View"
                        className="hidden items-center gap-1 md:flex"
                    >
                        {VIEW_OPTIONS.map((option) => {
                            const active = viewMode === option.value;
                            const Icon = option.icon;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() =>
                                        setViewMode(option.value)
                                    }
                                    className={`relative ${PILL_BUTTON_MD} ${
                                        active ? "text-white" : PILL_BUTTON_IDLE
                                    }`}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="fleet-view-pill"
                                            className="absolute inset-0 rounded-full bg-blue-600 shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/20"
                                            transition={ACTIVE_PILL_SPRING}
                                        />
                                    )}
                                    <Icon size={14} className="relative" />
                                    <span className="relative">
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {activeTab === "active" && (
                        <>
                            <span
                                aria-hidden="true"
                                className="mx-1 hidden h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700 md:block"
                            />

                            <button
                                type="button"
                                onClick={handleAddVehicle}
                                className={`${PILL_BUTTON_MD} bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200`}
                            >
                                <Plus size={15} />
                                Add Vehicle
                            </button>
                        </>
                    )}
                </div>

                {viewMode === "table" && (
                    <div className={PILL_SM}>
                        <button
                            type="button"
                            onClick={handleExpandAll}
                            disabled={!filteredVehicles.length}
                            className={`${PILL_BUTTON_SM} ${PILL_BUTTON_IDLE}`}
                        >
                            <ChevronsUpDown size={13} />
                            Expand All
                        </button>

                        <span
                            aria-hidden="true"
                            className="h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700"
                        />

                        <button
                            type="button"
                            onClick={handleCollapseAll}
                            disabled={!expandedRows.length}
                            className={`${PILL_BUTTON_SM} ${PILL_BUTTON_IDLE}`}
                        >
                            <ChevronsDownUp size={13} />
                            Collapse All
                        </button>
                    </div>
                )}
            </div>

            <motion.div
                variants={STAGGER_CONTAINER}
                initial="initial"
                animate="animate"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
            >
                {fleetStats.map((stat) => (
                    <motion.div
                        key={stat.key}
                        variants={STAGGER_ITEM}
                    >
                        <FleetStatCard {...stat} />
                    </motion.div>
                ))}
            </motion.div>

            <VehicleAvailabilityRequestsPanel />

            {showFilters && (
                <VehicleFilters
                    filters={filters}
                    onChange={setFilters}
                    onReset={
                        handleResetFilters
                    }
                />
            )}

            <AnimatePresence
        mode="wait"
        initial={false}
    >
        {viewMode === "table" ? (
            <motion.div
                key={`table-${activeTab}-${search}-${JSON.stringify(filters)}-${page}`}
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
                <VehicleTable
                    vehicles={pagedVehicles}
                    leavingRowId={leavingRowId}
                    loading={loading}
                    dense
                    pinnedIds={pinnedIds}
                    onTogglePin={handleTogglePin}
                    bookingSchedule={bookingSchedule}
                    isArchivedView={
                        activeTab === "archived"
                    }
                    expandedRows={expandedRows}
                    onExpandedRowsChange={
                        setExpandedRows
                    }
                    onView={handleViewVehicle}
                    onEdit={handleEditVehicle}
                    onArchive={handleArchiveVehicle}
                    onRestore={handleRestoreVehicle}
                    onRenewRegistration={
                        handleRenewRegistration
                    }
                    onManageAvailability={
                        handleManageAvailability
                    }
                    onOffRoad={handleOffRoad}
                    platformCommissionRate={
                        platformCommissionRate
                    }
                />
            </motion.div>
        ) : (
            <motion.div
                key={`cards-${activeTab}-${search}-${JSON.stringify(filters)}-${page}`}
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
                <VehicleCardList
                    vehicles={pagedVehicles}
                    isArchivedView={
                        activeTab === "archived"
                    }
                    leavingVehicleId={
                        leavingVehicleId
                    }
                    onView={handleViewVehicle}
                    onEdit={handleEditVehicle}
                    onArchive={handleArchiveVehicle}
                    onRestore={handleRestoreVehicle}
                    onMaintenance={handleOpenMaintenance}
                    onOffRoad={handleOffRoad}
                    pinnedIds={pinnedIds}
                    onTogglePin={handleTogglePin}
                    platformCommissionRate={
                        platformCommissionRate
                    }
                />
            </motion.div>
        )}
    </AnimatePresence>

            {/* Shared by the table and card views. */}
            <VehicleMaintenanceDialog
                isOpen={Boolean(maintenanceVehicle)}
                vehicle={maintenanceVehicle}
                initialMode={maintenanceMode}
                onClose={() => setMaintenanceVehicle(null)}
                onDone={refreshVehicles}
            />

            {!loading && filteredVehicles.length > 0 && (
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                        Showing {pagedVehicles.length} of{" "}
                        {filteredVehicles.length}{" "}
                        {filteredVehicles.length === 1
                            ? "vehicle"
                            : "vehicles"}
                    </p>

                    {totalVehiclePages > 1 && (
                        <Pagination
                            currentPage={page}
                            totalPages={totalVehiclePages}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            )}

            <VehicleDialogs
                open={dialog.open}
                mode={dialog.mode}
                vehicle={dialog.vehicle}
                onClose={
                    handleCloseDialog
                }
            />

            <VehicleArchiveDialog
                isOpen={archiveDialog.open}
                mode={archiveDialog.mode}
                vehicle={archiveDialog.vehicle}
                loading={archiveDialog.loading}
                onClose={
                    handleArchiveDialogClose
                }
                onConfirm={
                    handleArchiveDialogConfirm
                }
            />

            <RenewRegistrationDialog
                open={renewRegistrationDialog.open}
                vehicle={
                    renewRegistrationDialog.vehicle
                }
                onClose={
                    handleRenewRegistrationDialogClose
                }
                onSuccess={
                    handleRenewRegistrationDialogClose
                }
            />

            <AdminAvailabilityCalendarDialog
                open={availabilityDialog.open}
                vehicle={
                    availabilityDialogVehicle
                }
                onClose={
                    handleAvailabilityDialogClose
                }
            />

            {/* Vehicle Categories — opened from the "Categories" fleet
                stat card above, instead of always sitting inline below
                the vehicle list. Same toolbar/filters/table/pagination as
                before, just modal-hosted. */}
            <Modal
                isOpen={showCategoriesModal}
                onClose={() =>
                    setShowCategoriesModal(false)
                }
                title="Categories"
                description="Organize vehicles into categories used throughout the rental system."
                size="fullscreen"
            >
                <div className="space-y-6">

                    {/* Search · Filters · Add Category — one centred pill */}
                    <div className={`mx-auto w-full max-w-2xl ${PILL}`}>
                        <div className="relative min-w-0 flex-1">
                            <Search
                                size={17}
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                value={categoryFilters.search}
                                onChange={(event) =>
                                    handleCategorySearch(event.target.value)
                                }
                                placeholder="Search vehicle categories..."
                                aria-label="Search vehicle categories"
                                className="h-10 w-full rounded-full bg-transparent pl-11 pr-9 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:bg-gray-100/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-800/60"
                            />
                            {categoryFilters.search && (
                                <button
                                    type="button"
                                    onClick={() => handleCategorySearch("")}
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

                        <button
                            type="button"
                            onClick={() =>
                                setShowCategoryFilters((previous) => !previous)
                            }
                            aria-pressed={showCategoryFilters}
                            className={`${PILL_BUTTON} h-10 ${
                                showCategoryFilters
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                                    : PILL_BUTTON_IDLE
                            }`}
                        >
                            <SlidersHorizontal size={16} />
                            <span className="hidden sm:inline">Filters</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCategoryCreate}
                            className={`${PILL_BUTTON} h-10 bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200`}
                        >
                            <Plus size={16} />
                            <span className="hidden sm:inline">Add Category</span>
                        </button>
                    </div>

                    {showCategoryFilters && (
                        <VehicleCategoryFilters
                            filters={categoryFilters}
                            onChange={
                                handleCategoryFilterChange
                            }
                            onReset={
                                handleCategoryResetFilters
                            }
                        />
                    )}

                    <VehicleCategoryTable
                        vehicleCategories={pagedCategories}
                        loading={categoryLoading}
                        onEdit={handleCategoryEdit}
                        onDelete={handleCategoryDelete}
                        onRemoveVehicle={handleRemoveVehicle}
                        onAssignVehicles={handleAssignVehicles}
                    />

                    {!categoryLoading &&
                        filteredCategories.length >
                            0 && (
                            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                                    Showing{" "}
                                    {
                                        pagedCategories.length
                                    }{" "}
                                    of{" "}
                                    {
                                        filteredCategories.length
                                    }{" "}
                                    {filteredCategories.length ===
                                    1
                                        ? "category"
                                        : "categories"}
                                </p>

                                {totalCategoryPages >
                                    1 && (
                                    <Pagination
                                        currentPage={
                                            categoryPage
                                        }
                                        totalPages={
                                            totalCategoryPages
                                        }
                                        onPageChange={
                                            setCategoryPage
                                        }
                                    />
                                )}
                            </div>
                        )}
                </div>
            </Modal>

            <VehicleCategoryDialogs
                open={categoryDialog.open}
                mode={categoryDialog.mode}
                vehicleCategory={
                    categoryDialog.vehicleCategory
                }
                onClose={handleCategoryCloseDialog}
            />

            <VehicleCategoryDeleteDialog
                isOpen={deleteDialog.open}
                category={deleteDialog.category}
                loading={deleteDialog.loading}
                onClose={handleCategoryDeleteClose}
                onConfirm={handleCategoryDeleteConfirm}
            />

            <VehicleCategoryAssignDialog
                isOpen={categoryAssignDialog.open}
                category={categoryAssignDialog.category}
                vehicles={vehicles}
                loading={categoryAssignDialog.loading}
                search={categoryAssignDialog.search}
                onSearch={handleAssignSearch}
                selectedVehicles={
                    categoryAssignDialog.selectedVehicles
                }
                onSelectionChange={
                    handleAssignSelectionChange
                }
                onClose={handleAssignDialogClose}
                onConfirm={handleAssignConfirm}
            />

            <VehicleCategoryVehicleRemoveDialog
                isOpen={removeVehicleDialog.open}
                vehicle={removeVehicleDialog.vehicle}
                category={removeVehicleDialog.category}
                loading={removeVehicleDialog.loading}
                onClose={handleRemoveVehicleClose}
                onConfirm={handleRemoveVehicleConfirm}
            />
        </div>
    );
};

export default Vehicles;