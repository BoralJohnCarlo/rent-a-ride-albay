import { useCallback, useState } from "react";

import { FileText } from "lucide-react";

import ConfirmDialog from "../../../components/common/ConfirmDialog";
import PillTabs from "../../../components/common/PillTabs";
import LegalDocumentEditor from "../../../components/legal/LegalDocumentEditor";
import useLeaveGuard from "../../../hooks/ui/useLeaveGuard";

import {
    LEGAL_DOCUMENT_CONFIG,
    LEGAL_DOCUMENT_TYPES,
} from "../../../constants/legalDocuments";

const TAB_OPTIONS = Object.values(LEGAL_DOCUMENT_TYPES).map((type) => ({
    value: type,
    label: LEGAL_DOCUMENT_CONFIG[type].shortLabel,
}));

/*
 * Settings → Terms & Policies: the booking Terms & Conditions, the Partner
 * Terms and the public Terms of Service, each edited as a draft and
 * published as a new numbered version.
 */
const LegalDocumentSettings = () => {
    const [type, setType] = useState(LEGAL_DOCUMENT_TYPES.BOOKING_TERMS);
    const [dirty, setDirty] = useState(false);
    const [pendingType, setPendingType] = useState(null);

    const handleDirtyChange = useCallback((value) => setDirty(value), []);

    // Leaving the page (sidebar, dock, links, Back) with unsaved edits.
    const leaveGuard = useLeaveGuard(dirty, {
        fallbackPath: "/admin/settings",
    });

    // Switching documents throws away unsaved edits, so ask first.
    const requestType = (nextType) => {
        if (nextType === type) {
            return;
        }

        if (dirty) {
            setPendingType(nextType);
            return;
        }

        setType(nextType);
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        <FileText size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Terms &amp; Policies
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Edit a draft, preview it, then publish it as a new
                            version. Published versions never change, so every
                            booking keeps the terms its customer agreed to.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-center">
                <PillTabs
                    value={type}
                    onChange={requestType}
                    options={TAB_OPTIONS}
                    layoutId="legal-document-tabs"
                    label="Document"
                />
            </div>

            <LegalDocumentEditor
                key={type}
                type={type}
                onDirtyChange={handleDirtyChange}
            />

            <ConfirmDialog
                isOpen={Boolean(pendingType)}
                onClose={() => setPendingType(null)}
                onConfirm={() => {
                    setDirty(false);
                    setType(pendingType);
                    setPendingType(null);
                }}
                title="Leave without saving?"
                message="You have unsaved changes to this document. Save a draft first to keep them."
                confirmText="Discard changes"
            />

            <ConfirmDialog
                isOpen={Boolean(leaveGuard.pending)}
                onClose={leaveGuard.cancelLeave}
                onConfirm={leaveGuard.confirmLeave}
                title="Leave without saving?"
                message="You have unsaved changes on this page. Save a draft first to keep them, or leave and lose them."
                confirmText="Leave page"
            />
        </div>
    );
};

export default LegalDocumentSettings;
