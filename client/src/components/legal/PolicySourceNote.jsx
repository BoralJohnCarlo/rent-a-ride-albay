import { FileCheck2 } from "lucide-react";

/*
 * Which rules set a refund, credit or charge (server lockedTermsService):
 * the booking's own terms ("booking") or today's policy because it was
 * kinder ("current"). Renders nothing for bookings made before terms were
 * locked (no source).
 */
const TEXT = {
    customer: {
        booking: (version) =>
            `Based on the terms you agreed to when booking (${version}).`,
        current: (version) =>
            `Today's policy applies: it's better for you than the terms you booked under (${version}).`,
    },
    admin: {
        booking: (version) => `Per the customer's booking terms (${version}).`,
        current: (version) =>
            `Today's policy applied: better for the customer than their booking terms (${version}).`,
    },
};

const PolicySourceNote = ({
    source,
    version,
    audience = "customer",
    // Inside a coloured notice: keep its colour rather than grey.
    inheritColor = false,
    className = "",
}) => {
    const describe = TEXT[audience]?.[source];

    if (!describe) {
        return null;
    }

    return (
        <p
            className={`flex items-start gap-1.5 text-xs font-normal ${
                inheritColor
                    ? "opacity-90"
                    : "text-gray-500 dark:text-gray-400"
            } ${className}`}
        >
            <FileCheck2 size={13} className="mt-0.5 shrink-0" />
            <span>
                {describe(version ? `Version ${version}` : "the version accepted")}
            </span>
        </p>
    );
};

export default PolicySourceNote;
