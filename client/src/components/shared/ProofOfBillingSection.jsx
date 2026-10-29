import { useEffect, useRef, useState } from "react";

import { Loader2, Upload } from "lucide-react";

import Button from "../common/Button";

import useToast from "../../hooks/toast/useToast";
import { uploadProofOfBilling } from "../../services/userService";

const ACCEPTED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/*
 * Profile section (customer and partner alike) for the proof of billing
 * address, placed right below the Valid ID section. Only rendered while the
 * admin has proof of billing turned on; an account without one (registered
 * while it was off) can add it here, and anyone can replace theirs.
 */
const ProofOfBillingSection = ({
    url,
    onView,
    onUploaded,
    className = "",
}) => {
    const toast = useToast();
    const inputRef = useRef(null);

    const [uploading, setUploading] = useState(false);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [url]);

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) {
            return;
        }

        if (!ACCEPTED_TYPES.includes(file.type)) {
            toast.error("Only JPG, PNG, and WEBP images are allowed.", "Error");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            toast.error("The image must be 5 MB or smaller.", "Error");
            return;
        }

        setUploading(true);

        try {
            const response = await uploadProofOfBilling(file);

            onUploaded?.(response?.data?.proofOfBillingImage || "");

            toast.success("Proof of billing address updated.", "Saved");
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Unable to upload your proof of billing address.",
                "Error"
            );
        } finally {
            setUploading(false);
        }
    };

    const hasImage = Boolean(url) && !imgError;

    return (
        <section
            className={`border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${className}`}
        >
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                    Address
                </p>

                <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                    Proof of Billing Address
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    A recent utility bill or bank statement showing your
                    name and address.
                </p>
            </div>

            <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            Proof of Billing Image
                        </label>

                        {hasImage ? (
                            <button
                                type="button"
                                onClick={() =>
                                    onView?.({
                                        url,
                                        label: "Proof of Billing Address",
                                    })
                                }
                                className="group relative block h-32 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                            >
                                <img
                                    src={url}
                                    alt="Proof of billing address"
                                    onError={() => setImgError(true)}
                                    className="h-full w-full object-cover transition group-hover:opacity-80"
                                />

                                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                                    Click to view
                                </span>
                            </button>
                        ) : (
                            <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                                {url && imgError
                                    ? "Unable to load image"
                                    : "Not uploaded yet"}
                            </div>
                        )}
                    </div>

                    <div className="flex items-end">
                        <input
                            ref={inputRef}
                            type="file"
                            accept={ACCEPTED_TYPES.join(",")}
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />

                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            leftIcon={
                                uploading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Upload size={16} />
                                )
                            }
                            onClick={() => inputRef.current?.click()}
                            disabled={uploading}
                        >
                            {url ? "Replace image" : "Upload image"}
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProofOfBillingSection;
