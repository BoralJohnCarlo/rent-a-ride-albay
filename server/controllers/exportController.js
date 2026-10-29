import mongoose from "mongoose";

import {
    MAX_EXPORT_BOOKINGS,
    buildBookingsWorkbook,
    buildFinancialWorkbook,
    parseDateRange,
    parseFinancialSections,
} from "../services/exportService.js";
import {
    MAX_EXPORT_VEHICLES,
    buildPartnersWorkbook,
    buildVehiclesWorkbook,
} from "../services/fleetExportService.js";
import { XLSX_CONTENT_TYPE } from "../utils/excelExport.js";
import { errorResponse } from "../utils/response.js";

const sendWorkbook = (res, buffer, fileName) => {
    res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
    );
    res.setHeader("Cache-Control", "no-store");

    return res.send(buffer);
};

/*
 * POST /exports/bookings  { bookingIds: [...] }
 * The ids are the admin's filtered, sorted Bookings list, so the file holds
 * exactly the rows they were looking at, in the same order.
 */
export const exportBookings = async (req, res) => {
    try {
        const { bookingIds } = req.body ?? {};

        if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
            return errorResponse(res, "There are no bookings to export.", 400);
        }

        if (bookingIds.length > MAX_EXPORT_BOOKINGS) {
            return errorResponse(
                res,
                `You can export up to ${MAX_EXPORT_BOOKINGS.toLocaleString()} bookings at a time. Narrow the filters and try again.`,
                400
            );
        }

        if (
            !bookingIds.every(
                (id) =>
                    typeof id === "string" &&
                    mongoose.Types.ObjectId.isValid(id)
            )
        ) {
            return errorResponse(res, "Invalid booking id in the export.", 400);
        }

        const { buffer } = await buildBookingsWorkbook(bookingIds);

        return sendWorkbook(res, buffer, "bookings.xlsx");
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

/*
 * POST /exports/vehicles  { vehicleIds: [...] }
 * The Fleet page's current tab + search + filters (every page), in its
 * on-screen order, pinned vehicles first.
 */
export const exportVehicles = async (req, res) => {
    try {
        const { vehicleIds } = req.body ?? {};

        if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
            return errorResponse(res, "There are no vehicles to export.", 400);
        }

        if (vehicleIds.length > MAX_EXPORT_VEHICLES) {
            return errorResponse(
                res,
                `You can export up to ${MAX_EXPORT_VEHICLES.toLocaleString()} vehicles at a time. Narrow the filters and try again.`,
                400
            );
        }

        if (
            !vehicleIds.every(
                (id) =>
                    typeof id === "string" &&
                    mongoose.Types.ObjectId.isValid(id)
            )
        ) {
            return errorResponse(res, "Invalid vehicle id in the export.", 400);
        }

        const { buffer } = await buildVehiclesWorkbook(vehicleIds);

        return sendWorkbook(res, buffer, "fleet.xlsx");
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

/*
 * GET /exports/partners
 * Consignments → Partners tab: every approved, non-archived consignment.
 */
export const exportPartners = async (req, res) => {
    try {
        const { buffer } = await buildPartnersWorkbook();

        return sendWorkbook(res, buffer, "approved-partners.xlsx");
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

/*
 * GET /exports/financials?sections=payments,refunds,payouts&from=&to=
 * Dates are Manila calendar days ("YYYY-MM-DD"), both optional.
 */
export const exportFinancials = async (req, res) => {
    try {
        const sections = parseFinancialSections(req.query.sections);
        const range = parseDateRange({
            from: req.query.from,
            to: req.query.to,
        });

        const generatedBy = [req.user?.firstName, req.user?.lastName]
            .filter(Boolean)
            .join(" ");

        const { buffer } = await buildFinancialWorkbook({
            sections,
            range,
            generatedBy,
        });

        return sendWorkbook(res, buffer, "financial-report.xlsx");
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};
