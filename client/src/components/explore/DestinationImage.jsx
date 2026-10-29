import { useState } from "react";

import {
    Binoculars,
    Church,
    Mountain,
    Waves,
} from "lucide-react";

/* Placeholder look per category, until a photo is uploaded. */
const PLACEHOLDERS = {
    nature: {
        icon: Mountain,
        className: "from-emerald-700 via-teal-800 to-slate-900",
    },
    heritage: {
        icon: Church,
        className: "from-amber-700 via-orange-800 to-stone-900",
    },
    viewpoints: {
        icon: Binoculars,
        className: "from-sky-700 via-indigo-800 to-slate-900",
    },
    beaches: {
        icon: Waves,
        className: "from-cyan-500 via-sky-700 to-blue-900",
    },
};

/*
 * A destination's uploaded photo, or — when it has none (or it fails to
 * load) — a tinted placeholder with the category's icon.
 */
const DestinationImage = ({
    destination,
    className = "",
    iconSize = 28,
}) => {
    const [failedSrc, setFailedSrc] = useState(null);

    const placeholder =
        PLACEHOLDERS[destination?.category] || PLACEHOLDERS.nature;
    const Icon = placeholder.icon;

    const src = destination?.image || "";
    const showImage = Boolean(src) && src !== failedSrc;

    return (
        <div
            className={`relative overflow-hidden bg-gradient-to-br ${placeholder.className} ${className}`}
        >
            {showImage ? (
                <img
                    src={src}
                    alt={destination?.name || ""}
                    loading="lazy"
                    onError={() => setFailedSrc(src)}
                    className="absolute inset-0 h-full w-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Icon
                        size={iconSize}
                        strokeWidth={1.5}
                        className="text-white/50"
                        aria-hidden="true"
                    />
                </div>
            )}
        </div>
    );
};

export default DestinationImage;
