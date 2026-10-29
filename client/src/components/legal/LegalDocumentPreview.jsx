import { AlertCircle } from "lucide-react";

import TermsAgreement from "../booking/TermsAgreement";
import LegalSectionIcon from "./LegalSectionIcon";

import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";

import {
    LEGAL_DOCUMENT_CONFIG,
    LEGAL_DOCUMENT_TYPES,
} from "../../constants/legalDocuments";
import { formatLegalDate } from "../../utils/legalDocumentFormat";
import { resolveLegalSections } from "../../utils/termsLiveBlocks";

/*
 * A document as its readers will see it, for the admin editor and version
 * history. The booking terms use the customer component itself; live
 * blocks are written from today's settings.
 */
const LegalDocumentPreview = ({ type, document }) => {
    const values = usePublicRefundSettings();

    if (type === LEGAL_DOCUMENT_TYPES.BOOKING_TERMS) {
        return (
            <TermsAgreement
                document={document}
                policyValues={values}
                readOnly
            />
        );
    }

    const config = LEGAL_DOCUMENT_CONFIG[type];
    const sections = resolveLegalSections(document, values);

    return (
        <div className="space-y-5 px-1 py-2">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {document.title}
                </h2>

                {document.intro && (
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                        {document.intro}
                    </p>
                )}

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Version {document.version}
                    {document.publishedAt &&
                        ` · Effective ${formatLegalDate(document.publishedAt)}`}
                </p>
            </div>

            {document.notice?.body && (
                <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                    <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                    />
                    <div>
                        {document.notice.title && (
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                                {document.notice.title}
                            </p>
                        )}
                        <p className="whitespace-pre-line text-sm leading-6 text-blue-800 dark:text-blue-300">
                            {document.notice.body}
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {sections.map((section, index) => {
                    return (
                        <section
                            key={section.key || index}
                            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                        >
                            <h3 className="flex items-center gap-2.5 text-sm font-semibold text-gray-900 dark:text-white">
                                {config.icons ? (
                                    <LegalSectionIcon
                                        name={section.icon}
                                        size={16}
                                        className="shrink-0 text-blue-600 dark:text-blue-400"
                                    />
                                ) : (
                                    <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                )}
                                {section.title}
                            </h3>

                            <ul className="mt-2.5 space-y-2">
                                {section.lines.map((line, lineIndex) => (
                                    <li
                                        key={lineIndex}
                                        className="flex gap-2.5 text-sm leading-6 text-gray-600 dark:text-gray-400"
                                    >
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                                        <span className="whitespace-pre-line">
                                            {line}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>

            {config.acceptance && document.acceptanceLabel && (
                <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                    <input
                        type="checkbox"
                        disabled
                        className="mt-1 h-4 w-4 shrink-0"
                    />
                    {document.acceptanceLabel}
                </label>
            )}
        </div>
    );
};

export default LegalDocumentPreview;
