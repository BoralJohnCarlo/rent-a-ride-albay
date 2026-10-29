import ExcelJS from "exceljs";

/*
 * Shared Excel (.xlsx) building for the admin exports. A sheet is described
 * by its columns and plain row objects; this handles the formatting so every
 * export reads the same: bold frozen header, filter dropdowns, peso amounts
 * stored as real numbers (so SUM/filters work), and Manila date-times.
 *
 * Column `type`: "text" (default), "money", "number", "date", "datetime".
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const NUMBER_FORMATS = {
    money: '"₱"#,##0.00;[Red]-"₱"#,##0.00',
    number: "#,##0.##",
    date: "mmm d, yyyy",
    datetime: "mmm d, yyyy h:mm AM/PM",
};

const HEADER_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
};

const TOTAL_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
};

/*
 * Excel has no time zones: it shows a date cell's wall-clock value as is,
 * and ExcelJS writes a Date by its UTC parts. Shifting by +8h makes the cell
 * read in Philippine time on any machine.
 */
export const toManilaCellDate = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Date(date.getTime() + MANILA_OFFSET_MS);
};

const toCellValue = (value, type) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (type === "date" || type === "datetime") {
        return toManilaCellDate(value);
    }

    if (type === "money" || type === "number") {
        const number = Number(value);

        return Number.isFinite(number) ? number : null;
    }

    // Always a plain string: a value like "=1+1" stays text, never a formula.
    return String(value);
};

const columnLetter = (index) => {
    let letter = "";
    let current = index;

    while (current > 0) {
        const remainder = (current - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        current = Math.floor((current - 1) / 26);
    }

    return letter;
};

const roundMoney = (value) =>
    Math.round((Number(value) || 0) * 100) / 100;

export const createWorkbook = () => {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Rent-A-Ride Albay";
    workbook.created = new Date();

    return workbook;
};

/*
 * Adds a formatted table sheet. `totals` lists column keys to total in a
 * row under the data; it uses SUBTOTAL(109, ...) so the total follows the
 * header filters (filter Status = Paid and it totals only those rows).
 */
export const addTableSheet = (
    workbook,
    { name, columns, rows, totals = [], totalLabel = "Total" }
) => {
    const sheet = workbook.addWorksheet(name, {
        views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = columns.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.width ?? 16,
        style: NUMBER_FORMATS[column.type]
            ? { numFmt: NUMBER_FORMATS[column.type] }
            : {},
    }));

    const header = sheet.getRow(1);

    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = HEADER_FILL;
    header.alignment = { vertical: "middle", wrapText: true };
    header.height = 30;

    for (const row of rows) {
        const values = {};

        for (const column of columns) {
            values[column.key] = toCellValue(
                row[column.key],
                column.type
            );
        }

        sheet.addRow(values);
    }

    if (columns.length > 0) {
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: {
                row: Math.max(1, rows.length + 1),
                column: columns.length,
            },
        };
    }

    if (totals.length > 0 && rows.length > 0) {
        const lastDataRow = rows.length + 1;
        const totalRow = sheet.addRow({});

        totalRow.getCell(1).value = totalLabel;

        columns.forEach((column, index) => {
            if (!totals.includes(column.key)) {
                return;
            }

            const letter = columnLetter(index + 1);
            const sum = rows.reduce(
                (total, row) => total + (Number(row[column.key]) || 0),
                0
            );

            totalRow.getCell(index + 1).value = {
                formula: `SUBTOTAL(109,${letter}2:${letter}${lastDataRow})`,
                result: roundMoney(sum),
            };
        });

        totalRow.font = { bold: true };
        totalRow.fill = TOTAL_FILL;
    }

    return sheet;
};

/*
 * A two-column label/value sheet for report totals. `lines` items are
 * { label, value, type } or { section } for a bold heading, or {} for a gap.
 */
export const addSummarySheet = (workbook, { name, title, lines }) => {
    const sheet = workbook.addWorksheet(name);

    sheet.columns = [
        { key: "label", width: 46 },
        { key: "value", width: 26 },
        { key: "note", width: 70 },
    ];

    const titleRow = sheet.addRow({ label: title });
    titleRow.font = { bold: true, size: 14 };

    for (const line of lines) {
        if (line.section) {
            sheet.addRow({});
            const row = sheet.addRow({ label: line.section });
            row.font = { bold: true, color: { argb: "FFFFFFFF" } };
            row.fill = HEADER_FILL;
            continue;
        }

        const row = sheet.addRow({
            label: line.label ?? "",
            value: toCellValue(line.value, line.type),
            note: line.note ?? "",
        });

        if (NUMBER_FORMATS[line.type]) {
            row.getCell("value").numFmt = NUMBER_FORMATS[line.type];
        }

        if (line.bold) {
            row.font = { bold: true };
        }

        row.getCell("note").font = {
            italic: true,
            color: { argb: "FF6B7280" },
        };
    }

    return sheet;
};

export const workbookToBuffer = async (workbook) =>
    Buffer.from(await workbook.xlsx.writeBuffer());

export const XLSX_CONTENT_TYPE =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
