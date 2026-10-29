import { useMemo } from "react";
import { CalendarClock, RefreshCw, TrafficCone } from "lucide-react";

import Price from "../../components/common/Price";
import StatusChip from "../../components/common/StatusChip";

import TableActions from "../../components/tables/TableActions";
import VehicleListItem from "../../components/vehicle/VehicleListItem";
import VehicleNextBookingCell from "../../components/vehicle/VehicleNextBookingCell";
import VehiclePinButton from "../../components/vehicle/VehiclePinButton";

import createTableActions from "../../utils/createTableActions";
import { isVehicleOffRoad } from "../../constants/vehicleConstants";

const normalizeVehicle = (vehicle) => ({
    dailyRate:
        (Number(vehicle.pricing?.dailyRate) || 0) +
        (Number(vehicle.pricing?.reservationFee) || 0),

    status: vehicle.status,

    bookingEnabled:
        vehicle.availability
            ?.bookingEnabled ?? false,

    approved:
        vehicle.isApproved,
});

const useVehicleTableColumns = ({
    compact = false,
    showApproval = false,
    showActions = true,

    // Admin fleet table: tighter cells so the extra columns fit.
    dense = false,

    isArchivedView = false,

    // Admin fleet table: pin column (shown when onTogglePin is given).
    pinnedIds,
    onTogglePin,

    // Admin fleet table: "Next Booking" column (shown when given; null =
    // still loading or failed).
    bookingSchedule,

    onView,
    onEdit,
    onApprove,
    onArchive,
    onRestore,
    onRenewRegistration,
    onManageAvailability,
    // Admin: take the vehicle off road, or put it back in service.
    onOffRoad,
}) => {
    return useMemo(() => {
        const showNextBooking =
            bookingSchedule !== undefined &&
            !isArchivedView;

        const columns = [];

        if (onTogglePin) {
            columns.push({
                key: "pin",
                header: (
                    <span className="sr-only">
                        Pin
                    </span>
                ),
                width: "w-11",
                headerClassName: "px-2!",
                cellClassName: "px-2!",

                render: (vehicle) => (
                    <VehiclePinButton
                        pinned={
                            pinnedIds?.includes(
                                vehicle._id
                            ) ?? false
                        }
                        onToggle={() =>
                            onTogglePin(vehicle)
                        }
                    />
                ),
            });
        }

        columns.push(
            {
                key: "vehicle",
                header: "Vehicle",
                width: dense
                    ? showNextBooking
                        ? "w-[36%]"
                        : "w-[46%]"
                    : "w-[50%]",

                render: (
    vehicle,
    {
        expanded = false,
        expandable = false,
    } = {}
) => (
    <VehicleListItem
        vehicle={vehicle}
        compact={compact}
        dense={dense}
        expanded={expanded}
        expandable={expandable}
    />
),
            },

            {
                key: "status",
                header: "Status",
                width: dense ? "w-[14%]" : "w-[20%]",
                align: "center",

                render: (
                    vehicle
                ) => {
                    const item =
                        normalizeVehicle(
                            vehicle
                        );

                    return (
                        <div className="flex flex-col items-center gap-1">
                            <StatusChip
                                status={
                                    item.status
                                }
                                size={dense ? "sm" : undefined}
                            />

                            <span
                                className={
                                    dense
                                        ? "text-[11px] text-gray-500 dark:text-gray-400"
                                        : "text-xs text-gray-500"
                                }
                            >
                                {dense
                                    ? item.bookingEnabled
                                        ? "Booking on"
                                        : "Booking off"
                                    : item.bookingEnabled
                                      ? "Booking Enabled"
                                      : "Booking Disabled"}
                            </span>
                        </div>
                    );
                },
            }
        );

        if (showNextBooking) {
            columns.push({
                key: "nextBooking",
                header: "Next Booking",
                width: "w-[18%]",

                render: (vehicle) => (
                    <VehicleNextBookingCell
                        loaded={bookingSchedule !== null}
                        entry={
                            bookingSchedule?.[
                                vehicle._id
                            ]
                        }
                    />
                ),
            });
        }

        columns.push(
            {
                key: "dailyRate",
                header: dense
                    ? "Daily Price"
                    : "Daily Total Price",
                width: dense ? "w-[11%]" : "w-[12%]",
                align: "right",

                render: (
                    vehicle
                ) => (
                    <Price
                        value={
                            normalizeVehicle(
                                vehicle
                            ).dailyRate
                        }
                        className={
                            dense
                                ? "text-[13px] font-semibold"
                                : "font-semibold"
                        }
                    />
                ),
            }
        );

        if (
            showApproval &&
            !compact
        ) {
            columns.push({
                key: "approval",
                header: "Approval",
                width: "w-[10%]",
                align: "center",

                render: (
                    vehicle
                ) => (
                    <StatusChip
                        status={
                            normalizeVehicle(
                                vehicle
                            ).approved
                                ? "approved"
                                : "pending"
                        }
                    />
                ),
            });
        }

        if (showActions) {
            columns.push({
                key: "actions",
                header: "Actions",
                width: dense ? "w-[21%]" : "w-[18%]",
                align: "right",

                render: (
                    vehicle
                ) => (
                    <TableActions
                        variant="icons"
                        size={dense ? "xs" : "sm"}
                        actions={createTableActions({
                            item: vehicle,

                            onView,

                            onEdit:
                                isArchivedView
                                    ? undefined
                                    : onEdit,

                            onApprove,

                            onArchive:
                                isArchivedView
                                    ? undefined
                                    : onArchive,

                            additionalActions: [
                                ...(isArchivedView
                                    ? [
                                          {
                                              label: "Restore",
                                              variant:
                                                  "success",
                                              onClick:
                                                  () =>
                                                      onRestore?.(
                                                          vehicle
                                                      ),
                                          },
                                      ]
                                    : []),

                                ...(vehicle.status ===
                                "RegistrationExpired"
                                    ? [
                                          {
                                              label: "Renew Registration",
                                              icon: RefreshCw,
                                              color: "red",
                                              onClick:
                                                  () =>
                                                      onRenewRegistration?.(
                                                          vehicle
                                                      ),
                                          },
                                      ]
                                    : []),

                                ...(!isArchivedView && onOffRoad
                                    ? [
                                          isVehicleOffRoad(vehicle)
                                              ? {
                                                    label: "Off Road · Put Back in Service",
                                                    icon: TrafficCone,
                                                    color: "green",
                                                    onClick: () =>
                                                        onOffRoad(vehicle),
                                                }
                                              : {
                                                    label: "Take Off Road",
                                                    icon: TrafficCone,
                                                    color: "amber",
                                                    onClick: () =>
                                                        onOffRoad(vehicle),
                                                },
                                      ]
                                    : []),

                                ...(!isArchivedView &&
                                onManageAvailability
                                    ? [
                                          {
                                              label: "Manage Availability",
                                              icon: CalendarClock,
                                              color: "blue",
                                              onClick:
                                                  () =>
                                                      onManageAvailability(
                                                          vehicle
                                                      ),
                                          },
                                      ]
                                    : []),
                            ],

                            showApproval,

                            approved:
                                vehicle.isApproved,
                        })}
                    />
                ),
            });
        }

        return columns;
    }, [
        compact,
        dense,
        showApproval,
        showActions,
        isArchivedView,
        pinnedIds,
        onTogglePin,
        bookingSchedule,
        onView,
        onEdit,
        onApprove,
        onArchive,
        onRestore,
        onRenewRegistration,
        onManageAvailability,
        onOffRoad,
    ]);
};

export default useVehicleTableColumns;
