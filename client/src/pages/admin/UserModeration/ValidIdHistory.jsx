import { useCallback, useEffect, useState } from "react";

import { FileClock, ImageOff } from "lucide-react";

import Button from "../../../components/common/Button";
import LoadingSpinner from "../../../components/common/LoadingSpinner";

import { fetchValidIdHistory } from "../../../services/userService";

const SOURCE_LABELS = {
    registration: "Uploaded at registration",
    profile_update: "Changed from profile",
    renewal: "Renewal upload",
    on_file: "On file before history was kept",
};

const fmtDate = (value) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "";

const openImage = (url) =>
    window.open(url, "_blank", "noopener,noreferrer");

const DocumentImage = ({ url, label }) =>
    url ? (
        <button
            type="button"
            onClick={() => openImage(url)}
            className="group relative block h-24 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
            <img
                src={url}
                alt={`Valid ID (${label.toLowerCase()})`}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:opacity-80"
            />

            <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {label}
            </span>
        </button>
    ) : (
        <div className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400 dark:border-gray-700 dark:text-gray-500">
            <ImageOff size={16} />
            No {label.toLowerCase()}
        </div>
    );

const Detail = ({ label, children }) => (
    <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200">
            {children}
        </dd>
    </div>
);

const HistoryEntry = ({ record }) => {
    const expired =
        record.expirationDate &&
        new Date(record.expirationDate) < new Date();

    return (
        <li
            className={`rounded-xl border p-4 ${
                record.isCurrent
                    ? "border-blue-200 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-700"
            }`}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        record.isCurrent
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                >
                    {record.isCurrent ? "Current" : "Past"}
                </span>

                {expired && (
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                        Expired
                    </span>
                )}

                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {record.validIdType || "Type not specified"}
                </span>

                <span className="text-xs text-gray-500 dark:text-gray-400">
                    · {SOURCE_LABELS[record.source] ?? record.source}
                </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
                <DocumentImage url={record.frontImage} label="Front" />
                <DocumentImage url={record.backImage} label="Back" />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Detail label="Uploaded">
                    {fmtDate(record.uploadedAt) || "Unknown"}
                </Detail>

                <Detail label={record.isCurrent ? "In use" : "Replaced"}>
                    {record.isCurrent
                        ? "Now"
                        : fmtDate(record.replacedAt)}
                </Detail>

                <Detail label="Expiry">
                    {fmtDate(record.expirationDate) || "None recorded"}
                </Detail>

                <Detail label="Verified">
                    {record.verifiedAt
                        ? `${fmtDate(record.verifiedAt)}${
                              record.verifiedBy?.name
                                  ? ` · ${record.verifiedBy.name}`
                                  : ""
                          }`
                        : "Not recorded"}
                </Detail>
            </dl>
        </li>
    );
};

/*
 * Every valid ID a customer or partner has had on file: the current one
 * first, then the ones it replaced, newest first. `refreshKey` reloads the
 * list after the parent verifies the ID.
 */
const ValidIdHistory = ({ userId, refreshKey }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!userId) {
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetchValidIdHistory(userId);
            setRecords(response?.data ?? []);
        } catch (loadError) {
            setRecords([]);
            setError(
                loadError?.response?.data?.message ||
                    "Unable to load the ID history."
            );
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    if (loading && records.length === 0) {
        return (
            <div className="flex justify-center py-6">
                <LoadingSpinner size="sm" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-rose-600 dark:text-rose-400">
                    {error}
                </p>
                <Button size="sm" variant="outline" onClick={load}>
                    Retry
                </Button>
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <FileClock size={16} />
                No valid ID on file.
            </div>
        );
    }

    return (
        <ul className="space-y-3">
            {records.map((record, index) => (
                <HistoryEntry
                    key={record.id ?? `current-${index}`}
                    record={record}
                />
            ))}
        </ul>
    );
};

export default ValidIdHistory;
