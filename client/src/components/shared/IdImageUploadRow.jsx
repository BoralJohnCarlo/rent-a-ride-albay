import {
    useEffect,
    useRef,
    useState,
} from "react";

import { Upload, X } from "lucide-react";

const ACCEPTED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const MAX_FILE_SIZE =
    5 * 1024 * 1024;

// Same checks the two-slot row applies; returns an error message or "".
const getImageFileError = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
        return "Only JPG, PNG, and WEBP images are allowed.";
    }

    if (file.size > MAX_FILE_SIZE) {
        return "Each image must be 5 MB or smaller.";
    }

    return "";
};

const IdImageSlot = ({
    label,
    image,
    disabled = false,
    onSelectFile,
    onRemove,
}) => {
    const inputRef =
        useRef(null);

    const [isDragging, setIsDragging] =
        useState(false);

    const handleBrowse = () => {
        if (disabled) {
            return;
        }

        inputRef.current?.click();
    };

    const handleFile = (file) => {
        if (!file || disabled) {
            return;
        }

        onSelectFile(file);
    };

    const handleInputChange = (event) => {
        handleFile(event.target.files?.[0]);

        event.target.value = "";
    };

    const handleDragOver = (event) => {
        event.preventDefault();

        if (disabled) {
            return;
        }

        setIsDragging(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();

        if (
            event.relatedTarget &&
            event.currentTarget.contains(event.relatedTarget)
        ) {
            return;
        }

        setIsDragging(false);
    };

    const handleDrop = (event) => {
        event.preventDefault();

        setIsDragging(false);

        if (disabled) {
            return;
        }

        handleFile(event.dataTransfer.files?.[0]);
    };

    const previewSrc =
        image?.preview ??
        image?.url ??
        null;

    if (previewSrc) {
        return (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <img
                    src={previewSrc}
                    alt={label}
                    className="h-full w-full object-cover"
                />

                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                    {label}
                </span>

                {!disabled && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRemove?.();
                        }}
                        aria-label={`Remove ${label}`}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            onClick={handleBrowse}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label={`Upload ${label}`}
            onKeyDown={(event) => {
                if (disabled) {
                    return;
                }

                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();

                    handleBrowse();
                }
            }}
            className={[
                "flex aspect-[4/3] w-full select-none flex-col items-center justify-center rounded-lg border-2 border-dashed p-3 text-center transition",

                isDragging
                    ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
                    : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900",

                disabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-yellow-400 hover:bg-gray-50 dark:hover:bg-gray-800",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Upload
                size={20}
                className="text-gray-400"
            />

            <p className="mt-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                {label}
            </p>

            <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                Click or drag to upload
            </p>

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                hidden
                disabled={disabled}
                onChange={handleInputChange}
            />
        </div>
    );
};

const IdImageUploadRow = ({
    title,
    helperText,
    images = [],
    onChange,
    disabled = false,
    frontLabel = "Front",
    backLabel = "Back",
    required = false,
}) => {
    const [error, setError] =
        useState("");

    useEffect(() => {
        return () => {
            images.forEach((image) => {
                if (image?.preview?.startsWith("blob:")) {
                    URL.revokeObjectURL(image.preview);
                }
            });
        };
    }, [images]);

    const handleSelectFile = (index, file) => {
        const fileError = getImageFileError(file);

        if (fileError) {
            setError(fileError);
            return;
        }

        setError("");

        const newImage = {
            id:
                crypto.randomUUID?.() ??
                `${Date.now()}-${Math.random()}-${index}`,

            file,

            preview:
                URL.createObjectURL(file),

            url: null,

            publicId: null,

            originalName:
                file.name,

            isPrimary:
                index === 0,
        };

        const next = [
            images[0],
            images[1],
        ];

        next[index] = newImage;

        onChange?.(next);
    };

    const handleRemove = (index) => {
        const current = images[index];

        if (current?.preview?.startsWith("blob:")) {
            URL.revokeObjectURL(current.preview);
        }

        const next = [
            images[0],
            images[1],
        ];

        next[index] = null;

        setError("");

        onChange?.(next);
    };

    return (
        <div>
            {(title || helperText) && (
                <div>
                    {title && (
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {title}
                            {required && (
                                <span className="ml-1 text-red-500">
                                    *
                                </span>
                            )}
                        </h3>
                    )}

                    {helperText && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {helperText}
                        </p>
                    )}
                </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
                <IdImageSlot
                    label={frontLabel}
                    image={images[0]}
                    disabled={disabled}
                    onSelectFile={(file) =>
                        handleSelectFile(0, file)
                    }
                    onRemove={() => handleRemove(0)}
                />

                <IdImageSlot
                    label={backLabel}
                    image={images[1]}
                    disabled={disabled}
                    onSelectFile={(file) =>
                        handleSelectFile(1, file)
                    }
                    onRemove={() => handleRemove(1)}
                />
            </div>

            {error && (
                <p
                    className="mt-2 text-xs font-medium text-red-600 dark:text-red-400"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
};

/*
 * One image instead of a front/back pair (e.g. the proof of billing
 * address). `image` is { file, preview } once chosen, or null.
 */
export const SingleImageUpload = ({
    label,
    image,
    onChange,
    disabled = false,
}) => {
    const [error, setError] =
        useState("");

    /*
     * Revoked only when replaced or removed, not on unmount: a multi-step
     * form unmounts this between steps but keeps the chosen image.
     */
    const releasePreview = () => {
        if (image?.preview?.startsWith("blob:")) {
            URL.revokeObjectURL(image.preview);
        }
    };

    const handleSelectFile = (file) => {
        const fileError = getImageFileError(file);

        if (fileError) {
            setError(fileError);
            return;
        }

        setError("");
        releasePreview();

        onChange?.({
            file,
            preview: URL.createObjectURL(file),
            url: null,
            originalName: file.name,
        });
    };

    return (
        <div>
            <div className="grid max-w-xs grid-cols-1 gap-3">
                <IdImageSlot
                    label={label}
                    image={image}
                    disabled={disabled}
                    onSelectFile={handleSelectFile}
                    onRemove={() => {
                        setError("");
                        releasePreview();
                        onChange?.(null);
                    }}
                />
            </div>

            {error && (
                <p
                    className="mt-2 text-xs font-medium text-red-600 dark:text-red-400"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
};

export default IdImageUploadRow;
