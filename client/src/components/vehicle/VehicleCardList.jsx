import {
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    AnimatePresence,
    LayoutGroup,
} from "framer-motion";
import {
    CalendarClock,
    Eye,
    Pencil,
    RotateCcw,
    TrafficCone,
    Trash2,
    Wrench,
} from "lucide-react";

import Button from "../common/Button";

import FeaturedVehicleCard from "./FeaturedVehicleCard";
import PartnerFeaturedVehicleCard from "./PartnerFeaturedVehicleCard";
import VehicleCardGrid from "./VehicleCardGrid";

import { isVehicleOffRoad } from "../../constants/vehicleConstants";

const VehicleCardList = ({
    vehicles = [],

    isArchivedView = false,

    leavingVehicleId,

    allowAvailabilityRequests = false,
    platformCommissionRate = null,

    // A partner's My Vehicles page: the grid cards' menu offers only View
    // (expand) and Availability (expand with the calendar open), and the
    // expanded card is the trimmed partner card.
    partnerView = false,

    onView,
    onEdit,
    onArchive,
    onRestore,
    // Admin: open the vehicle's maintenance controls.
    onMaintenance,
    // Admin: take the vehicle off road, or put it back in service.
    onOffRoad,
    // Admin: pinned vehicle ids (already sorted first by the page) and the
    // pin toggle shown on each card.
    pinnedIds,
    onTogglePin,
}) => {
    const [selectedVehicle, setSelectedVehicle] =
        useState(null);

    const [actionsExpanded, setActionsExpanded] =
        useState(false);

    const [calendarOnExpand, setCalendarOnExpand] =
        useState(false);

    const visibleVehicles =
        useMemo(() => {
            if (!selectedVehicle) {
                return vehicles;
            }

            return vehicles.filter(
                (vehicle) =>
                    vehicle._id !==
                    selectedVehicle._id
            );
        }, [
            vehicles,
            selectedVehicle,
        ]);

    useEffect(() => {
        if (!selectedVehicle) {
            return;
        }

        const fresh =
            vehicles.find(
                (vehicle) =>
                    vehicle._id ===
                    selectedVehicle._id
            );

        if (!fresh) {
            setSelectedVehicle(null);
            setActionsExpanded(false);
        } else if (fresh !== selectedVehicle) {
            // Reloaded (e.g. after a maintenance change): show the update.
            setSelectedVehicle(fresh);
        }
    }, [
        vehicles,
        selectedVehicle,
    ]);

    const handleSelect = (
        vehicle
    ) => {
        if (
            selectedVehicle?._id ===
            vehicle._id
        ) {
            setSelectedVehicle(null);
            setActionsExpanded(false);
            return;
        }

        setSelectedVehicle(vehicle);
        setActionsExpanded(false);
        setCalendarOnExpand(false);
    };

    const handleOpenAvailability = (vehicle) => {
        setSelectedVehicle(vehicle);
        setActionsExpanded(false);
        setCalendarOnExpand(true);
    };

    const getPartnerMenuActions = (vehicle) => [
        {
            label: "View",
            icon: Eye,
            onClick: () => handleSelect(vehicle),
        },
        {
            label: "Availability",
            icon: CalendarClock,
            onClick: () => handleOpenAvailability(vehicle),
        },
    ];

    // The admin grid cards' menu.
    const getAdminMenuActions = (vehicle) =>
        [
            {
                label: "View",
                icon: Eye,
                onClick: () =>
                    onView ? onView(vehicle) : handleSelect(vehicle),
            },
            !isArchivedView &&
                onEdit && {
                    label: "Edit",
                    icon: Pencil,
                    onClick: () => onEdit(vehicle),
                },
            !isArchivedView &&
                onOffRoad &&
                (isVehicleOffRoad(vehicle)
                    ? {
                          label: "Back in service",
                          icon: TrafficCone,
                          variant: "success",
                          onClick: () => onOffRoad(vehicle),
                      }
                    : {
                          label: "Take off road",
                          icon: TrafficCone,
                          onClick: () => onOffRoad(vehicle),
                      }),
            !isArchivedView &&
                onArchive && {
                    label: "Archive",
                    icon: Trash2,
                    variant: "danger",
                    onClick: () => onArchive(vehicle),
                },
            isArchivedView &&
                onRestore && {
                    label: "Restore",
                    icon: RotateCcw,
                    variant: "success",
                    onClick: () => onRestore(vehicle),
                },
        ].filter(Boolean);

    const handleCollapse = () => {
        setSelectedVehicle(null);
        setActionsExpanded(false);
    };

    return (
        <LayoutGroup id="vehicle-gallery">
            <div className="space-y-8">
                <AnimatePresence mode="wait">
                    {selectedVehicle && partnerView && (
                        <PartnerFeaturedVehicleCard
                            key={selectedVehicle._id}
                            vehicle={selectedVehicle}
                            platformCommissionRate={
                                platformCommissionRate
                            }
                            initialCalendarOpen={
                                calendarOnExpand
                            }
                            onCollapse={handleCollapse}
                        />
                    )}

                    {selectedVehicle && !partnerView && (
                        <FeaturedVehicleCard
                            key={
                                selectedVehicle._id
                            }
                            vehicle={
                                selectedVehicle
                            }
                            expanded={
                                actionsExpanded
                            }
                            isLeaving={
                                leavingVehicleId ===
                                selectedVehicle._id
                            }
                            isArchivedView={
                                isArchivedView
                            }
                            allowAvailabilityRequests={
                                allowAvailabilityRequests
                            }
                            platformCommissionRate={
                                platformCommissionRate
                            }
                            onCollapse={
                                handleCollapse
                            }
                            onToggle={() =>
                                setActionsExpanded(
                                    (
                                        previous
                                    ) =>
                                        !previous
                                )
                            }
                        >
                            {onView && (
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        onView?.(
                                            selectedVehicle
                                        )
                                    }
                                >
                                    View
                                </Button>
                            )}

                            {!isArchivedView && onEdit && (
                                <Button
                                    onClick={() =>
                                        onEdit?.(
                                            selectedVehicle
                                        )
                                    }
                                >
                                    Edit
                                </Button>
                            )}

                            {!isArchivedView && onMaintenance && (
                                <Button
                                    variant="warning"
                                    leftIcon={<Wrench size={15} />}
                                    onClick={() =>
                                        onMaintenance?.(
                                            selectedVehicle
                                        )
                                    }
                                >
                                    Maintenance
                                </Button>
                            )}

                            {!isArchivedView && onArchive && (
                                <Button
                                    variant="danger"
                                    onClick={() =>
                                        onArchive?.(
                                            selectedVehicle
                                        )
                                    }
                                >
                                    Archive
                                </Button>
                            )}

                            {isArchivedView && onRestore && (
                                <Button
                                    variant="success"
                                    onClick={() =>
                                        onRestore?.(
                                            selectedVehicle
                                        )
                                    }
                                >
                                    Restore
                                </Button>
                            )}
                        </FeaturedVehicleCard>
                    )}
                </AnimatePresence>

                <VehicleCardGrid
                    vehicles={
                        visibleVehicles
                    }
                    onSelect={
                        handleSelect
                    }
                    getMenuActions={
                        partnerView
                            ? getPartnerMenuActions
                            : getAdminMenuActions
                    }
                    pinnedIds={pinnedIds}
                    onTogglePin={onTogglePin}
                />
            </div>
        </LayoutGroup>
    );
};

export default VehicleCardList;