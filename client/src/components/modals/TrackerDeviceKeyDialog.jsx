import { useState } from "react";
import { Copy, Check, ShieldAlert } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";

/*
 * Shown exactly once, immediately after a tracker is registered or its key
 * is regenerated - the plaintext deviceKey never travels through
 * Redux/localStorage/console, only through this component's own props (see
 * GPS.jsx's local dialog state).
 */
const TrackerDeviceKeyDialog = ({
    open,
    tracker,
    onClose,
    title = "Tracker Registered",
    notice = null,
}) => {
    const [copied, setCopied] = useState(false);

    if (!tracker) {
        return null;
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(tracker.deviceKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access can fail (permissions/non-secure context) -
            // the key remains visible on screen either way.
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <ShieldAlert
                        size={20}
                        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                    />

                    <p className="text-sm text-amber-800 dark:text-amber-300">
                        This device key is shown only once. Store it
                        securely - it cannot be retrieved again after
                        closing this dialog.
                        {notice && <> {notice}</>}
                    </p>
                </div>

                <div>
                    <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                        Device ID / IMEI
                    </p>

                    <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                        {tracker.imei}
                    </p>
                </div>

                <div>
                    <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                        Device Key
                    </p>

                    <div className="flex items-center gap-2">
                        <p className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 font-mono text-sm break-all text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                            {tracker.deviceKey}
                        </p>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopy}
                            aria-label="Copy device key"
                            title="Copy device key"
                        >
                            {copied ? (
                                <Check size={16} />
                            ) : (
                                <Copy size={16} />
                            )}
                        </Button>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={onClose}>
                        I&apos;ve stored it securely
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default TrackerDeviceKeyDialog;
