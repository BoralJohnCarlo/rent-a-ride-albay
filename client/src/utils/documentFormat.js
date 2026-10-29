/* Shared by the printable documents (receipts, booking statements). */

export const BRAND_NAME = "Rent-A-Ride Albay";

export const ACKNOWLEDGEMENT_NOTE =
    "This is an acknowledgement receipt for your records. It is not a BIR official receipt or sales invoice.";

export const formatPeso = (value) => {
    const amount = Number(value) || 0;
    const sign = amount < 0 ? "−" : "";

    return `${sign}₱${Math.abs(amount).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/* A date (and time) as it reads in the Philippines. */
export const formatDocDate = (value, { withTime = true } = {}) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    });
};
