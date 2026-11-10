import { useMemo } from "react";
import { motion } from "framer-motion";
import {
    Building2,
    CalendarClock,
    CalendarX2,
    Car,
    Clock,
    Eye,
} from "lucide-react";

import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import LoadingSpinner from "../common/LoadingSpinner";
import StatusChip from "../common/StatusChip";

import getConsignmentCardData from "../../utils/getConsignmentCardData";
import formatDate from "../../utils/formatDate";
import useNowTicker from "../../hooks/gps/useNowTicker";

const formatTime12h = (time) => {
    if (!time) {
        return "";
    }

    const [hourString, minute] = time.split(":");
    const hour = Number(hourString);

    if (!Number.isFinite(hour)) {
        return time;
    }

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${displayHour}:${minute ?? "00"} ${period}`;
};

/*
 * Split into upcoming/past against "now" at call time. A standalone,
 * lowercase module-level function (rather than inline in the component
 * body) so the timestamp read stays out of the component's own render/memo
 * scope - same pattern as getTripProgress in TripProgressBar.jsx.
 */
const partitionAppointments = (consignments, now) => {

    const withAppointments = consignments
        .filter(
            (consignment) =>
                consignment?.application?.inspection?.scheduledDate
        )
        .map((consignment) => {
            const inspection = consignment.application.inspection;

            const appointmentDate = new Date(
                      `${inspection.scheduledDate}T${
                          inspection.scheduledTime || "00:00"
                      }:00+08:00`
                  );

            return {
                consignment,
                inspection,
                card: getConsignmentCardData(consignment),
                appointmentDate,
                active: consignment.registrationAppointment ? ["pending_review", "under_inspection"].includes(consignment.registrationVehicle.status) : ["Pending", "Under Review"].includes(consignment.application.status) && inspection.status === "Pending",
            };
        })
        .filter(
            (entry) => !Number.isNaN(entry.appointmentDate.getTime())
        );

    const upcoming = withAppointments
        .filter((entry) => entry.active && entry.appointmentDate.getTime() >= now)
        .sort(
            (a, b) =>
                a.appointmentDate.getTime() - b.appointmentDate.getTime()
        );

    const past = withAppointments
        .filter((entry) => !entry.active || entry.appointmentDate.getTime() < now)
        .sort(
            (a, b) =>
                b.appointmentDate.getTime() - a.appointmentDate.getTime()
        );

    return { upcoming, past };
};

// Shared appointment list; operators also supply registration inspections.
const ConsignmentAppointmentsPanel = ({
    consignments = [],
    registrationVehicles = [],
    loading = false,
    showApplicant = false,
    onView,
    onManage,
    onRegistrationManage,
    onRegistrationReview,
}) => {
    const now = useNowTicker(1000);
    const { upcoming, past } = useMemo(
        () => partitionAppointments([
            ...consignments,
            ...registrationVehicles.map((vehicle) => ({
                _id: `registration-${vehicle._id}`,
                registrationAppointment: true,
                registrationVehicle: vehicle,
                consignmentCode: "Registration inspection",
                snapshots: { vehicle },
                application: { inspection: { ...vehicle.inspection, status: ({ pending_review: "Scheduled", under_inspection: "Under Inspection", approved: "Completed", rejected: "Rejected" })[vehicle.status] || vehicle.status } },
            })),
        ], now),
        [consignments, registrationVehicles, now]
    );

    if (loading) {
        return <LoadingSpinner fullScreen={false} />;
    }

    if (upcoming.length === 0 && past.length === 0) {
        return (
            <EmptyState
                icon={CalendarX2}
                title="No Appointments Scheduled"
                description="Vehicle inspection appointments will show up here once they're booked."
            />
        );
    }

    const renderRow = ({ consignment, inspection, card, appointmentDate }) => (
        <motion.div
            key={consignment._id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                    {card.image ? (
                        <img
                            src={card.image}
                            alt={card.title}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <Car size={20} />
                    )}
                </div>

                <div className="min-w-0 break-words">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {card.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {card.consignmentCode}
                        {card.plateNumber
                            ? ` · ${card.plateNumber}`
                            : ""}
                    </p>
                    {showApplicant && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Building2 size={12} />
                            {consignment.registrationAppointment ? [consignment.registrationVehicle.operator?.firstName, consignment.registrationVehicle.operator?.lastName].filter(Boolean).join(" ") : card.applicantName}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p className="flex items-center gap-1.5 font-medium">
                        <CalendarClock size={14} />
                        {formatDate(appointmentDate, { timeZone: "Asia/Manila" })}
                    </p>
                    {inspection.scheduledTime && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Clock size={12} />
                            {formatTime12h(inspection.scheduledTime)}
                        </p>
                    )}
                </div>

                <StatusChip
                    status={inspection.status}
                    size="sm"
                />

                {onView && !consignment.registrationAppointment && (
                    <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Eye size={14} />}
                        onClick={() => onView(consignment)}
                    >
                        View
                    </Button>
                )}
                {!consignment.registrationAppointment && onManage && ["Pending", "Under Review"].includes(consignment.application.status) && inspection.status === "Pending" && consignment.reschedule?.status !== "Pending" && <Button size="sm" variant="outline" className="min-h-11" onClick={() => onManage(consignment)}>Reschedule</Button>}
                {consignment.registrationAppointment && <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {onRegistrationManage && ["pending_review", "under_inspection"].includes(consignment.registrationVehicle.status) && consignment.registrationVehicle.reschedule?.status !== "Pending" && <Button size="sm" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => onRegistrationManage(consignment.registrationVehicle)}>Reschedule</Button>}
                    {["pending_review", "under_inspection"].includes(consignment.registrationVehicle.status) && consignment.registrationVehicle.reschedule?.status === "Pending" && (onRegistrationReview ? <Button size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => onRegistrationReview(consignment.registrationVehicle)}>Review Reschedule</Button> : <span className="text-sm text-amber-700 dark:text-amber-300">Reschedule awaiting admin approval</span>)}
                    {consignment.registrationVehicle.reschedule?.status === "Rejected" && consignment.registrationVehicle.reschedule?.reviewRemarks && <p className="w-full break-words text-sm text-red-600 dark:text-red-400">Reschedule declined: {consignment.registrationVehicle.reschedule.reviewRemarks}</p>}
                </div>}
            </div>
        </motion.div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Upcoming ({upcoming.length})
                </h3>

                {upcoming.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        No upcoming appointments.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {upcoming.map(renderRow)}
                    </div>
                )}
            </div>

            {past.length > 0 && (
                <div>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Past &amp; Closed ({past.length})
                    </h3>

                    <div className="space-y-3 opacity-75">
                        {past.map(renderRow)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsignmentAppointmentsPanel;
