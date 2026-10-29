import { useEffect, useRef, useState } from "react";

import {
    Film,
    RotateCcw,
    Upload,
    X,
} from "lucide-react";

import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";

import defaultHeroVideo from "../../assets/videos/hero-video.mp4";

import {
    resetHeroVideo,
    uploadHeroVideo,
} from "../../api/settingsApi";

import useTheme from "../../hooks/theme/useTheme";
import useToast from "../../hooks/toast/useToast";

/* Mirrors the server's limits (uploadMiddleware.uploadHeroVideo). */
const MAX_SIZE_MB = 50;
const ACCEPTED_TYPES = ["video/mp4", "video/webm"];

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
 * Settings → Themes & Display → Hero Video. Uploading or restoring applies
 * immediately (it isn't part of the page's "Save Changes"), since a video
 * upload is its own action with its own progress.
 */
const HeroVideoSettings = ({ heroVideo, onChanged }) => {
    const toast = useToast();
    const { refreshSeasonConfig } = useTheme();

    const inputRef = useRef(null);

    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [progress, setProgress] = useState(null);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    const isCustom = Boolean(heroVideo?.url);
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
            toast.error("Choose an MP4 or WebM video.");
            event.target.value = "";
            return;
        }

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(
                `That video is ${formatSize(file.size)}. The maximum is ${MAX_SIZE_MB} MB.`
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
            await uploadHeroVideo(selectedFile, setProgress);
            await applyChange();
            clearSelection();
            toast.success("Hero video updated.");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Unable to upload the video."
            );
        } finally {
            setProgress(null);
        }
    };

    const handleReset = async () => {
        setResetting(true);

        try {
            await resetHeroVideo();
            await applyChange();
            setResetOpen(false);
            toast.success("Hero video reset to the default.");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Unable to reset the video."
            );
        } finally {
            setResetting(false);
        }
    };

    const shownSrc =
        previewUrl || heroVideo?.url || defaultHeroVideo;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                    <Film size={19} />
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Hero Video
                    </h2>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        The background video on the home page for guests and customers. Changes here apply immediately.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                {/* Preview — dimmed like the real hero so the admin sees what visitors see */}
                <div>
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-950 ring-1 ring-gray-200 dark:ring-gray-800">
                        <video
                            key={shownSrc}
                            src={shownSrc}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover"
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
                                      ? "Custom video"
                                      : "Default video"}
                            </span>
                        </div>
                    </div>

                    {!previewUrl && isCustom && (
                        <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
                            {heroVideo.originalName || "Uploaded video"}
                            {heroVideo.uploadedAt &&
                                ` · uploaded ${formatDate(heroVideo.uploadedAt)}`}
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
                        id="hero-video-input"
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
                                        aria-label="Discard selected video"
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
                                            : "Processing video…"}
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
                                Choose a new video
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                MP4 or WebM, up to {MAX_SIZE_MB} MB
                            </span>
                        </button>
                    )}

                    <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <li>• Landscape (16:9), at least 1280×720 looks best.</li>
                        <li>• It plays muted and on a loop, so short clips (10–30s) work well.</li>
                        <li>• Keep it small — every visitor downloads it.</li>
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
                            Restore default video
                        </Button>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={resetOpen}
                onClose={() => setResetOpen(false)}
                onConfirm={handleReset}
                title="Restore the default hero video?"
                message="The uploaded video will be removed and the home page will go back to the original video."
                confirmText="Restore default"
                confirmVariant="danger"
                loading={resetting}
            />
        </div>
    );
};

export default HeroVideoSettings;
