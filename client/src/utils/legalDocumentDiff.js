import { LIVE_BLOCKS } from "./termsLiveBlocks";

/*
 * What changed between two versions of a legal document, for the publish
 * dialog and the version history. Sections are matched by their key (the
 * anchor kept across versions); points within a section by a longest-common-
 * subsequence diff, with a removed + added pair shown as one edited point
 * (word-level highlights).
 */

/* Longest common subsequence of a and b, by `equals`, as an edit script. */
const diffSequences = (before, after, equals = (a, b) => a === b) => {
    const rows = before.length;
    const cols = after.length;
    const table = Array.from({ length: rows + 1 }, () =>
        new Array(cols + 1).fill(0)
    );

    for (let i = rows - 1; i >= 0; i -= 1) {
        for (let j = cols - 1; j >= 0; j -= 1) {
            table[i][j] = equals(before[i], after[j])
                ? table[i + 1][j + 1] + 1
                : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }

    const script = [];
    let i = 0;
    let j = 0;

    while (i < rows && j < cols) {
        if (equals(before[i], after[j])) {
            script.push({ type: "same", before: before[i], after: after[j] });
            i += 1;
            j += 1;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
            script.push({ type: "removed", before: before[i] });
            i += 1;
        } else {
            script.push({ type: "added", after: after[j] });
            j += 1;
        }
    }

    while (i < rows) {
        script.push({ type: "removed", before: before[i] });
        i += 1;
    }

    while (j < cols) {
        script.push({ type: "added", after: after[j] });
        j += 1;
    }

    return script;
};

/* Word-level changes in a piece of text: [{ type, text }]. */
export const diffWords = (before = "", after = "") => {
    const tokens = (text) => String(text).split(/(\s+)/).filter(Boolean);

    const parts = [];

    for (const step of diffSequences(tokens(before), tokens(after))) {
        const type = step.type;
        const text = type === "added" ? step.after : step.before;
        const last = parts[parts.length - 1];

        if (last && last.type === type) {
            last.text += text;
        } else {
            parts.push({ type, text });
        }
    }

    return parts;
};

const itemLabel = (item) =>
    item?.kind === "live"
        ? `[Live block: ${LIVE_BLOCKS[item.liveKey]?.label ?? item.liveKey}]`
        : item?.text ?? "";

const sameItem = (a, b) =>
    a.kind === b.kind &&
    (a.kind === "live" ? a.liveKey === b.liveKey : a.text === b.text);

/*
 * Points of a section: unchanged ones as "same", and each run of removed
 * then added text points paired up as "edited".
 */
const diffItems = (before = [], after = []) => {
    const script = diffSequences(before, after, sameItem);
    const result = [];

    for (let index = 0; index < script.length; index += 1) {
        const step = script[index];

        if (step.type === "same") {
            result.push({ type: "same", text: itemLabel(step.after) });
            continue;
        }

        // Gather a run of removals followed by additions.
        const removed = [];
        const added = [];

        while (script[index]?.type === "removed") {
            removed.push(script[index].before);
            index += 1;
        }

        while (script[index]?.type === "added") {
            added.push(script[index].after);
            index += 1;
        }

        index -= 1;

        const pairs = Math.max(removed.length, added.length);

        for (let pair = 0; pair < pairs; pair += 1) {
            const oldItem = removed[pair];
            const newItem = added[pair];

            if (
                oldItem &&
                newItem &&
                oldItem.kind === "text" &&
                newItem.kind === "text"
            ) {
                result.push({
                    type: "edited",
                    words: diffWords(oldItem.text, newItem.text),
                });
            } else {
                if (oldItem) {
                    result.push({ type: "removed", text: itemLabel(oldItem) });
                }

                if (newItem) {
                    result.push({ type: "added", text: itemLabel(newItem) });
                }
            }
        }
    }

    return result;
};

const FIELDS = [
    { label: "Title", read: (doc) => doc?.title ?? "" },
    { label: "Introduction", read: (doc) => doc?.intro ?? "" },
    { label: "Notice title", read: (doc) => doc?.notice?.title ?? "" },
    { label: "Notice", read: (doc) => doc?.notice?.body ?? "" },
    {
        label: "Highlights",
        read: (doc) =>
            (doc?.highlights ?? [])
                .map((h) => `${h.label}: ${h.value}`)
                .join(" · "),
    },
    {
        label: "Acceptance statement",
        read: (doc) => doc?.acceptanceLabel ?? "",
    },
];

/*
 * {
 *   fields:   [{ label, words }]                       — changed ones only
 *   sections: [{ key, status, title, titleWords?, notes, items }]
 *             status: added | removed | changed | same
 *   changeCount
 * }
 */
export const diffLegalDocuments = (before, after) => {
    const fields = FIELDS.map((field) => ({
        label: field.label,
        before: field.read(before),
        after: field.read(after),
    }))
        .filter((field) => field.before !== field.after)
        .map((field) => ({
            label: field.label,
            words: diffWords(field.before, field.after),
        }));

    const beforeSections = before?.sections ?? [];
    const afterSections = after?.sections ?? [];

    const beforeByKey = new Map(
        beforeSections.filter((s) => s.key).map((s) => [s.key, s])
    );
    const afterKeys = new Set(afterSections.map((s) => s.key).filter(Boolean));

    const sections = afterSections.map((section) => {
        const previous = section.key ? beforeByKey.get(section.key) : null;

        if (!previous) {
            return {
                key: section.key,
                status: "added",
                title: section.title,
                notes: [],
                items: (section.items ?? []).map((item) => ({
                    type: "added",
                    text: itemLabel(item),
                })),
            };
        }

        const items = diffItems(previous.items, section.items);
        const notes = [];

        if ((previous.icon ?? "") !== (section.icon ?? "")) {
            notes.push("Icon changed");
        }

        if ((previous.condition ?? "") !== (section.condition ?? "")) {
            notes.push(
                section.condition
                    ? "Now only shown while Early Return Credit is on"
                    : "Now always shown"
            );
        }

        const titleChanged = previous.title !== section.title;
        const itemsChanged = items.some((item) => item.type !== "same");

        return {
            key: section.key,
            status:
                titleChanged || itemsChanged || notes.length
                    ? "changed"
                    : "same",
            title: section.title,
            titleWords: titleChanged
                ? diffWords(previous.title, section.title)
                : null,
            notes,
            items,
        };
    });

    for (const section of beforeSections) {
        if (!section.key || !afterKeys.has(section.key)) {
            sections.push({
                key: section.key,
                status: "removed",
                title: section.title,
                notes: [],
                items: (section.items ?? []).map((item) => ({
                    type: "removed",
                    text: itemLabel(item),
                })),
            });
        }
    }

    const changeCount =
        fields.length +
        sections.filter((section) => section.status !== "same").length;

    return { fields, sections, changeCount };
};
