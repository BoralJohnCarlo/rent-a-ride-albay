import { CheckCircle2, Eye, MapPin } from "lucide-react";

import Modal from "../common/Modal";
import Badge from "../common/Badge";
import Button from "../common/Button";
import {
    ALERT_TYPE,
    ALERT_TYPE_ICONS,
    ALERT_TYPE_LABELS,
    ALERT_SEVERITY,
    ALERT_SEVERITY_LABELS,
    ALERT_SEVERITY_BADGE_VARIANT,
    LOW_BATTERY_THRESHOLD_PERCENT,
} from "../../constants/alertConstants";
import {
    GPS_STALE_THRESHOLD_MS,
    AIKA_STALE_THRESHOLD_MS,
} from "../../constants/gpsConstants";

const formatDuration = (ms) =>
    ms >= 60 * 1000 ? `${ms / (60 * 1000)} minutes` : `${ms / 1000} seconds`;

// What raises / clears each type - mirrors server/services/alertService.js.
const ALERT_GUIDE = [
    {
        type: ALERT_TYPE.GPS_OFFLINE,
        severity: ALERT_SEVERITY.CRITICAL,
        raised: `The tracker stopped communicating: no position or heartbeat for ${formatDuration(GPS_STALE_THRESHOLD_MS)} (simulator) or ${formatDuration(AIKA_STALE_THRESHOLD_MS)} (AIKA device).`,
        cleared: "The tracker communicates again.",
    },
    {
        type: ALERT_TYPE.GPS_LOST,
        severity: ALERT_SEVERITY.WARNING,
        raised: "The tracker is communicating but reports no satellite fix (e.g. indoors, or a cell-tower position).",
        cleared: "A reading with a GPS fix arrives.",
    },
    {
        type: ALERT_TYPE.LOW_BATTERY,
        severity: ALERT_SEVERITY.WARNING,
        raised: `The tracker reports a battery below ${LOW_BATTERY_THRESHOLD_PERCENT}%. Devices that don't report battery never raise it.`,
        cleared: `The battery reads ${LOW_BATTERY_THRESHOLD_PERCENT}% or higher.`,
    },
    {
        type: ALERT_TYPE.IGNITION_ON,
        severity: ALERT_SEVERITY.INFO,
        raised: "The vehicle's ignition (ACC) is reported on.",
        cleared: "Ignition is reported off.",
    },
];

const REQUIREMENTS = [
    "A tracker is registered in the Trackers tab.",
    "It is assigned to a vehicle (unassigned trackers never raise alerts).",
    "It is enabled - disabled trackers are ignored.",
    "It has communicated at least once (a tracker still waiting for its first report is never \"offline\").",
];

const ACTIONS = [
    {
        icon: Eye,
        label: "Mark as Read",
        text: "Acknowledge an alert. It stays active until its condition clears.",
    },
    {
        icon: CheckCircle2,
        label: "Resolve",
        text: "Close it manually. If the condition is still true, the next reading opens a new alert.",
    },
    {
        icon: MapPin,
        label: "Vehicle",
        text: "Click the vehicle name to jump to it on the map.",
    },
];

// Partners can't resolve alerts (admin-only) and don't manage trackers.
const PARTNER_RESOLVE_ACTION = {
    icon: CheckCircle2,
    label: "Resolve",
    text: "The Rent-a-Ride team closes alerts once they've been handled. Contact support if one needs attention.",
};

const SectionTitle = ({ children }) => (
    <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {children}
    </h3>
);

const GpsAlertsInfoModal = ({ isOpen, onClose, partnerView = false }) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="How GPS Alerts Work"
        description="Alerts are raised and cleared automatically from tracker data. No alerts means no current problems."
        size="lg"
    >
        <div className="space-y-6">
            <section>
                <SectionTitle>Alert types</SectionTitle>

                <ul className="space-y-3">
                    {ALERT_GUIDE.map(({ type, severity, raised, cleared }) => {
                        const Icon = ALERT_TYPE_ICONS[type];

                        return (
                            <li
                                key={type}
                                className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                            >
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <Icon
                                        size={16}
                                        className="shrink-0 text-gray-500 dark:text-gray-400"
                                    />

                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {ALERT_TYPE_LABELS[type]}
                                    </span>

                                    <Badge
                                        variant={ALERT_SEVERITY_BADGE_VARIANT[severity]}
                                        size="sm"
                                    >
                                        {ALERT_SEVERITY_LABELS[severity]}
                                    </Badge>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-medium">Raised:</span>{" "}
                                    {raised}
                                </p>

                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-medium">Cleared:</span>{" "}
                                    {cleared}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {!partnerView && (
            <section>
                <SectionTitle>What's needed for alerts to appear</SectionTitle>

                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
                    {REQUIREMENTS.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>
            )}

            <section>
                <SectionTitle>What you can do</SectionTitle>

                <ul className="space-y-2">
                    {(partnerView
                        ? ACTIONS.map((action) =>
                              action.label === "Resolve"
                                  ? PARTNER_RESOLVE_ACTION
                                  : action
                          )
                        : ACTIONS
                    ).map(({ icon: Icon, label, text }) => (
                        <li
                            key={label}
                            className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"
                        >
                            <Icon
                                size={16}
                                className="mt-0.5 shrink-0 text-gray-500 dark:text-gray-400"
                            />

                            <span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {label}:
                                </span>{" "}
                                {text}
                            </span>
                        </li>
                    ))}
                </ul>

                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    New and resolved alerts appear here live - no refresh
                    needed. Alerts are kept as history; they are resolved,
                    never deleted.
                </p>
            </section>

            <div className="flex justify-end">
                <Button onClick={onClose}>Got it</Button>
            </div>
        </div>
    </Modal>
);

export default GpsAlertsInfoModal;
