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
const partitionAppointments = (consignments) => {
    const now = Date.now();

    const withAppointments = consignments
        .filter(
            (consignment) =>
                consignment?.application?.inspection?.scheduledDate
        )
        .map((consignment) => {
            const inspection = consignment.application.inspection;

            const appointmentDate = inspection.scheduledAt
                ? new Date(inspection.scheduledAt)
                : new Date(
                      `${inspection.scheduledDate}T${
                          inspection.scheduledTime || "00:00"
                      }:00`
                  );

            return {
                consignment,
                inspection,
                card: getConsignmentCardData(consignment),
                appointmentDate,
            };
        })
        .filter(
            (entry) => !Number.isNaN(entry.appointmentDate.getTime())
        );

    const upcoming = withAppointments
        .filter((entry) => entry.appointmentDate.getTime() >= now)
        .sort(
            (a, b) =>
                a.appointmentDate.getTime() - b.appointmentDate.getTime()
        );

    const past = withAppointments
        .filter((entry) => entry.appointmentDate.getTime() < now)
        .sort(
            (a, b) =>
                b.appointmentDate.getTime() - a.appointmentDate.getTime()
        );

    return { upcoming, past };
};

/*
 * Every place in the app that lets an operator book a vehicle inspection
 * slot (registration, a new consignment application, or rescheduling one
 * already submitted) writes to the same `application.inspection` fields on
 * the Consignment. Nothing previously aggregated those into one place to
 * actually see which vehicles have an appointment coming up - this reads
 * that straight off the consignment list already loaded by the page, so it
 * needs no new endpoint.
 */
const ConsignmentAppointmentsPanel = ({
    consignments = [],
    loading = false,
    showApplicant = false,
    onView,
}) => {
    const { upcoming, past } = useMemo(
        () => partitionAppointments(consignments),
        [consignments]
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
            <div className="flex items-center gap-3">
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

                <div>
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
                            {card.applicantName}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p className="flex items-center gap-1.5 font-medium">
                        <CalendarClock size={14} />
                        {formatDate(appointmentDate)}
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

                {onView && (
                    <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Eye size={14} />}
                        onClick={() => onView(consignment)}
                    >
                        View
                    </Button>
                )}
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
                        Past ({past.length})
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
