import { motion } from "framer-motion";
import {
    ChevronDown,
    ChevronUp,
    Eye,
    ImageOff,
    Check,
    X,
} from "lucide-react";
import { useState } from "react";

import formatDate from "../../utils/formatDate";

/* "2026-10-14" + "09:00" → "Oct 14, 2026 · 9:00 AM" */
const formatInspectionSlot = ({ scheduledDate, scheduledTime } = {}) => {
    if (!scheduledDate) {
        return null;
    }

    const date = new Date(`${scheduledDate}T${scheduledTime || "00:00"}:00`);

    if (Number.isNaN(date.getTime())) {
        return `${scheduledDate} ${scheduledTime || ""}`.trim();
    }

    const day = date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    return scheduledTime
        ? `${day} · ${date.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
          })}`
        : day;
};

const PendingVehicleCard = ({
    pendingVehicle,
    onView,
    onApprove,
    onReject,
    isSelected = false,
    className = ""
}) => {
    const [expanded, setExpanded] = useState(false);

    const images = Array.isArray(pendingVehicle.images) ? pendingVehicle.images : [];
    const primaryImage = images.find((img) => img.isPrimary)?.url || images[0]?.url || null;

    const operator = pendingVehicle.operator || {};

    const inspectionSlot = formatInspectionSlot(pendingVehicle.inspection);

    const title = [pendingVehicle.brand, pendingVehicle.model]
        .filter(Boolean)
        .join(" ") || "Unnamed Vehicle";

    const statusColors = {
        pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        under_inspection: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
    };

    const statusLabels = {
        pending_review: "Pending Review",
        under_inspection: "Under Inspection",
        approved: "Approved",
        rejected: "Rejected"
    };

    return (
        <motion.div
            className={`group ${isSelected ? "ring-2 ring-blue-500" : ""} rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900 ${className}`}
            layout
        >
            <div className="flex items-center gap-4">
                {primaryImage ? (
                    <img
                        src={primaryImage}
                        alt={title}
                        className="h-12 w-12 rounded-lg object-cover"
                    />
                ) : (
                    <div className="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 dark:bg-gray-800">
                        <ImageOff className="h-6 w-6" />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {title}
                        </h3>
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[pendingVehicle.status]}`}>
                            {statusLabels[pendingVehicle.status]}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                        {pendingVehicle.plateNumber || "No plate number"} • {pendingVehicle.vehicleType || "Unknown type"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        Partner: {operator.firstName} {operator.lastName} • {formatDate(pendingVehicle.createdAt)}
                    </p>
                    {inspectionSlot && (
                        <p className="mt-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 truncate">
                            Inspection: {inspectionSlot}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            setExpanded(true);
                            onView?.(pendingVehicle);
                        }}
                        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="View details"
                    >
                        <Eye size={16} />
                    </button>

                    {(pendingVehicle.status === "pending_review" || pendingVehicle.status === "under_inspection") &&
                    (onApprove || onReject) ? (
                        <>
                            {onApprove && (
                                <button
                                    type="button"
                                    onClick={() => onApprove?.(pendingVehicle)}
                                    className="p-2 rounded hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-950/30 transition-colors"
                                    title="Approve"
                                >
                                    <Check size={16} />
                                </button>
                            )}
                            {onReject && (
                                <button
                                    type="button"
                                    onClick={() => onReject?.(pendingVehicle)}
                                    className="p-2 rounded hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/30 transition-colors"
                                    title="Reject"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${expanded ? "bg-blue-50" : ""}`}
                        title={expanded ? "Collapse" : "Expand"}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700 space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Partner Information</h4>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-gray-500">Name</p>
                                <p className="text-sm">{operator.firstName} {operator.lastName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Email</p>
                                <p className="text-sm truncate">{operator.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Phone</p>
                                <p className="text-sm">{operator.phoneNumber || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Submitted</p>
                                <p className="text-sm">{formatDate(pendingVehicle.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Inspection Appointment</p>
                                <p className="text-sm">{inspectionSlot || "Not booked"}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Vehicle Details</h4>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-gray-500">Vehicle Type</p>
                                <p className="text-sm">{pendingVehicle.vehicleType}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Brand / Model</p>
                                <p className="text-sm">{pendingVehicle.brand} {pendingVehicle.model} {pendingVehicle.variant || ""}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Year</p>
                                <p className="text-sm">{pendingVehicle.year || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Plate Number</p>
                                <p className="text-sm">{pendingVehicle.plateNumber || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Registration Number</p>
                                <p className="text-sm">{pendingVehicle.registrationNumber || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Transmission</p>
                                <p className="text-sm">{pendingVehicle.specifications?.transmission || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Fuel Type</p>
                                <p className="text-sm">{pendingVehicle.specifications?.fuelType || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Seats</p>
                                <p className="text-sm">{pendingVehicle.specifications?.seatingCapacity || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Condition</p>
                                <p className="text-sm">{pendingVehicle.condition || "—"}</p>
                            </div>
                            {pendingVehicle.rejectionReason ? (
                                <div>
                                    <p className="text-xs text-gray-500">Rejection Reason</p>
                                    <p className="text-sm text-rose-600">{pendingVehicle.rejectionReason}</p>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Pricing</h4>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div>
                                <p className="text-xs text-gray-500">Daily Rate</p>
                                <p className="text-sm">₱{Number(pendingVehicle.pricing?.dailyRate || 0).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Reservation Fee</p>
                                <p className="text-sm">₱{Number(pendingVehicle.pricing?.reservationFee || 0).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Security Deposit</p>
                                <p className="text-sm">
                                    {pendingVehicle.pricing?.securityDeposit?.enabled
                                        ? `₱${Number(pendingVehicle.pricing.securityDeposit.amount || 0).toLocaleString()}`
                                        : "None"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {(() => {
                        const docs = [
                            ...(pendingVehicle.documents?.officialReceipt || []).map((d) => ({ ...d, label: "Official Receipt" })),
                            ...(pendingVehicle.documents?.certificateOfRegistration || []).map((d) => ({ ...d, label: "Certificate of Registration" })),
                        ].filter((d) => d.url);

                        return (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Documents</h4>
                                {docs.length === 0 ? (
                                    <p className="text-sm text-gray-500">No documents uploaded.</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {docs.map((doc, idx) => (
                                            <li key={idx}>
                                                <a
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:underline"
                                                >
                                                    {doc.label}
                                                    {doc.originalName ? ` — ${doc.originalName}` : ""}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })()}

                    {images.length > 0 ? (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Images</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {images.map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img.url}
                                        alt={`${title} ${idx + 1}`}
                                        className="h-20 w-full rounded object-cover"
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </motion.div>
    );
};

export default PendingVehicleCard;