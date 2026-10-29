import { useMemo } from "react";
import {
    Pencil,
    Link2,
    Unlink,
    Power,
    PowerOff,
    KeyRound,
} from "lucide-react";

import Badge from "../common/Badge";
import StatusChip from "../common/StatusChip";
import DataTable from "./DataTable";
import TableActions from "./TableActions";
import timeAgo from "../../utils/timeAgo";
import {
    TRACKER_STATUS,
    TRACKER_PROTOCOL_LABELS,
    TRACKER_COMMUNICATION_LABELS,
    TRACKER_COMMUNICATION_BADGE_VARIANT,
    TRACKER_COMMUNICATION,
    DEVICE_KEY_PROTOCOLS,
    TRACKER_PROTOCOL,
    getTrackerProtocol,
    getTrackerCommunicationStatus,
} from "../../constants/trackerConstants";

const vehicleLabel = (vehicle) => {
    if (!vehicle) {
        return null;
    }

    const name = [vehicle.brand, vehicle.model]
        .filter(Boolean)
        .join(" ");

    return name || vehicle.vehicleCode;
};

// Never render deviceKey/hashed credentials here - only fields already
// present on the list response (which never selects deviceKey).
const TrackerTable = ({
    trackers = [],
    vehiclesById = {},
    loading = false,
    // The page's ticking clock (keeps Communication current between renders).
    now,
    onEdit,
    onAssign,
    onUnassign,
    onDisable,
    onEnable,
    onRegenerateKey,
}) => {
    const columns = useMemo(
        () => [
            {
                key: "imei",
                header: "Device ID / IMEI",
                render: (tracker) => (
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {tracker.imei}
                    </span>
                ),
            },

            {
                key: "model",
                header: "Model",
                render: (tracker) => (
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {tracker.model || "-"}
                    </span>
                ),
            },

            {
                key: "vehicle",
                header: "Vehicle",
                render: (tracker) => {
                    const vehicle = tracker.vehicle
                        ? vehiclesById[tracker.vehicle]
                        : null;

                    if (!vehicle) {
                        return (
                            <span className="text-sm text-gray-400 dark:text-gray-500">
                                Unassigned
                            </span>
                        );
                    }

                    return (
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {vehicleLabel(vehicle)}
                            </p>

                            {vehicle.plateNumber && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {vehicle.plateNumber}
                                </p>
                            )}
                        </div>
                    );
                },
            },

            {
                key: "protocol",
                header: "Protocol / Source",
                render: (tracker) => {
                    const protocol = getTrackerProtocol(tracker);

                    return (
                        <div className="flex flex-col items-start gap-1">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {TRACKER_PROTOCOL_LABELS[protocol] || protocol}
                            </span>

                            {protocol === TRACKER_PROTOCOL.HTTP_SIMULATOR && (
                                <Badge variant="purple" size="sm">
                                    Simulated
                                </Badge>
                            )}
                        </div>
                    );
                },
            },

            {
                key: "status",
                header: "Status",
                align: "center",
                render: (tracker) => (
                    <StatusChip status={tracker.status} />
                ),
            },

            {
                // Is the tracker talking to us (lastSeenAt)? Separate from
                // GPS position/fix status, which lives on the Map section.
                key: "communication",
                header: "Communication",
                align: "center",
                render: (tracker) => {
                    const communication = getTrackerCommunicationStatus(
                        tracker.lastSeenAt,
                        now,
                        getTrackerProtocol(tracker)
                    );

                    return (
                        <Badge
                            variant={
                                TRACKER_COMMUNICATION_BADGE_VARIANT[
                                    communication
                                ]
                            }
                            size="sm"
                            dot
                            pulse={
                                communication ===
                                TRACKER_COMMUNICATION.ONLINE
                            }
                        >
                            {TRACKER_COMMUNICATION_LABELS[communication]}
                        </Badge>
                    );
                },
            },

            {
                key: "lastSeenAt",
                header: "Last Seen",
                render: (tracker) => (
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                        {tracker.lastSeenAt
                            ? timeAgo(tracker.lastSeenAt)
                            : "Never"}
                    </span>
                ),
            },

            {
                key: "actions",
                header: "Actions",
                align: "right",
                cellClassName: "min-w-40",
                render: (tracker) => {
                    const isDisabled =
                        tracker.status === TRACKER_STATUS.INACTIVE;
                    const usesDeviceKey = DEVICE_KEY_PROTOCOLS.includes(
                        getTrackerProtocol(tracker)
                    );

                    return (
                        <TableActions
                            variant="icons"
                            actions={[
                                {
                                    label: "Edit",
                                    color: "orange",
                                    icon: Pencil,
                                    onClick: () => onEdit?.(tracker),
                                },
                                {
                                    label: tracker.vehicle
                                        ? "Reassign to Vehicle"
                                        : "Assign to Vehicle",
                                    color: "blue",
                                    icon: Link2,
                                    onClick: () => onAssign?.(tracker),
                                },
                                tracker.vehicle && {
                                    label: "Unassign from Vehicle",
                                    color: "gray",
                                    icon: Unlink,
                                    onClick: () => onUnassign?.(tracker),
                                },
                                isDisabled
                                    ? {
                                          label: "Enable Tracker",
                                          color: "green",
                                          icon: Power,
                                          onClick: () => onEnable?.(tracker),
                                      }
                                    : {
                                          label: "Disable Tracker",
                                          color: "red",
                                          icon: PowerOff,
                                          onClick: () => onDisable?.(tracker),
                                      },
                                usesDeviceKey && {
                                    label: "Regenerate Device Key",
                                    color: "purple",
                                    icon: KeyRound,
                                    onClick: () =>
                                        onRegenerateKey?.(tracker),
                                },
                            ].filter(Boolean)}
                        />
                    );
                },
            },
        ],
        [
            vehiclesById,
            now,
            onEdit,
            onAssign,
            onUnassign,
            onDisable,
            onEnable,
            onRegenerateKey,
        ]
    );

    return (
        <DataTable
            columns={columns}
            data={trackers}
            loading={loading}
            caption="GPS tracker management table"
            emptyMessage="No GPS trackers registered yet."
        />
    );
};

export default TrackerTable;
