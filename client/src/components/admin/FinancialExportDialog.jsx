import { useState } from "react";

import { Download } from "lucide-react";

import Button from "../common/Button";
import Checkbox from "../common/Checkbox";
import DatePicker from "../common/DatePicker";
import Modal from "../common/Modal";

import useToast from "../../hooks/toast/useToast";
import {
    exportFinancialsToExcel,
    getExportErrorMessage,
} from "../../api/exportApi";
import { downloadBlob, manilaDateStamp } from "../../utils/downloadFile";

/*
 * Financials → "Export to Excel": one workbook with a Summary sheet plus a
 * sheet per chosen section. Payouts have no admin page of their own, so this
 * is where they are exported from.
 */
const SECTIONS = [
    {
        key: "payments",
        label: "Payments",
        hint: "Online booking fees, plus payments recorded on rentals (e.g. the balance paid at pickup).",
    },
    {
        key: "refunds",
        label: "Refunds",
        hint: "Rental refunds, booking-fee refunds and owed refunds paid by hand.",
    },
    {
        key: "payouts",
        label: "Partner payouts",
        hint: "Partner earnings per booking, commission, and wallet withdrawals to GCash.",
    },
];

const monthRange = (offset) => {
    const today = manilaDateStamp();
    const [year, month] = today.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1 + offset, 1));
    const last = new Date(Date.UTC(year, month + offset, 0));
    const key = (date) => date.toISOString().slice(0, 10);

    return {
        from: key(first),
        // The current month stops at today.
        to: offset === 0 ? today : key(last),
    };
};

const PRESETS = [
    { key: "this-month", label: "This month", range: () => monthRange(0) },
    { key: "last-month", label: "Last month", range: () => monthRange(-1) },
    { key: "all", label: "All time", range: () => ({ from: "", to: "" }) },
];

const FinancialExportDialog = ({ open, onClose }) => {
    const toast = useToast();

    const [sections, setSections] = useState(
        SECTIONS.map((section) => section.key)
    );
    const [range, setRange] = useState({ from: "", to: "" });
    const [exporting, setExporting] = useState(false);

    const toggleSection = (key) =>
        setSections((current) =>
            current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key]
        );

    const rangeError =
        range.from && range.to && range.from > range.to
            ? "The start date must be on or before the end date."
            : "";

    const close = () => {
        if (!exporting) {
            onClose();
        }
    };

    const handleExport = async () => {
        setExporting(true);

        try {
            const file = await exportFinancialsToExcel({
                sections,
                from: range.from,
                to: range.to,
            });

            const period =
                range.from || range.to
                    ? `${range.from || "start"}-to-${range.to || manilaDateStamp()}`
                    : `all-time-${manilaDateStamp()}`;

            downloadBlob(file, `financial-report-${period}.xlsx`);

            toast.success(
                "Your Excel file has been downloaded.",
                "Export ready"
            );
            onClose();
        } catch (error) {
            toast.error(
                await getExportErrorMessage(error),
                "Export failed"
            );
        } finally {
            setExporting(false);
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={close}
            title="Export to Excel"
            description="Download a financial report with a Summary sheet and one sheet per section."
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={close}
                        disabled={exporting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="success"
                        leftIcon={<Download size={16} />}
                        loading={exporting}
                        disabled={sections.length === 0 || Boolean(rangeError)}
                        onClick={handleExport}
                    >
                        Download
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                <fieldset className="space-y-3">
                    <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                        Include
                    </legend>

                    {SECTIONS.map((section) => (
                        <div key={section.key}>
                            <Checkbox
                                id={`export-${section.key}`}
                                label={section.label}
                                checked={sections.includes(section.key)}
                                onChange={() => toggleSection(section.key)}
                                disabled={exporting}
                            />
                            <p className="ml-7 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                {section.hint}
                            </p>
                        </div>
                    ))}

                    {sections.length === 0 && (
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            Choose at least one section.
                        </p>
                    )}
                </fieldset>

                <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                        Period
                    </legend>

                    <div className="mb-3 flex flex-wrap gap-2">
                        {PRESETS.map((preset) => {
                            const presetRange = preset.range();
                            const active =
                                presetRange.from === range.from &&
                                presetRange.to === range.to;

                            return (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => setRange(presetRange)}
                                    disabled={exporting}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                        active
                                            ? "bg-emerald-600 text-white dark:bg-emerald-500"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DatePicker
                            label="From"
                            placeholder="Earliest"
                            value={range.from}
                            max={range.to || undefined}
                            onChange={(event) =>
                                setRange((current) => ({
                                    ...current,
                                    from: event.target.value,
                                }))
                            }
                            disabled={exporting}
                        />
                        <DatePicker
                            label="To"
                            placeholder="Latest"
                            value={range.to}
                            min={range.from || undefined}
                            onChange={(event) =>
                                setRange((current) => ({
                                    ...current,
                                    to: event.target.value,
                                }))
                            }
                            error={rangeError}
                            disabled={exporting}
                        />
                    </div>

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Dates are Philippine time. Payments are dated when
                        received, refunds when requested, payouts when
                        created. Leave both empty for all time.
                    </p>
                </fieldset>
            </div>
        </Modal>
    );
};

export default FinancialExportDialog;
