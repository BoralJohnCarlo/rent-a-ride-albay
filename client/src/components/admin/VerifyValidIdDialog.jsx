import { useEffect, useId, useState } from "react";

import { ShieldCheck } from "lucide-react";

import Button from "../common/Button";
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
    const [expiryChoice, setExpiryChoice] = useState("");
    const expiryGroupId = useId();

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

        const wasVerified = user?.verifiedByAdmin ?? user?.isVerified;
        const confirmedHasExpiry = user?.validIdHasExpiration === true || Boolean(onFile && wasVerified);
        const confirmedNoExpiry = user?.validIdHasExpiration === false ||
            (user?.validIdHasExpiration == null && !onFile && wasVerified);
        setExpirationDate(confirmedHasExpiry && onFile >= todayKey ? onFile : "");
        setExpiryChoice(confirmedNoExpiry ? "none" : confirmedHasExpiry ? "date" : "");
    }, [isOpen, user, todayKey]);

    const canConfirm = expiryChoice === "none" || (expiryChoice === "date" && Boolean(expirationDate) && expirationDate >= todayKey);

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
                            canConfirm && !loading && onConfirm({
                                expirationDate: expiryChoice === "none"
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
                    Check the {user?.validIdType || "valid ID"} and choose whether
                    it has an expiration date. Only enter a date if one is printed on the ID.
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

                <fieldset disabled={loading} className="space-y-2">
                    <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Does this ID have an expiration date?</legend>
                    {[{ value: "date", label: "Has an expiration date" }, { value: "none", label: "No expiration date" }].map(option => (
                        <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200">
                            <input type="radio" name={expiryGroupId} value={option.value} checked={expiryChoice === option.value} onChange={() => setExpiryChoice(option.value)} className="h-4 w-4 shrink-0" />
                            {option.label}
                        </label>
                    ))}
                </fieldset>

                {expiryChoice === "date" && <DatePicker
                    name="validIdExpirationDate"
                    label="Expiry date on the ID"
                    value={expirationDate}
                    onChange={(event) =>
                        setExpirationDate(event.target.value)
                    }
                    min={todayKey}
                    disabled={loading}
                    required
                    placeholder="Select the expiry date"
                />}
                {expiryChoice === "date" && <p className="text-sm text-gray-500 dark:text-gray-400">Verification is put on hold after this date until a renewed ID is uploaded and verified.</p>}
            </div>
        </Modal>
    );
};

export default VerifyValidIdDialog;
