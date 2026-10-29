import { useMemo, useState } from "react";
import { Eye, CheckCircle2, Info } from "lucide-react";

import Badge from "../common/Badge";
import Button from "../common/Button";
import DataTable from "./DataTable";
import TableActions from "./TableActions";
import GpsAlertsInfoModal from "../modals/GpsAlertsInfoModal";
import timeAgo from "../../utils/timeAgo";
import {
    ALERT_TYPE_ICONS,
    ALERT_TYPE_LABELS,
    ALERT_SEVERITY_LABELS,
    ALERT_SEVERITY_BADGE_VARIANT,
    ALERT_STATUS,
    ALERT_STATUS_LABELS,
    ALERT_STATUS_BADGE_VARIANT,
} from "../../constants/alertConstants";

const vehicleLabel = (vehicle) => {
    if (!vehicle) {
        return null;
    }

    const name = [vehicle.brand, vehicle.model]
        .filter(Boolean)
        .join(" ");

    return name || vehicle.vehicleCode;
};

// Never render tracker deviceKey/credentials here - alerts only ever carry
// vehicle/tracker ids, never anything from the tracker-auth layer.
const AlertTable = ({
    alerts = [],
    vehiclesById = {},
    loading = false,
    onRead,
    onResolve,
    onSelectVehicle,
    // Omit onResolve to hide the Resolve action (partners can only read).
    partnerView = false,
}) => {
    const [infoOpen, setInfoOpen] = useState(false);

    const columns = useMemo(
        () => [
            {
                key: "type",
                header: "Alert",
                render: (alert) => {
                    const Icon = ALERT_TYPE_ICONS[alert.type];

                    return (
                        <div className="flex items-center gap-2">
                            {Icon && (
                                <Icon
                                    size={16}
                                    className="shrink-0 text-gray-500 dark:text-gray-400"
                                />
                            )}

                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {ALERT_TYPE_LABELS[alert.type] ||
                                        alert.type}
                                </p>

                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                    {alert.message}
                                </p>
                            </div>
                        </div>
                    );
                },
            },

            {
                key: "vehicle",
                header: "Vehicle",
                render: (alert) => {
                    const vehicle = vehiclesById[alert.vehicle];

                    if (!vehicle) {
                        return (
                            <span className="text-sm text-gray-400 dark:text-gray-500">
                                Unknown vehicle
                            </span>
                        );
                    }

                    const content = (
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

                    if (!onSelectVehicle) {
                        return content;
                    }

                    return (
                        <button
                            type="button"
                            onClick={() =>
                                onSelectVehicle(alert.vehicle)
                            }
                            className="text-left hover:underline"
                        >
                            {content}
                        </button>
                    );
                },
            },

            {
                key: "severity",
                header: "Severity",
                align: "center",
                render: (alert) => (
                    <Badge
                        variant={
                            ALERT_SEVERITY_BADGE_VARIANT[
                                alert.severity
                            ] || "default"
                        }
                        size="sm"
                    >
                        {ALERT_SEVERITY_LABELS[alert.severity] ||
                            alert.severity}
                    </Badge>
                ),
            },

            {
                key: "status",
                header: "Status",
                align: "center",
                render: (alert) => (
                    <Badge
                        variant={
                            ALERT_STATUS_BADGE_VARIANT[
                                alert.status
                            ] || "default"
                        }
                        size="sm"
                        dot
                        pulse={alert.status === ALERT_STATUS.ACTIVE}
                    >
                        {ALERT_STATUS_LABELS[alert.status] ||
                            alert.status}
                    </Badge>
                ),
            },

            {
                key: "triggeredAt",
                header: "Triggered",
                render: (alert) => (
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                        {timeAgo(alert.triggeredAt)}
                    </span>
                ),
            },

            {
                key: "actions",
                header: "Actions",
                align: "right",
                cellClassName: "min-w-24",
                render: (alert) => (
                    <TableActions
                        variant="icons"
                        actions={[
                            {
                                label: "Mark as Read",
                                color: "gray",
                                icon: Eye,
                                hidden: alert.isRead,
                                onClick: () => onRead?.(alert),
                            },
                            {
                                label: "Resolve",
                                color: "green",
                                icon: CheckCircle2,
                                hidden:
                                    !onResolve ||
                                    alert.status ===
                                    ALERT_STATUS.RESOLVED,
                                onClick: () => onResolve?.(alert),
                            },
                        ].filter((action) => !action.hidden)}
                    />
                ),
            },
        ],
        [vehiclesById, onRead, onResolve, onSelectVehicle]
    );

    return (
        <>
            <DataTable
                columns={columns}
                data={alerts}
                loading={loading}
                caption="GPS alerts table"
                emptyMessage="No GPS alerts yet."
                emptyAction={
                    <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Info size={16} />}
                        onClick={() => setInfoOpen(true)}
                    >
                        How alerts work
                    </Button>
                }
            />

            <GpsAlertsInfoModal
                isOpen={infoOpen}
                onClose={() => setInfoOpen(false)}
                partnerView={partnerView}
            />
        </>
    );
};

export default AlertTable;
