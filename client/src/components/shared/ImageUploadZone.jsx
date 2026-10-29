import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    Star,
    Trash2,
    Upload,
} from "lucide-react";

const ACCEPTED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const DEFAULT_MAX_FILES = 10;

const MAX_FILE_SIZE =
    5 * 1024 * 1024;

const normalizeImage = (
    image,
    index
) => ({
    id:
      image.id ??
      image.publicId ??
      image.url ??
      image.preview ??
     `${image.originalName ?? "image"}-${index}`,

    file:
        image.file ??
        null,

    preview:
        image.preview ??
        null,

    url:
        image.url ??
        null,

    publicId:
        image.publicId ??
        null,

    originalName:
        image.originalName ??
        image.file?.name ??
        `Image ${index + 1}`,

    isPrimary:
        image.isPrimary ??
        index === 0,
});

const ImageUploadZone = ({
    title = "Image Upload",
    helperText = "Drag & drop images or click to browse.",

    images = [],

    onChange,

    canUpload = true,
    canDelete = true,
    canSetPrimary = true,

    maxFiles =
        DEFAULT_MAX_FILES,

    disabled = false,
}) => {
    const inputRef =
        useRef(null);

    const [isDragging, setIsDragging] =
        useState(false);

    const [error, setError] =
        useState("");

    const imageList =
        useMemo(
            () =>
                images.map(
                    normalizeImage
                ),
            [images]
        );

    const canAddMoreImages =
        canUpload &&
        !disabled &&
        imageList.length <
            maxFiles;

    const isAtMaxFiles =
        imageList.length >=
        maxFiles;

    let uploadTitle =
        "Image Upload Disabled";

    let uploadDescription =
        "Uploading images is currently unavailable.";

    if (canAddMoreImages) {
        uploadTitle =
            "Drag & Drop Images";

        uploadDescription =
            "Or click anywhere inside this area to browse your files.";
    } else if (
        isAtMaxFiles
    ) {
        uploadTitle =
            "Maximum Image Limit Reached";

        uploadDescription =
            "Remove an image before uploading another one.";
    }

    const validateFiles = (
        files
    ) => {
        const selectedFiles =
            Array.from(files ?? []);

        if (
            selectedFiles.length === 0
        ) {
            return {
                validFiles: [],
                error: "",
            };
        }

        const invalidFiles =
            selectedFiles.filter(
                (file) =>
                    !ACCEPTED_TYPES.includes(
                        file.type
                    )
            );

        if (invalidFiles.length) {
            return {
                validFiles: [],
                error:
                    "Only JPG, PNG, and WEBP images are allowed.",
            };
        }

        const oversizedFiles =
            selectedFiles.filter(
                (file) =>
                    file.size >
                    MAX_FILE_SIZE
            );

        if (
            oversizedFiles.length
        ) {
            return {
                validFiles: [],
                error:
                    "Each image must be 5 MB or smaller.",
            };
        }

        if (
            imageList.length +
                selectedFiles.length >
            maxFiles
        ) {
            return {
                validFiles: [],
                error: `You can upload up to ${maxFiles} images only.`,
            };
        }

        return {
            validFiles:
                selectedFiles,
            error: "",
        };
    };

    const createImageObjects = (
        files
    ) => {
        return files.map(
            (
                file,
                index
            ) => {
                const preview =
                    URL.createObjectURL(
                        file
                    );

                return {
                    id:
                        crypto.randomUUID?.() ??
                        `${Date.now()}-${Math.random()}-${index}`,

                    file,

                    preview,

                    url: null,

                    publicId: null,

                    originalName:
                        file.name,

                    isPrimary:
                        imageList.length ===
                            0 &&
                        index === 0,
                };
            }
        );
    };

const mergeImages = (
    newImages
) => {
    return [
        ...imageList,
        ...newImages,
    ];
};

    const updateImages = (
        nextImages
    ) => {
        setError("");

        onChange?.(
            nextImages
        );
    };

    const handleFiles = (
        fileList
    ) => {
        const {
            validFiles,
            error,
        } = validateFiles(
            fileList
        );

        if (error) {
            setError(error);
            return;
        }

        const newImages =
            createImageObjects(
                validFiles
            );

         applyImageUpdates(
         mergeImages(
             newImages
         )
        );
    };

    const revokePreview = (
        image
    ) => {
        if (
            image?.preview?.startsWith(
                "blob:"
            )
        ) {
            URL.revokeObjectURL(
                image.preview
            );
        }
    };

    const ensurePrimaryImage = (
        images
    ) => {
        if (
            images.length === 0
        ) {
            return images;
        }

        if (
            images.some(
                (image) =>
                    image.isPrimary
            )
        ) {
            return images;
        }

        return images.map(
            (
                image,
                index
            ) => ({
                ...image,
                isPrimary:
                    index === 0,
            })
        );
    };

    const applyImageUpdates = (
        images
    ) => {
        updateImages(
            ensurePrimaryImage(
                images
            )
        );
    };

    const handleBrowse = () => {
        if (
            !canAddMoreImages
        ) {
            return;
        }

        inputRef.current?.click();
    };

    const handleInputChange = (
        event
    ) => {
        handleFiles(
            event.target.files
        );

        event.target.value =
            "";
    };

    const handleDragOver = (
        event
    ) => {
        event.preventDefault();

        if (
            !canAddMoreImages
        ) {
            return;
        }

        setIsDragging(true);
    };

    const handleDragLeave = (
        event
    ) => {
        event.preventDefault();

if (
    event.relatedTarget &&
    event.currentTarget.contains(
        event.relatedTarget
    )
) {
    return;
}

        setIsDragging(false);
    };

    const handleDrop = (
        event
    ) => {
        event.preventDefault();

        setIsDragging(false);

        if (
            !canAddMoreImages
        ) {
            return;
        }

        handleFiles(
            event.dataTransfer.files
        );
    };

    const handleRemoveImage = (
        imageId
    ) => {
        if (
            disabled ||
            !canDelete
        ) {
            return;
        }

        const removedImage =
            imageList.find(
                (image) =>
                    image.id ===
                    imageId
            );

        revokePreview(
            removedImage
        );

        applyImageUpdates(
            imageList.filter(
                (image) =>
                    image.id !==
                    imageId
            )
        );
    };

    const handlePrimaryImage = (
        imageId
    ) => {
        if (
            disabled ||
            !canSetPrimary
        ) {
            return;
        }

        applyImageUpdates(
            imageList.map(
                (image) => ({
                    ...image,
                    isPrimary:
                        image.id ===
                        imageId,
                })
            )
        );
    };

    useEffect(() => {
        return () => {
            imageList.forEach(
                revokePreview
            );
        };
    }, [imageList]);

    return (
        <div className="space-y-6">
            <div>
                {title && (
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </h3>
                )}

{helperText && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {helperText}
                        </p>
                    )}
            </div>

            {canUpload && (
                <div
                    onClick={handleBrowse}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    role="button"
                    tabIndex={
                        canAddMoreImages
                            ? 0
                            : -1
                    }
                    aria-disabled={
                        !canAddMoreImages
                    }
                    aria-label="Upload vehicle images"
                    onKeyDown={(
                        event
                    ) => {
                        if (
                            !canAddMoreImages
                        ) {
                            return;
                        }

                        if (
                            event.key ===
                                "Enter" ||
                            event.key ===
                                " "
                        ) {
                            event.preventDefault();

                            handleBrowse();
                        }
                    }}
                    className={[
                        "flex select-none flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition",

                        isDragging
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                            : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900",

                        canAddMoreImages
                            ? "cursor-pointer hover:border-blue-400 hover:bg-gray-50 dark:hover:border-blue-500 dark:hover:bg-gray-800"
                            : "cursor-not-allowed opacity-60",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <div className="mb-4 rounded-full bg-blue-100 p-4 dark:bg-blue-900/40">
                        <Upload
                            size={32}
                            className="text-blue-600 dark:text-blue-400"
                        />
                    </div>

                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        {uploadTitle}
                    </h4>

                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {uploadDescription}
                    </p>

                    <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                        JPG • JPEG • PNG • WEBP
                    </p>

                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {imageList.length}
                        {" / "}
                        {maxFiles}
                        {" Images"}
                    </p>

                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(
                            ","
                        )}
                        multiple
                        hidden
                        disabled={
                            !canAddMoreImages
                        }
                        onChange={
                            handleInputChange
                        }
                    />
                </div>
            )}

{error && (
                    <p
                        className="text-sm font-medium text-red-600 dark:text-red-400"
                        role="alert"
                    >
                        {error}
                </p>
            )}

            <div>
                <h4 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                    Uploaded Images
                </h4>

                {imageList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-900">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            No images uploaded yet.
                        </p>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Upload one or more images to preview them here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        {imageList.map(
                            (image) => (
                                <div
                                    key={image.id}
                                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
                                >
                                    <div className="relative aspect-square overflow-hidden">
                                        <img
                                            src={
                                                image.preview ??
                                                image.url
                                            }
                                            alt={
                                                image.originalName
                                            }
                                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                        />

                                        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

                                        <div className="absolute right-2 top-2 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                                            {canSetPrimary &&
                                                !image.isPrimary && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handlePrimaryImage(
                                                                image.id
                                                            )
                                                        }
                                                        disabled={
                                                            disabled
                                                        }
                                                        aria-label="Set as primary image"
                                                        title="Set as Primary"
                                                        className="rounded-full bg-white p-2 shadow transition hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-yellow-900/30"
                                                    >
                                                        <Star
                                                            size={16}
                                                            className="text-yellow-500"
                                                        />
                                                    </button>
                                                )}

                                            {canDelete && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRemoveImage(
                                                            image.id
                                                        )
                                                    }
                                                    disabled={
                                                        disabled
                                                    }
                                                    aria-label="Remove image"
                                                    title="Remove Image"
                                                    className="rounded-full bg-white p-2 shadow transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-red-900/30"
                                                >
                                                    <Trash2
                                                        size={16}
                                                        className="text-red-600 dark:text-red-400"
                                                    />
                                                </button>
                                            )}
                                        </div>

                                        {image.isPrimary && (
                                            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-1 text-xs font-semibold text-white shadow">
                                                <Star
                                                    size={12}
                                                    fill="currentColor"
                                                />
                                                Primary
                                            </span>
                                        )}
                                    </div>

                                    <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
                                        <p
                                            className="truncate text-xs font-medium text-gray-700 dark:text-gray-300"
                                            title={
                                                image.originalName
                                            }
                                        >
                                            {
                                                image.originalName
                                            }
                                        </p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageUploadZone;