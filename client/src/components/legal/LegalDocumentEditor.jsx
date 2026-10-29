import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Copy,
    Eye,
    GitCompare,
    History,
    Lock,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Send,
    Trash2,
    X,
} from "lucide-react";

import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";
import Input from "../common/Input";
import Modal from "../common/Modal";
import PillTabs from "../common/PillTabs";
import Select from "../common/Select";
import Switch from "../common/Switch";
import Textarea from "../common/Textarea";
import LegalDocumentDiff from "./LegalDocumentDiff";
import LegalDocumentPreview from "./LegalDocumentPreview";

import {
    discardLegalDocumentDraft,
    getLegalDocumentAdminView,
    getLegalDocumentVersion,
    publishLegalDocument,
    saveLegalDocumentDraft,
} from "../../api/legalDocumentApi";

import { useLegalDocumentVersion } from "../../hooks/legal/useLegalDocument";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";
import useToast from "../../hooks/toast/useToast";

import {
    LEGAL_DOCUMENT_CONFIG,
    LEGAL_SECTION_CONDITIONS,
    LEGAL_SECTION_ICONS,
} from "../../constants/legalDocuments";
import {
    formatLegalDate,
    formatLegalDateTime,
} from "../../utils/legalDocumentFormat";
import {
    LIVE_BLOCKS,
    LIVE_BLOCK_OPTIONS,
    renderLiveBlock,
} from "../../utils/termsLiveBlocks";

/*
 * Settings → Terms & Policies editor for one document. Admins edit a draft
 * (saved server-side, so it survives a reload and other admins see it) and
 * publish it as the next version. Published versions are never changed:
 * bookings, registrations and consignments keep pointing at the one their
 * person accepted.
 */

// Grace the server gives a version that was just replaced (minutes);
// mirrors LEGAL_ACCEPTANCE_GRACE_MINUTES, for the publish dialog's wording.
const ACCEPTANCE_GRACE_MINUTES = 60;

const MAX_HIGHLIGHTS = 6;

const errorMessage = (error, fallback) =>
    error?.response?.data?.errors?.[0]?.msg ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

const personName = (person) =>
    [person?.firstName, person?.lastName].filter(Boolean).join(" ");

/* Client-only ids so list rows keep their identity while reordering. */
let lastClientId = 0;
const clientId = () => `c${(lastClientId += 1)}`;

const toForm = (document) => ({
    title: document?.title ?? "",
    intro: document?.intro ?? "",
    highlights: (document?.highlights ?? []).map((highlight) => ({
        cid: clientId(),
        label: highlight.label ?? "",
        value: highlight.value ?? "",
    })),
    notice: {
        title: document?.notice?.title ?? "",
        body: document?.notice?.body ?? "",
    },
    acceptanceLabel: document?.acceptanceLabel ?? "",
    sections: (document?.sections ?? []).map((section) => ({
        cid: clientId(),
        key: section.key ?? "",
        title: section.title ?? "",
        icon: section.icon ?? "",
        condition: section.condition ?? "",
        items: (section.items ?? []).map((item) => ({
            cid: clientId(),
            kind: item.kind === "live" ? "live" : "text",
            text: item.text ?? "",
            liveKey: item.liveKey ?? "",
        })),
    })),
});

/* What the server stores (the editable fields only). */
const toContent = (form) => ({
    title: form.title,
    intro: form.intro,
    highlights: form.highlights.map(({ label, value }) => ({ label, value })),
    notice: { title: form.notice.title, body: form.notice.body },
    acceptanceLabel: form.acceptanceLabel,
    sections: form.sections.map(({ key, title, icon, condition, items }) => ({
        key,
        title,
        icon,
        condition,
        items: items.map(({ kind, text, liveKey }) => ({ kind, text, liveKey })),
    })),
});

const fingerprint = (form) => (form ? JSON.stringify(toContent(form)) : "");

const moveItem = (list, index, delta) => {
    const target = index + delta;

    if (target < 0 || target >= list.length) {
        return list;
    }

    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];

    return next;
};

const ICON_OPTIONS = [
    { value: "", label: "Default" },
    ...Object.entries(LEGAL_SECTION_ICONS).map(([value, { label }]) => ({
        value,
        label,
    })),
];

/* -------------------------------------------------------------------------- */

const IconButton = ({ label, onClick, disabled = false, danger = false, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={`rounded-lg p-1.5 text-gray-500 transition disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 ${
            danger
                ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                : "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
        }`}
    >
        {children}
    </button>
);

const Card = ({ title, description, actions, children }) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        {(title || actions) && (
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {title}
                    </h3>
                    {description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {description}
                        </p>
                    )}
                </div>
                {actions}
            </div>
        )}
        {children}
    </div>
);

/* One bullet: free text, or a locked live block showing today's wording. */
const ItemRow = ({ item, index, count, liveValues, onChange, onMove, onRemove }) => {
    const controls = (
        <div className="flex shrink-0 flex-col gap-0.5">
            <IconButton label="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
                <ArrowUp size={14} />
            </IconButton>
            <IconButton
                label="Move down"
                onClick={() => onMove(1)}
                disabled={index === count - 1}
            >
                <ArrowDown size={14} />
            </IconButton>
            <IconButton label="Remove point" onClick={onRemove} danger>
                <X size={14} />
            </IconButton>
        </div>
    );

    if (item.kind === "live") {
        const block = LIVE_BLOCKS[item.liveKey];
        const lines = renderLiveBlock(item.liveKey, liveValues);

        return (
            <div className="flex gap-2">
                <div className="min-w-0 flex-1 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-3 dark:border-blue-800 dark:bg-blue-950/20">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        <Lock size={12} />
                        Live block: {block?.label ?? item.liveKey}
                        <span className="font-normal text-blue-600/80 dark:text-blue-400/80">
                            · from {block?.source ?? "settings"}
                        </span>
                    </p>
                    <ul className="mt-2 space-y-1.5">
                        {lines.map((line, lineIndex) => (
                            <li
                                key={lineIndex}
                                className="text-xs leading-5 text-gray-600 dark:text-gray-300"
                            >
                                {line}
                            </li>
                        ))}
                    </ul>
                </div>
                {controls}
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            <div className="min-w-0 flex-1">
                <Textarea
                    id={`legal-item-${item.cid}`}
                    name={`item-${item.cid}`}
                    rows={2}
                    value={item.text}
                    onChange={(event) => onChange({ text: event.target.value })}
                    placeholder="Write this point…"
                />
            </div>
            {controls}
        </div>
    );
};

const SectionEditor = ({
    section,
    index,
    count,
    config,
    liveValues,
    onChange,
    onMove,
    onRemove,
}) => {
    const [open, setOpen] = useState(true);

    const updateItems = (updater) =>
        onChange({ items: updater(section.items) });

    const addLiveBlock = (liveKey) => {
        if (!liveKey) {
            return;
        }

        updateItems((items) => [
            ...items,
            { cid: clientId(), kind: "live", text: "", liveKey },
        ]);
    };

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                    <Input
                        id={`legal-section-${section.cid}`}
                        name={`section-${section.cid}`}
                        value={section.title}
                        onChange={(event) => onChange({ title: event.target.value })}
                        placeholder="Section title"
                    />
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton label="Move section up" onClick={() => onMove(-1)} disabled={index === 0}>
                        <ArrowUp size={15} />
                    </IconButton>
                    <IconButton
                        label="Move section down"
                        onClick={() => onMove(1)}
                        disabled={index === count - 1}
                    >
                        <ArrowDown size={15} />
                    </IconButton>
                    <IconButton label="Remove section" onClick={onRemove} danger>
                        <Trash2 size={15} />
                    </IconButton>
                    <IconButton
                        label={open ? "Collapse section" : "Expand section"}
                        onClick={() => setOpen((value) => !value)}
                    >
                        <ChevronDown
                            size={15}
                            className={`transition-transform ${open ? "rotate-180" : ""}`}
                        />
                    </IconButton>
                </div>
            </div>

            {open && (
                <div className="space-y-4 p-3 sm:p-4">
                    {(config.icons || config.conditions) && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {config.icons && (
                                <Select
                                    id={`legal-icon-${section.cid}`}
                                    name={`icon-${section.cid}`}
                                    label="Icon"
                                    value={section.icon}
                                    options={ICON_OPTIONS}
                                    onChange={(event) =>
                                        onChange({ icon: event.target.value })
                                    }
                                />
                            )}

                            {config.conditions && (
                                <div className="sm:pt-7">
                                    <Switch
                                        id={`legal-condition-${section.cid}`}
                                        checked={section.condition === "earlyReturnEnabled"}
                                        onChange={(event) =>
                                            onChange({
                                                condition: event.target.checked
                                                    ? "earlyReturnEnabled"
                                                    : "",
                                            })
                                        }
                                        label={LEGAL_SECTION_CONDITIONS.earlyReturnEnabled}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-3">
                        {section.items.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No points yet.
                            </p>
                        )}

                        {section.items.map((item, itemIndex) => (
                            <ItemRow
                                key={item.cid}
                                item={item}
                                index={itemIndex}
                                count={section.items.length}
                                liveValues={liveValues}
                                onChange={(patch) =>
                                    updateItems((items) =>
                                        items.map((entry) =>
                                            entry.cid === item.cid
                                                ? { ...entry, ...patch }
                                                : entry
                                        )
                                    )
                                }
                                onMove={(delta) =>
                                    updateItems((items) =>
                                        moveItem(items, itemIndex, delta)
                                    )
                                }
                                onRemove={() =>
                                    updateItems((items) =>
                                        items.filter((entry) => entry.cid !== item.cid)
                                    )
                                }
                            />
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            leftIcon={<Plus size={14} />}
                            onClick={() =>
                                updateItems((items) => [
                                    ...items,
                                    { cid: clientId(), kind: "text", text: "", liveKey: "" },
                                ])
                            }
                        >
                            Add point
                        </Button>

                        {config.liveBlocks && (
                            <div className="w-56">
                                <Select
                                    id={`legal-live-${section.cid}`}
                                    name={`live-${section.cid}`}
                                    value=""
                                    placeholder="Insert live block…"
                                    options={LIVE_BLOCK_OPTIONS}
                                    onChange={(event) => addLiveBlock(event.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* A published version, read-only, from the history list. */
const VersionModal = ({ type, entry, onClose, onCopy }) => {
    const { document, loading, error } = useLegalDocumentVersion(entry?._id);

    return (
        <Modal
            isOpen={Boolean(entry)}
            onClose={onClose}
            size="xl"
            title={`Version ${entry?.version ?? ""}`}
            description={
                entry?.publishedAt
                    ? `Published ${formatLegalDateTime(entry.publishedAt)}`
                    : undefined
            }
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        variant="outline"
                        leftIcon={<Copy size={15} />}
                        onClick={() => onCopy(entry)}
                    >
                        Copy into editor
                    </Button>
                </>
            }
        >
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
                </div>
            ) : error || !document ? (
                <p className="py-8 text-sm text-red-600 dark:text-red-400">
                    {error || "This version couldn't be loaded."}
                </p>
            ) : (
                <>
                    {LEGAL_DOCUMENT_CONFIG[type].liveBlocks && (
                        <p className="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                            Live blocks show today&apos;s settings here. Each
                            booking&apos;s own copy uses the settings from when
                            it was made.
                        </p>
                    )}
                    <LegalDocumentPreview type={type} document={document} />
                </>
            )}
        </Modal>
    );
};

/* Two published versions side by side, as changes (history). */
const CompareModal = ({ comparing, onClose }) => {
    const older = useLegalDocumentVersion(comparing?.older?._id);
    const newer = useLegalDocumentVersion(comparing?.newer?._id);

    const loading = older.loading || newer.loading;
    const error = older.error || newer.error;

    return (
        <Modal
            isOpen={Boolean(comparing)}
            onClose={onClose}
            size="xl"
            title={`Version ${comparing?.older?.version ?? ""} → ${
                comparing?.newer?.version ?? ""
            }`}
            description={
                comparing?.newer?.changeNote
                    ? `What changed: ${comparing.newer.changeNote}`
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
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
                </div>
            ) : error || !older.document || !newer.document ? (
                <p className="py-8 text-sm text-red-600 dark:text-red-400">
                    {error || "These versions couldn't be loaded."}
                </p>
            ) : (
                <LegalDocumentDiff
                    before={older.document}
                    after={newer.document}
                />
            )}
        </Modal>
    );
};

/* -------------------------------------------------------------------------- */

const LegalDocumentEditor = ({ type, onDirtyChange }) => {
    const toast = useToast();
    const config = LEGAL_DOCUMENT_CONFIG[type];
    const liveValues = usePublicRefundSettings();

    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [form, setForm] = useState(null);
    const [baseline, setBaseline] = useState("");
    const [mode, setMode] = useState("edit");

    const [saving, setSaving] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [changeNote, setChangeNote] = useState("");
    const [publishing, setPublishing] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [discarding, setDiscarding] = useState(false);
    const [viewingVersion, setViewingVersion] = useState(null);
    // { older, newer } history entries being compared.
    const [comparing, setComparing] = useState(null);

    const applyForm = (nextForm) => {
        setForm(nextForm);
        setBaseline(fingerprint(nextForm));
    };

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError("");

        try {
            const response = await getLegalDocumentAdminView(type);
            const data = response?.data;

            setView(data);

            const startingPoint = toForm(data?.draft ?? data?.current);
            setForm(startingPoint);
            setBaseline(fingerprint(startingPoint));
        } catch (error) {
            setLoadError(errorMessage(error, "Unable to load this document."));
        } finally {
            setLoading(false);
        }
    }, [type]);

    useEffect(() => {
        void load();
    }, [load]);

    const dirty = Boolean(form) && fingerprint(form) !== baseline;

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    // Warn before leaving the page with unsaved edits.
    useEffect(() => {
        if (!dirty) {
            return undefined;
        }

        const warn = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", warn);

        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const current = view?.current;
    const latest = view?.history?.[0];
    const nextVersion = (current?.version ?? 0) + 1;

    const previewDocument = useMemo(
        () =>
            form
                ? {
                      ...toContent(form),
                      sections: toContent(form).sections.map((section, index) => ({
                          ...section,
                          key: section.key || `preview-section-${index + 1}`,
                      })),
                      version: `${nextVersion} (preview)`,
                      publishedAt: null,
                  }
                : null,
        [form, nextVersion]
    );

    // What would be published, for the dialog's comparison (only while open).
    const publishContent = useMemo(
        () => (publishOpen && form ? toContent(form) : null),
        [publishOpen, form]
    );

    const setField = (field, value) =>
        setForm((previous) => ({ ...previous, [field]: value }));

    const updateSections = (updater) =>
        setForm((previous) => ({
            ...previous,
            sections: updater(previous.sections),
        }));

    const handleSaveDraft = async () => {
        setSaving(true);

        try {
            const response = await saveLegalDocumentDraft(
                type,
                toContent(form),
                view?.draft?.updatedAt
            );
            const draft = response?.data;

            setView((previous) => ({ ...previous, draft }));
            applyForm(toForm(draft));
            toast.success("Draft saved. Customers still see the published version.");
        } catch (error) {
            toast.error(errorMessage(error, "Unable to save the draft."));
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        setDiscarding(true);

        try {
            if (view?.draft) {
                await discardLegalDocumentDraft(type, view.draft.updatedAt);
            }

            setView((previous) => ({ ...previous, draft: null }));
            applyForm(toForm(current));
            setDiscardOpen(false);
            toast.success("Changes discarded.");
        } catch (error) {
            toast.error(errorMessage(error, "Unable to discard the draft."));
        } finally {
            setDiscarding(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);

        try {
            const response = await publishLegalDocument(
                type,
                toContent(form),
                changeNote.trim(),
                view?.draft?.updatedAt,
                current?.version
            );

            toast.success(
                `Version ${response?.data?.version ?? nextVersion} is now live.`
            );
            setPublishOpen(false);
            setChangeNote("");
            setMode("edit");
            await load();
        } catch (error) {
            toast.error(errorMessage(error, "Unable to publish."));
        } finally {
            setPublishing(false);
        }
    };

    const handleCopyVersion = async (entry) => {
        try {
            const response = await getLegalDocumentVersion(entry._id);

            // Not saved yet: the editor shows it as unsaved changes.
            setForm(toForm(response?.data));
            setViewingVersion(null);
            setMode("edit");
            toast.success(
                `Version ${entry.version} copied into the editor. Save a draft or publish to use it.`
            );
        } catch (error) {
            toast.error(errorMessage(error, "Unable to load that version."));
        }
    };

    if (loading && !form) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            </div>
        );
    }

    if (loadError && !form) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
                <Button className="mt-4" variant="outline" onClick={load}>
                    Try again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Status and actions */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1.5">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {config.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                Live: Version {current?.version}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                                Published {formatLegalDate(current?.publishedAt)}
                                {personName(latest?.publishedBy) &&
                                    ` by ${personName(latest.publishedBy)}`}
                            </span>

                            {view?.draft && (
                                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                    Draft saved {formatLegalDateTime(view.draft.updatedAt)}
                                    {personName(view.draft.updatedBy) &&
                                        ` by ${personName(view.draft.updatedBy)}`}
                                </span>
                            )}

                            {dirty && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                                    Unsaved changes
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <PillTabs
                            size="sm"
                            layoutId={`legal-mode-${type}`}
                            value={mode}
                            onChange={setMode}
                            label="Editor mode"
                            options={[
                                { value: "edit", label: "Edit", icon: Pencil },
                                { value: "preview", label: "Preview", icon: Eye },
                            ]}
                        />

                        {(view?.draft || dirty) && (
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<RotateCcw size={14} />}
                                onClick={() => setDiscardOpen(true)}
                            >
                                Discard
                            </Button>
                        )}

                        <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Save size={14} />}
                            onClick={handleSaveDraft}
                            loading={saving}
                            disabled={!dirty}
                        >
                            Save draft
                        </Button>

                        <Button
                            size="sm"
                            leftIcon={<Send size={14} />}
                            onClick={() => setPublishOpen(true)}
                            disabled={!dirty && !view?.draft}
                        >
                            Publish…
                        </Button>
                    </div>
                </div>
            </div>

            {mode === "preview" ? (
                <Card
                    title="Preview"
                    description={
                        config.liveBlocks
                            ? "How customers will see this version. Live blocks use today's settings."
                            : "How this version will look once published."
                    }
                >
                    <LegalDocumentPreview type={type} document={previewDocument} />
                </Card>
            ) : (
                <>
                    <Card title="Document details">
                        <div className="space-y-5">
                            <Input
                                id={`legal-title-${type}`}
                                name="title"
                                label="Title"
                                value={form.title}
                                onChange={(event) => setField("title", event.target.value)}
                            />

                            {config.intro && (
                                <Textarea
                                    id={`legal-intro-${type}`}
                                    name="intro"
                                    label="Introduction"
                                    rows={3}
                                    value={form.intro}
                                    onChange={(event) => setField("intro", event.target.value)}
                                    helperText="Shown under the title."
                                />
                            )}

                            <div className="grid gap-4 sm:grid-cols-3">
                                {config.noticeTitle && (
                                    <Input
                                        id={`legal-notice-title-${type}`}
                                        name="noticeTitle"
                                        label="Notice title"
                                        value={form.notice.title}
                                        onChange={(event) =>
                                            setField("notice", {
                                                ...form.notice,
                                                title: event.target.value,
                                            })
                                        }
                                    />
                                )}

                                <div className={config.noticeTitle ? "sm:col-span-2" : "sm:col-span-3"}>
                                    <Textarea
                                        id={`legal-notice-body-${type}`}
                                        name="noticeBody"
                                        label="Notice"
                                        rows={3}
                                        value={form.notice.body}
                                        onChange={(event) =>
                                            setField("notice", {
                                                ...form.notice,
                                                body: event.target.value,
                                            })
                                        }
                                        helperText="A highlighted callout above the sections. Leave empty to hide it."
                                    />
                                </div>
                            </div>

                            {config.highlights && (
                                <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Highlights
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Short facts under the heading (e.g. Payment — GCash / QRPh).
                                    </p>

                                    <div className="mt-3 space-y-2">
                                        {form.highlights.map((highlight) => (
                                            <div key={highlight.cid} className="flex items-center gap-2">
                                                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                                                    <Input
                                                        id={`legal-hl-label-${highlight.cid}`}
                                                        name={`hl-label-${highlight.cid}`}
                                                        value={highlight.label}
                                                        placeholder="Label"
                                                        onChange={(event) =>
                                                            setField(
                                                                "highlights",
                                                                form.highlights.map((entry) =>
                                                                    entry.cid === highlight.cid
                                                                        ? { ...entry, label: event.target.value }
                                                                        : entry
                                                                )
                                                            )
                                                        }
                                                    />
                                                    <Input
                                                        id={`legal-hl-value-${highlight.cid}`}
                                                        name={`hl-value-${highlight.cid}`}
                                                        value={highlight.value}
                                                        placeholder="Value"
                                                        onChange={(event) =>
                                                            setField(
                                                                "highlights",
                                                                form.highlights.map((entry) =>
                                                                    entry.cid === highlight.cid
                                                                        ? { ...entry, value: event.target.value }
                                                                        : entry
                                                                )
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <IconButton
                                                    label="Remove highlight"
                                                    danger
                                                    onClick={() =>
                                                        setField(
                                                            "highlights",
                                                            form.highlights.filter(
                                                                (entry) => entry.cid !== highlight.cid
                                                            )
                                                        )
                                                    }
                                                >
                                                    <X size={15} />
                                                </IconButton>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        className="mt-3"
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        leftIcon={<Plus size={14} />}
                                        disabled={form.highlights.length >= MAX_HIGHLIGHTS}
                                        onClick={() =>
                                            setField("highlights", [
                                                ...form.highlights,
                                                { cid: clientId(), label: "", value: "" },
                                            ])
                                        }
                                    >
                                        Add highlight
                                    </Button>
                                </div>
                            )}

                            {config.acceptance && (
                                <Textarea
                                    id={`legal-acceptance-${type}`}
                                    name="acceptanceLabel"
                                    label="Acceptance statement"
                                    rows={3}
                                    value={form.acceptanceLabel}
                                    onChange={(event) =>
                                        setField("acceptanceLabel", event.target.value)
                                    }
                                    helperText="The sentence next to the checkbox people tick to agree."
                                />
                            )}
                        </div>
                    </Card>

                    <Card
                        title={`Sections (${form.sections.length})`}
                        description={
                            config.liveBlocks
                                ? "Live blocks are written from your current settings (refund tiers, pickup hours, late fees…) and can't be reworded here. To change one, change its setting."
                                : undefined
                        }
                    >
                        <div className="space-y-4">
                            {form.sections.map((section, index) => (
                                <SectionEditor
                                    key={section.cid}
                                    section={section}
                                    index={index}
                                    count={form.sections.length}
                                    config={config}
                                    liveValues={liveValues}
                                    onChange={(patch) =>
                                        updateSections((sections) =>
                                            sections.map((entry) =>
                                                entry.cid === section.cid
                                                    ? { ...entry, ...patch }
                                                    : entry
                                            )
                                        )
                                    }
                                    onMove={(delta) =>
                                        updateSections((sections) =>
                                            moveItem(sections, index, delta)
                                        )
                                    }
                                    onRemove={() =>
                                        updateSections((sections) =>
                                            sections.filter((entry) => entry.cid !== section.cid)
                                        )
                                    }
                                />
                            ))}

                            <Button
                                type="button"
                                variant="outline"
                                leftIcon={<Plus size={15} />}
                                onClick={() =>
                                    updateSections((sections) => [
                                        ...sections,
                                        {
                                            cid: clientId(),
                                            key: "",
                                            title: "",
                                            icon: "",
                                            condition: "",
                                            items: [
                                                { cid: clientId(), kind: "text", text: "", liveKey: "" },
                                            ],
                                        },
                                    ])
                                }
                            >
                                Add section
                            </Button>
                        </div>
                    </Card>
                </>
            )}

            {/* Version history */}
            <Card
                title="Version history"
                description="Published versions never change. Each booking, registration or application keeps the version that was accepted."
                actions={<History size={18} className="text-gray-400" />}
            >
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(view?.history ?? []).map((entry, index) => (
                        <div
                            key={entry._id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    Version {entry.version}
                                    {entry.version === current?.version && (
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                            Live
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatLegalDateTime(entry.publishedAt)}
                                    {personName(entry.publishedBy) &&
                                        ` · ${personName(entry.publishedBy)}`}
                                    {typeof entry.acceptedBookings === "number" &&
                                        ` · accepted on ${entry.acceptedBookings} booking${
                                            entry.acceptedBookings === 1 ? "" : "s"
                                        }`}
                                </p>
                                {entry.changeNote && (
                                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                        {entry.changeNote}
                                    </p>
                                )}
                            </div>

                            <div className="flex shrink-0 gap-1">
                                {view.history[index + 1] && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        leftIcon={<GitCompare size={14} />}
                                        onClick={() =>
                                            setComparing({
                                                older: view.history[index + 1],
                                                newer: entry,
                                            })
                                        }
                                    >
                                        Compare with previous
                                    </Button>
                                )}

                                <Button
                                    size="sm"
                                    variant="ghost"
                                    leftIcon={<Eye size={14} />}
                                    onClick={() => setViewingVersion(entry)}
                                >
                                    View
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Modal
                isOpen={publishOpen}
                onClose={() => !publishing && setPublishOpen(false)}
                size="xl"
                title={`Publish version ${nextVersion}?`}
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setPublishOpen(false)}
                            disabled={publishing}
                        >
                            Cancel
                        </Button>
                        <Button
                            leftIcon={<Send size={15} />}
                            onClick={handlePublish}
                            loading={publishing}
                        >
                            Publish version {nextVersion}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                    <ul className="list-disc space-y-1.5 pl-5">
                        <li>
                            Everyone who opens the {config.label} from now on sees
                            version {nextVersion}.
                        </li>
                        {config.acceptance && (
                            <>
                                <li>
                                    Anything already accepted keeps the version it
                                    accepted. Nothing that was agreed to changes.
                                </li>
                                <li>
                                    Someone who opened the terms before you publish
                                    can still accept that version for{" "}
                                    {ACCEPTANCE_GRACE_MINUTES} minutes; after that
                                    they&apos;re asked to review version{" "}
                                    {nextVersion}.
                                </li>
                            </>
                        )}
                    </ul>

                    <div>
                        <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                            Changes from version {current?.version}
                        </p>
                        <div className="max-h-[45vh] overflow-y-auto pr-1">
                            {publishContent && (
                                <LegalDocumentDiff
                                    before={current}
                                    after={publishContent}
                                />
                            )}
                        </div>
                    </div>

                    <Textarea
                        id={`legal-change-note-${type}`}
                        name="changeNote"
                        label="What changed? (optional)"
                        rows={3}
                        value={changeNote}
                        onChange={(event) => setChangeNote(event.target.value)}
                        helperText="Shown in the version history, e.g. “Updated the fuel policy.”"
                    />
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={discardOpen}
                onClose={() => setDiscardOpen(false)}
                onConfirm={handleDiscard}
                loading={discarding}
                title="Discard changes?"
                message={`Your ${
                    view?.draft ? "saved draft and any unsaved edits" : "unsaved edits"
                } will be removed and the editor goes back to the live version ${
                    current?.version ?? ""
                }.`}
                confirmText="Discard"
            />

            <VersionModal
                type={type}
                entry={viewingVersion}
                onClose={() => setViewingVersion(null)}
                onCopy={handleCopyVersion}
            />

            <CompareModal
                comparing={comparing}
                onClose={() => setComparing(null)}
            />
        </div>
    );
};

export default LegalDocumentEditor;
