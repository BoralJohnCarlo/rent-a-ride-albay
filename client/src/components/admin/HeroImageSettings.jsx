import { useEffect, useRef, useState } from "react";

import {
    Image as ImageIcon,
    RotateCcw,
    Upload,
    X,
} from "lucide-react";

import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";

import defaultHeroImage from "../../assets/images/hero/DefaultHeroImage.png";

import {
    resetHeroImage,
    uploadHeroImage,
} from "../../api/settingsApi";

import useTheme from "../../hooks/theme/useTheme";
import useToast from "../../hooks/toast/useToast";

/* Mirrors the server's limits (uploadMiddleware.uploadHeroImage). */
const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const formatSize = (bytes) =>
    bytes >= 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : null;

/*
 * Settings → Themes & Display → Hero Image (used when Hero Background is
 * set to Image). Same flow as HeroVideoSettings: uploading or restoring
 * applies immediately; the bundled DefaultHeroImage.png is the default.
 */
const HeroImageSettings = ({ heroImage, onChanged }) => {
    const toast = useToast();
    const { refreshSeasonConfig } = useTheme();

    const inputRef = useRef(null);

    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [progress, setProgress] = useState(null);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    const isCustom = Boolean(heroImage?.url);
    const uploading = progress !== null;

    // Free the object URL of a picked-but-discarded file.
    useEffect(
        () => () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        },
        [previewUrl]
    );

    const clearSelection = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];

        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            toast.error("Choose a JPG, PNG or WebP image.");
            event.target.value = "";
            return;
        }

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(
                `That image is ${formatSize(file.size)}. The maximum is ${MAX_SIZE_MB} MB.`
            );
            event.target.value = "";
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const applyChange = async () => {
        await refreshSeasonConfig();
        await onChanged?.();
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setProgress(0);

        try {
            await uploadHeroImage(selectedFile, setProgress);
            await applyChange();
            clearSelection();
            toast.success("Hero image updated.");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Unable to upload the image."
            );
        } finally {
            setProgress(null);
        }
    };

    const handleReset = async () => {
        setResetting(true);

        try {
            await resetHeroImage();
            await applyChange();
            setResetOpen(false);
            toast.success("Hero image reset to the default.");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Unable to reset the image."
            );
        } finally {
            setResetting(false);
        }
    };

    const shownSrc =
        previewUrl || heroImage?.url || defaultHeroImage;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                    <ImageIcon size={19} />
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Hero Image
                    </h2>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        The background picture on the home page for guests and customers. Changes here apply immediately.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                {/* Preview — dimmed like the real hero so the admin sees what visitors see */}
                <div>
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-950 ring-1 ring-gray-200 dark:ring-gray-800">
                        <img
                            key={shownSrc}
                            src={shownSrc}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
                        />

                        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                            <p className="text-sm font-black leading-tight text-white drop-shadow sm:text-base">
                                Your Journey
                                <br />
                                in <span className="text-yellow-400">Albay</span>
                            </p>

                            <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
                                    previewUrl
                                        ? "bg-blue-500/80 text-white"
                                        : isCustom
                                          ? "bg-yellow-400/90 text-gray-950"
                                          : "bg-white/20 text-white"
                                }`}
                            >
                                {previewUrl
                                    ? "Preview — not applied yet"
                                    : isCustom
                                      ? "Custom image"
                                      : "Default image"}
                            </span>
                        </div>
                    </div>

                    {!previewUrl && isCustom && (
                        <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
                            {heroImage.originalName || "Uploaded image"}
                            {heroImage.uploadedAt &&
                                ` · uploaded ${formatDate(heroImage.uploadedAt)}`}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-4">
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        onChange={handleFileChange}
                        className="hidden"
                        id="hero-image-input"
                    />

                    {selectedFile ? (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatSize(selectedFile.size)}
                                    </p>
                                </div>

                                {!uploading && (
                                    <button
                                        type="button"
                                        onClick={clearSelection}
                                        className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                        aria-label="Discard selected image"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {uploading && (
                                <div className="mt-3">
                                    <div className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
                                        <div
                                            className="h-full rounded-full bg-blue-600 transition-[width] duration-200"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                        {progress < 100
                                            ? `Uploading… ${progress}%`
                                            : "Processing image…"}
                                    </p>
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleUpload}
                                    loading={uploading}
                                >
                                    Upload &amp; apply
                                </Button>

                                {!uploading && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => inputRef.current?.click()}
                                    >
                                        Choose another
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-8 text-center transition-colors hover:border-violet-400 hover:bg-violet-50/50 dark:border-gray-700 dark:hover:border-violet-600 dark:hover:bg-violet-950/20"
                        >
                            <Upload size={22} className="text-violet-500" />
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                Choose a new image
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                JPG, PNG or WebP, up to {MAX_SIZE_MB} MB
                            </span>
                        </button>
                    )}

                    <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <li>• A wide landscape photo, at least 1920 pixels across, looks best.</li>
                        <li>• Keep the main subject right of centre — the headline covers the left.</li>
                        <li>• JPG or WebP keeps it light; every visitor downloads it.</li>
                    </ul>

                    {isCustom && !selectedFile && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setResetOpen(true)}
                            className="self-start"
                        >
                            <RotateCcw size={14} className="mr-1.5" />
                            Restore default image
                        </Button>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={resetOpen}
                onClose={() => setResetOpen(false)}
                onConfirm={handleReset}
                title="Restore the default hero image?"
                message="The uploaded image will be removed and the home page will go back to the original picture."
                confirmText="Restore default"
                confirmVariant="danger"
                loading={resetting}
            />
        </div>
    );
};

export default HeroImageSettings;
