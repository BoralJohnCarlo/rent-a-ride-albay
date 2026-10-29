import {
    FileText,
    IdCard,
    ImageOff,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";

import formatDate from "../../utils/formatDate";

const DOCUMENT_TYPES = [
    {
        type: "officialReceipt",
        label: "Official Receipt (OR)",
        icon: FileText,
    },
    {
        type: "certificateOfRegistration",
        label: "Certificate of Registration (CR)",
        icon: IdCard,
    },
];

/*
 * Read-only viewer for a vehicle's OR/CR — current version plus every
 * superseded one (e.g. an OR replaced during registration renewal), each
 * with when it was recorded. Falls back gracefully for a vehicle whose
 * documents predate history tracking (documents.history missing/empty):
 * it still shows the current OR/CR, just without a known upload date.
 */
const VehicleDocumentsDialog = ({
    open,
    vehicle,
    onClose,
}) => {
    if (!vehicle) {
        return null;
    }

    const documents = vehicle.documents || {};
    const history = documents.history || [];

    const sectionsFor = (type) => {
        /*
         * Newest-first by original insertion order, NOT by uploadedAt —
         * a renewal backfills the outgoing document and records the new
         * one in the same tick, so they can end up with the exact same
         * millisecond timestamp. Sorting by date in that case is a tie,
         * and since Array.prototype.sort is stable, a tie keeps the
         * OLD entry (inserted first) ahead of the new one, mislabeling
         * it "Current". `history` is strictly append-only, so reversing
         * it is always correct regardless of timestamp collisions.
         */
        const versions = history
            .filter((entry) => entry.type === type)
            .reverse();

        if (versions.length > 0) {
            return versions;
        }

        const current = documents[type];

        if (!current?.url) {
            return [];
        }

        return [
            {
                ...current,
                uploadedAt: null,
            },
        ];
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Vehicle Documents"
            size="lg"
            footer={
                <Button
                    variant="secondary"
                    onClick={onClose}
                >
                    Close
                </Button>
            }
        >
            <div className="space-y-6">
                {DOCUMENT_TYPES.map(
                    ({ type, label, icon: Icon }) => {
                        const versions =
                            sectionsFor(type);

                        return (
                            <section key={type}>
                                <div className="mb-3 flex items-center gap-2">
                                    <Icon
                                        size={16}
                                        className="text-gray-500 dark:text-gray-400"
                                    />

                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {label}
                                    </h3>
                                </div>

                                {versions.length === 0 ? (
                                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
                                        <ImageOff
                                            size={16}
                                        />
                                        No document on file.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                                        {versions.map(
                                            (
                                                version,
                                                index
                                            ) => (
                                                <a
                                                    key={
                                                        version.publicId ||
                                                        `${type}-${index}`
                                                    }
                                                    href={
                                                        version.url
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800"
                                                >
                                                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                                                        <img
                                                            src={
                                                                version.url
                                                            }
                                                            alt={`${label} ${
                                                                index === 0
                                                                    ? "(current)"
                                                                    : ""
                                                            }`}
                                                            className="h-full w-full object-cover transition group-hover:opacity-90"
                                                        />

                                                        {index === 0 && (
                                                            <span className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                                Current
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="p-2.5">
                                                        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                                                            {version.originalName ||
                                                                "Document"}
                                                        </p>

                                                        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                                                            {version.uploadedAt
                                                                ? formatDate(
                                                                      version.uploadedAt
                                                                  )
                                                                : "Upload date unknown"}
                                                        </p>
                                                    </div>
                                                </a>
                                            )
                                        )}
                                    </div>
                                )}
                            </section>
                        );
                    }
                )}
            </div>
        </Modal>
    );
};

export default VehicleDocumentsDialog;
