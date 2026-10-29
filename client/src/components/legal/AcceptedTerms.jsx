import { useMemo, useState } from "react";
import { AlertCircle, FileCheck2 } from "lucide-react";

import Button from "../common/Button";
import Modal from "../common/Modal";
import TermsAgreement from "../booking/TermsAgreement";
import LegalDocumentPreview from "./LegalDocumentPreview";

import { useLegalDocumentVersion } from "../../hooks/legal/useLegalDocument";
import { normalizePublicSettings } from "../../hooks/settings/usePublicRefundSettings";

import {
    LEGAL_DOCUMENT_CONFIG,
    LEGAL_DOCUMENT_TYPES,
} from "../../constants/legalDocuments";
import { formatLegalDateTime } from "../../utils/legalDocumentFormat";

const titleOf = (type) =>
    type === LEGAL_DOCUMENT_TYPES.PARTNER_TERMS
        ? LEGAL_DOCUMENT_CONFIG[type].label
        : "Terms & Conditions";

/*
 * A legal document version someone accepted: `acceptance` is
 * { document, version, acceptedAt, policySnapshot? }. A booking's carries
 * the settings its live policy blocks were written from, so it reads as it
 * did when they booked whatever has been edited since. Registrations have
 * no snapshot; their live blocks then show today's settings.
 */
export const AcceptedTermsModal = ({
    isOpen,
    onClose,
    acceptance,
    type = LEGAL_DOCUMENT_TYPES.BOOKING_TERMS,
}) => {
    const { document, loading, error } = useLegalDocumentVersion(
        isOpen ? acceptance?.document : null
    );

    const snapshot = acceptance?.policySnapshot ?? null;

    const policyValues = useMemo(
        () => (snapshot ? normalizePublicSettings(snapshot) : null),
        [snapshot]
    );

    const isBookingTerms = type === LEGAL_DOCUMENT_TYPES.BOOKING_TERMS;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            title={`${titleOf(type)} — Version ${acceptance?.version ?? ""}`}
            description={
                acceptance?.acceptedAt
                    ? `Accepted ${formatLegalDateTime(acceptance.acceptedAt)} (Philippine time)`
                    : undefined
            }
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            }
        >
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-yellow-500 dark:border-gray-700 dark:border-t-yellow-400" />
                </div>
            ) : error || !document ? (
                <p className="flex items-center gap-2 py-8 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle size={16} />
                    {error || "This version couldn't be loaded."}
                </p>
            ) : isBookingTerms && policyValues ? (
                <TermsAgreement
                    document={document}
                    policyValues={policyValues}
                    readOnly
                />
            ) : (
                <>
                    {isBookingTerms && (
                        <p className="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                            The wording is exactly this version. Lines about
                            fees and times show today&apos;s settings; each
                            booking keeps its own.
                        </p>
                    )}
                    <LegalDocumentPreview type={type} document={document} />
                </>
            )}
        </Modal>
    );
};

/*
 * "Terms & Conditions · Version 3 · Accepted Oct 10, 2026 · View". Records
 * from before versions were kept show `legacyText` (or nothing).
 */
const AcceptedTerms = ({
    acceptance,
    type = LEGAL_DOCUMENT_TYPES.BOOKING_TERMS,
    legacyText = "",
    className = "",
}) => {
    const [open, setOpen] = useState(false);

    if (!acceptance?.document) {
        return legacyText ? (
            <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
                {legacyText}
            </p>
        ) : null;
    }

    return (
        <>
            <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800 ${className}`}
            >
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400">
                        <FileCheck2 size={17} />
                    </span>

                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {titleOf(type)} · Version {acceptance.version}
                        </p>
                        {acceptance.acceptedAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Accepted {formatLegalDateTime(acceptance.acceptedAt)}
                            </p>
                        )}
                    </div>
                </div>

                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setOpen(true)}
                >
                    View
                </Button>
            </div>

            <AcceptedTermsModal
                isOpen={open}
                onClose={() => setOpen(false)}
                acceptance={acceptance}
                type={type}
            />
        </>
    );
};

export default AcceptedTerms;
