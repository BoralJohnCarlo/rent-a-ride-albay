import { useEffect, useState } from "react";

import { ShieldCheck } from "lucide-react";

import Button from "../common/Button";
import Checkbox from "../common/Checkbox";
import DatePicker from "../common/DatePicker";
import Modal from "../common/Modal";

// "YYYY-MM-DD" of the Manila calendar day a moment falls on.
const toManilaDateKey = (value) =>
    new Date(value).toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
    });

/*
 * Verifying an ID also records the expiry date printed on it, so the
 * verification goes on hold by itself once the ID expires (server:
 * isUserEffectivelyVerified). IDs without one (e.g. PhilSys) are marked
 * "no expiry date".
 */
const VerifyValidIdDialog = ({
    isOpen,
    user,
    loading = false,
    onClose,
    onConfirm,
}) => {
    const [expirationDate, setExpirationDate] = useState("");
    const [noExpiry, setNoExpiry] = useState(false);

    const todayKey = toManilaDateKey(new Date());

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        // Prefill a still-valid date on file; an expired one has to be
        // replaced, so start blank.
        const onFile = user?.validIdExpirationDate
            ? toManilaDateKey(user.validIdExpirationDate)
            : "";

        setExpirationDate(onFile >= todayKey ? onFile : "");
        setNoExpiry(false);
    }, [isOpen, user, todayKey]);

    const canConfirm = noExpiry || Boolean(expirationDate);

    const fullName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ");

    const images = [
        { url: user?.validIdImage, label: "Front" },
        { url: user?.validIdBack, label: "Back" },
    ].filter((image) => image.url);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Verify Valid ID"
            description={fullName || undefined}
            size="md"
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    <Button
                        variant="success"
                        leftIcon={<ShieldCheck size={15} />}
                        onClick={() =>
                            onConfirm({
                                expirationDate: noExpiry
                                    ? null
                                    : expirationDate,
                            })
                        }
                        loading={loading}
                        disabled={!canConfirm}
                    >
                        Verify
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Check the {user?.validIdType || "valid ID"} and enter
                    the expiry date printed on it. Verification is put on
                    hold automatically once that date passes, until a
                    renewed ID is uploaded and verified.
                </p>

                {images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                        {images.map((image) => (
                            <button
                                key={image.label}
                                type="button"
                                onClick={() =>
                                    window.open(
                                        image.url,
                                        "_blank",
                                        "noopener,noreferrer"
                                    )
                                }
                                className="group relative block h-28 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                            >
                                <img
                                    src={image.url}
                                    alt={`Valid ID (${image.label.toLowerCase()})`}
                                    className="h-full w-full object-cover transition group-hover:opacity-80"
                                />

                                <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                    {image.label}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                <DatePicker
                    name="validIdExpirationDate"
                    label="Expiry date on the ID"
                    value={noExpiry ? "" : expirationDate}
                    onChange={(event) =>
                        setExpirationDate(event.target.value)
                    }
                    min={todayKey}
                    disabled={noExpiry}
                    placeholder="Select the expiry date"
                />

                <Checkbox
                    name="validIdNoExpiry"
                    label="This ID has no expiry date"
                    checked={noExpiry}
                    onChange={(event) =>
                        setNoExpiry(event.target.checked)
                    }
                />
            </div>
        </Modal>
    );
};

export default VerifyValidIdDialog;
