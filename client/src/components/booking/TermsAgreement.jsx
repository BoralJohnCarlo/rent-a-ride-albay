import { useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    FileCheck2,
    RefreshCw,
} from "lucide-react";

import useLegalDocument from "../../hooks/legal/useLegalDocument";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";

import LegalSectionIcon from "../legal/LegalSectionIcon";

import { LEGAL_DOCUMENT_TYPES } from "../../constants/legalDocuments";
import { formatLegalDate } from "../../utils/legalDocumentFormat";
import { resolveLegalSections } from "../../utils/termsLiveBlocks";

/**
 * TermsAgreement.jsx
 *
 * Terms & Conditions for Rent-A-Ride Albay, shown standalone or inside the
 * booking flow. The wording is the published version from Settings → Terms
 * & Policies; its live blocks (cancellation tiers, pickup time, late fees…)
 * are written from the same live settings and sentences as the booking
 * form's Important Reminders card (utils/termsLiveBlocks), so the two
 * always agree.
 *
 * `onVersionChange(id)` reports the version shown, which the host sends
 * with the acceptance so the server records exactly that one. To show the
 * terms a booking accepted, pass that version as `document`, its stored
 * settings as `policyValues`, and `readOnly`.
 *
 * Example:
 *   <TermsAgreement
 *       onAccept={() => submitBooking()}
 *       accepted={false}
 *   />
 */

function TermsSection({ section }) {
    const [open, setOpen] = useState(true);
    return (
        <section
            id={section.key}
            className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        >
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                aria-expanded={open}
                aria-controls={`${section.key}-content`}
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
                        <LegalSectionIcon name={section.icon} size={19} strokeWidth={2} />
                    </span>

                    <span className="font-semibold text-gray-900 dark:text-white">
                        {section.title}
                    </span>
                </span>

                <ChevronDown
                    size={20}
                    className={`shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>

            {open && (
                <div
                    id={`${section.key}-content`}
                    className="border-t border-gray-200 dark:border-gray-800 px-5 pb-5 pt-4"
                >
                    <ul className="space-y-3">
                        {section.lines.map((line, index) => (
                            <li
                                key={index}
                                className="flex gap-3 text-sm leading-6 text-gray-500 dark:text-gray-400"
                            >
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                                <span className="whitespace-pre-line">{line}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

export default function TermsAgreement({
    onAccept,
    onChange,
    accepted: controlledAccepted,
    showAcceptButton = true,
    // Off where the host already has its own sticky footer (the booking
    // form's step navigation), so the two don't stack on top of each other.
    stickyAcceptance = true,
    error = "",
    onVersionChange,
    // Bump to fetch the newest version (after the server refused an old one).
    reloadKey = 0,
    // A specific version and settings to show instead of the current ones.
    document: presetDocument = null,
    policyValues = null,
    readOnly = false,
}) {
    const [internalAccepted, setInternalAccepted] = useState(false);

    const current = useLegalDocument(LEGAL_DOCUMENT_TYPES.BOOKING_TERMS, {
        enabled: !presetDocument,
    });

    const { reload } = current;
    const firstReloadKey = useRef(reloadKey);

    useEffect(() => {
        if (reloadKey !== firstReloadKey.current) {
            reload();
        }
    }, [reloadKey, reload]);

    const document = presetDocument ?? current.document;

    /*
     * The same live settings the Important Reminders card reads. Until they
     * load (or if they can't), the policy-driven lines stay number-free
     * rather than quote numbers that might not match.
     */
    const liveValues = usePublicRefundSettings();
    const values = policyValues ?? liveValues;

    const sections = useMemo(
        () => resolveLegalSections(document, values),
        [document, values]
    );

    const documentId = document?._id ?? null;

    useEffect(() => {
        if (documentId) {
            onVersionChange?.(documentId);
        }
        // Report each version once, not on every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentId]);

    const isControlled = typeof controlledAccepted === "boolean";
    const accepted = isControlled ? controlledAccepted : internalAccepted;

    const handleAccept = () => {
        if (!isControlled) {
            setInternalAccepted(true);
        }

        if (typeof onAccept === "function") {
            onAccept();
        }
    };

    /*
     * The acceptance checkbox sits below a long wall of sections, so on
     * first arriving at this step there's nothing on screen hinting that
     * scrolling down is required. Show a floating nudge until the
     * acceptance box has actually scrolled into view (or is accepted).
     */
    const acceptanceRef = useRef(null);
    const [acceptanceVisible, setAcceptanceVisible] = useState(false);

    useEffect(() => {
        const target = acceptanceRef.current;

        if (!target || typeof IntersectionObserver === "undefined") {
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => setAcceptanceVisible(entry.isIntersecting),
            { threshold: 0.15 }
        );

        observer.observe(target);

        return () => observer.disconnect();
    }, [document]);

    const showScrollHint =
        !readOnly && Boolean(document) && !accepted && !acceptanceVisible;

    const scrollToAcceptance = () => {
        acceptanceRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    if (!document) {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
                    {current.error ? (
                        <>
                            <AlertCircle
                                size={24}
                                className="text-red-500 dark:text-red-400"
                            />
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {current.error}
                            </p>
                            <button
                                type="button"
                                onClick={reload}
                                className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-yellow-300"
                            >
                                <RefreshCw size={15} />
                                Try again
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-yellow-500 dark:border-gray-700 dark:border-t-yellow-400" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Loading the Terms &amp; Conditions…
                            </p>
                        </>
                    )}
                </div>

                {error && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8 overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                <div className="bg-gray-900 px-6 py-8 text-white dark:bg-gray-800 sm:px-8">
                    <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-gray-950">
                            <FileCheck2 size={23} />
                        </div>
                        <span className="text-sm font-medium uppercase tracking-wider opacity-90">
                            Rent-A-Ride Albay
                        </span>
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        {document.title}
                    </h1>

                    {document.intro && (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85 sm:text-base">
                            {document.intro}
                        </p>
                    )}

                    <p className="mt-4 text-xs font-medium text-white/60">
                        Version {document.version}
                        {document.publishedAt &&
                            ` · Effective ${formatLegalDate(document.publishedAt)}`}
                    </p>
                </div>

                {document.highlights?.length > 0 && (
                    <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
                        {document.highlights.map((highlight, index) => (
                            <div key={index}>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {highlight.label}
                                </p>
                                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                    {highlight.value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {document.notice?.body && (
                <div className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                    <div className="flex gap-3">
                        <AlertCircle
                            size={20}
                            className="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-400"
                        />

                        <div>
                            {document.notice.title && (
                                <h2 className="font-semibold text-gray-900 dark:text-white">
                                    {document.notice.title}
                                </h2>
                            )}
                            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-500 dark:text-gray-400">
                                {document.notice.body}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {sections.map((section) => (
                    <TermsSection key={section.key} section={section} />
                ))}
            </div>

            {!readOnly && (
                <div
                    ref={acceptanceRef}
                    className={
                        stickyAcceptance
                            ? "sticky bottom-0 mt-8 border-t border-gray-200 bg-white/95 py-5 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
                            : "mt-8"
                    }
                >
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={accepted}
                                onChange={(event) => {
                                    setInternalAccepted(event.target.checked);
                                    onChange?.(event.target.checked);
                                }}
                                className="mt-1 h-4 w-4 shrink-0 accent-yellow-500"
                            />

                            <span className="text-sm leading-6 text-gray-900 dark:text-white">
                                {document.acceptanceLabel}
                            </span>
                        </label>

                        {error && (
                            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        )}

                        {showAcceptButton && (
                            <button
                                type="button"
                                disabled={!accepted}
                                onClick={handleAccept}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-semibold text-gray-950 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <CheckCircle2 size={19} />
                                I Agree & Continue
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showScrollHint && (
                <button
                    type="button"
                    onClick={scrollToAcceptance}
                    className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/25 transition-opacity hover:bg-gray-800 dark:bg-yellow-400 dark:text-gray-950 dark:hover:bg-yellow-300"
                >
                    Scroll down to review &amp; accept
                    <ChevronDown
                        size={16}
                        className="animate-bounce motion-reduce:animate-none"
                    />
                </button>
            )}
        </div>
    );
}
