import { useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    RefreshCw,
} from "lucide-react";

import useLegalDocument from "../../hooks/legal/useLegalDocument";

import LegalSectionIcon from "../legal/LegalSectionIcon";

import { LEGAL_DOCUMENT_TYPES } from "../../constants/legalDocuments";
import { formatLegalDate } from "../../utils/legalDocumentFormat";
import { resolveLegalSections } from "../../utils/termsLiveBlocks";

/*
 * Partner/consignment-specific terms — distinct from the customer-facing
 * TermsAgreement.jsx (booking/refund/cancellation focused). The wording is
 * the published Partner Terms from Settings → Terms & Policies;
 * `onVersionChange(id)` reports the version shown, which the wizard sends
 * when the application is submitted so that version is recorded.
 */

function TermsSection({ section, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section
            id={section.key}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                aria-expanded={open}
                aria-controls={`${section.key}-content`}
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        <LegalSectionIcon name={section.icon} size={17} strokeWidth={2} />
                    </span>

                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {section.title}
                    </span>
                </span>

                <ChevronDown
                    size={18}
                    className={`shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>

            {open && (
                <div
                    id={`${section.key}-content`}
                    className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800"
                >
                    <ul className="space-y-2.5">
                        {section.lines.map((line, index) => (
                            <li
                                key={index}
                                className="flex gap-2.5 text-sm leading-6 text-gray-600 dark:text-gray-400"
                            >
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                <span className="whitespace-pre-line">{line}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

const ConsignmentTermsAgreement = ({
    accepted = false,
    onChange,
    error = "",
    disabled = false,
    onVersionChange,
    // Bump to fetch the newest version (after the server refused an old one).
    reloadKey = 0,
}) => {
    const { document, error: loadError, reload } = useLegalDocument(
        LEGAL_DOCUMENT_TYPES.PARTNER_TERMS
    );

    const firstReloadKey = useRef(reloadKey);

    useEffect(() => {
        if (reloadKey !== firstReloadKey.current) {
            reload();
        }
    }, [reloadKey, reload]);

    const documentId = document?._id ?? null;

    useEffect(() => {
        if (documentId) {
            onVersionChange?.(documentId);
        }
        // Report each version once, not on every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentId]);

    if (!document) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-10 text-center dark:border-gray-800 dark:bg-gray-900">
                {loadError ? (
                    <>
                        <AlertCircle size={22} className="text-red-500 dark:text-red-400" />
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {loadError}
                        </p>
                        <button
                            type="button"
                            onClick={reload}
                            className="dashboard-primary-button inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <RefreshCw size={14} />
                            Try again
                        </button>
                    </>
                ) : (
                    <>
                        <div className="h-7 w-7 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Loading the Partner Terms…
                        </p>
                    </>
                )}

                {error && (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
            </div>
        );
    }

    const sections = resolveLegalSections(document);

    return (
        <div className="space-y-5">
            {document.notice?.body && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                    <div className="flex gap-3">
                        <AlertCircle
                            size={18}
                            className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                        />

                        <p className="whitespace-pre-line text-sm leading-6 text-blue-800 dark:text-blue-300">
                            {document.notice.body}
                        </p>
                    </div>
                </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
                {document.title} · Version {document.version}
                {document.publishedAt &&
                    ` · Effective ${formatLegalDate(document.publishedAt)}`}
            </p>

            <div className="space-y-3">
                {sections.map((section, index) => (
                    <TermsSection
                        key={section.key}
                        section={section}
                        defaultOpen={index === 0}
                    />
                ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <label className="flex cursor-pointer items-start gap-3">
                    <input
                        type="checkbox"
                        checked={accepted}
                        disabled={disabled}
                        onChange={(event) =>
                            onChange?.(
                                event.target.checked
                            )
                        }
                        className="mt-1 h-4 w-4 shrink-0 accent-blue-600 disabled:cursor-not-allowed"
                    />

                    <span className="flex items-start gap-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                        <CheckCircle2
                            size={16}
                            className="mt-0.5 shrink-0 text-blue-500"
                        />
                        <span>{document.acceptanceLabel}</span>
                    </span>
                </label>

                {error && (
                    <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ConsignmentTermsAgreement;
