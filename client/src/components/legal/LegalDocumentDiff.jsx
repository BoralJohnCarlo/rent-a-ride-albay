import { useMemo } from "react";

import { diffLegalDocuments } from "../../utils/legalDocumentDiff";

/*
 * The changes between two versions of a legal document: changed fields,
 * then each added, removed or edited section with only its changed points.
 * Added text is green, removed is red and struck through.
 */

const Words = ({ parts }) => (
    <>
        {parts.map((part, index) =>
            part.type === "added" ? (
                <ins
                    key={index}
                    className="rounded bg-emerald-100 px-0.5 text-emerald-800 no-underline dark:bg-emerald-500/20 dark:text-emerald-300"
                >
                    {part.text}
                </ins>
            ) : part.type === "removed" ? (
                <del
                    key={index}
                    className="rounded bg-red-100 px-0.5 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                >
                    {part.text}
                </del>
            ) : (
                <span key={index}>{part.text}</span>
            )
        )}
    </>
);

const STATUS_BADGE = {
    added: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    removed: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    changed: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
};

const ITEM_STYLE = {
    added: "border-emerald-300 bg-emerald-50/60 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
    removed: "border-red-300 bg-red-50/60 text-red-900 line-through dark:border-red-700 dark:bg-red-500/10 dark:text-red-200",
    edited: "border-amber-300 bg-white text-gray-700 dark:border-amber-700 dark:bg-gray-900 dark:text-gray-200",
};

const ITEM_LABEL = { added: "Added", removed: "Removed", edited: "Edited" };

const LegalDocumentDiff = ({ before, after }) => {
    const diff = useMemo(
        () => diffLegalDocuments(before, after),
        [before, after]
    );

    const changedSections = diff.sections.filter(
        (section) => section.status !== "same"
    );
    const unchangedCount = diff.sections.length - changedSections.length;

    if (diff.changeCount === 0) {
        return (
            <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                No changes — the wording is the same.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
                {diff.changeCount} change{diff.changeCount === 1 ? "" : "s"}
                {unchangedCount > 0 &&
                    ` · ${unchangedCount} section${
                        unchangedCount === 1 ? "" : "s"
                    } unchanged`}
            </p>

            {diff.fields.length > 0 && (
                <div className="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    {diff.fields.map((field) => (
                        <div key={field.label}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {field.label}
                            </p>
                            <p className="mt-0.5 whitespace-pre-line text-sm leading-6 text-gray-700 dark:text-gray-200">
                                <Words parts={field.words} />
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {changedSections.map((section, index) => (
                <section
                    key={`${section.key}-${section.status}-${index}`}
                    className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[section.status]}`}
                        >
                            {section.status}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {section.titleWords ? (
                                <Words parts={section.titleWords} />
                            ) : (
                                section.title || "Untitled section"
                            )}
                        </h4>
                    </div>

                    {section.notes.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {section.notes.join(" · ")}
                        </p>
                    )}

                    <ul className="mt-3 space-y-2">
                        {section.items
                            .filter((item) => item.type !== "same")
                            .map((item, itemIndex) => (
                                <li
                                    key={itemIndex}
                                    className={`rounded-lg border-l-4 px-3 py-2 text-sm leading-6 ${ITEM_STYLE[item.type]}`}
                                >
                                    <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide no-underline opacity-70">
                                        {ITEM_LABEL[item.type]}
                                    </span>
                                    {item.words ? (
                                        <Words parts={item.words} />
                                    ) : (
                                        item.text
                                    )}
                                </li>
                            ))}
                    </ul>
                </section>
            ))}
        </div>
    );
};

export default LegalDocumentDiff;
