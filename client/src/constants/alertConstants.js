import { WifiOff, MapPinOff, BatteryLow, Power } from "lucide-react";

/*
 * Mirrors server/constants/alertConstants.js - the two can't literally share
 * a module across the client/server boundary, so the string values are kept
 * in sync by hand. Never invent a client-only alert type/status here.
 */
export const ALERT_TYPE = {
    GPS_OFFLINE: "GPS_OFFLINE",
    GPS_LOST: "GPS_LOST",
    LOW_BATTERY: "LOW_BATTERY",
    IGNITION_ON: "IGNITION_ON",
};

export const ALERT_TYPE_ICONS = {
    [ALERT_TYPE.GPS_OFFLINE]: WifiOff,
    [ALERT_TYPE.GPS_LOST]: MapPinOff,
    [ALERT_TYPE.LOW_BATTERY]: BatteryLow,
    [ALERT_TYPE.IGNITION_ON]: Power,
};

// Mirrors the backend's LOW_BATTERY_THRESHOLD_PERCENT - display only.
export const LOW_BATTERY_THRESHOLD_PERCENT = 20;

export const ALERT_TYPE_LABELS = {
    [ALERT_TYPE.GPS_OFFLINE]: "GPS Offline",
    [ALERT_TYPE.GPS_LOST]: "GPS Lost",
    [ALERT_TYPE.LOW_BATTERY]: "Low Battery",
    [ALERT_TYPE.IGNITION_ON]: "Ignition On",
};

export const ALERT_SEVERITY = {
    INFO: "info",
    WARNING: "warning",
    CRITICAL: "critical",
};

export const ALERT_SEVERITY_LABELS = {
    [ALERT_SEVERITY.INFO]: "Info",
    [ALERT_SEVERITY.WARNING]: "Warning",
    [ALERT_SEVERITY.CRITICAL]: "Critical",
};

// Badge variants (see components/common/Badge.jsx) chosen for the alert
// module's own use - deliberately not the shared StatusChip, since its
// STATUS_MAP already assigns "active"/"resolved" a different meaning
// (tracker/booking-style, green "Active") that would be misleading for an
// unresolved alert.
export const ALERT_SEVERITY_BADGE_VARIANT = {
    [ALERT_SEVERITY.INFO]: "info",
    [ALERT_SEVERITY.WARNING]: "warning",
    [ALERT_SEVERITY.CRITICAL]: "danger",
};

export const ALERT_STATUS = {
    ACTIVE: "active",
    RESOLVED: "resolved",
};

export const ALERT_STATUS_LABELS = {
    [ALERT_STATUS.ACTIVE]: "Active",
    [ALERT_STATUS.RESOLVED]: "Resolved",
};

export const ALERT_STATUS_BADGE_VARIANT = {
    [ALERT_STATUS.ACTIVE]: "warning",
    [ALERT_STATUS.RESOLVED]: "success",
};
