import api from "../lib/axios";

/*
 * Admin Excel exports. Both return the .xlsx file as a Blob; on an error the
 * server still answers JSON, which arrives as a Blob too (see
 * getExportErrorMessage).
 */

export const exportBookingsToExcel = async (bookingIds) => {
    const { data } = await api.post(
        "/exports/bookings",
        { bookingIds },
        { responseType: "blob" }
    );
    return data;
};

export const exportFinancialsToExcel = async ({ sections, from, to }) => {
    const { data } = await api.get("/exports/financials", {
        params: {
            sections: sections.join(","),
            ...(from && { from }),
            ...(to && { to }),
        },
        responseType: "blob",
    });
    return data;
};

/* The Fleet page's on-screen list, in order (pinned first). */
export const exportVehiclesToExcel = async (vehicleIds) => {
    const { data } = await api.post(
        "/exports/vehicles",
        { vehicleIds },
        { responseType: "blob" }
    );
    return data;
};

/* Consignments → Partners tab: Partners + Approved vehicles sheets. */
export const exportPartnersToExcel = async () => {
    const { data } = await api.get("/exports/partners", {
        responseType: "blob",
    });
    return data;
};

export const getExportErrorMessage = async (
    error,
    fallback = "Unable to export to Excel."
) => {
    const body = error?.response?.data;

    if (body instanceof Blob) {
        try {
            return JSON.parse(await body.text())?.message || fallback;
        } catch {
            return fallback;
        }
    }

    return body?.message || error?.message || fallback;
};
