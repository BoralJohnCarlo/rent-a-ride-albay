import { Pin } from "lucide-react";

/*
 * Admin fleet pin toggle, shared by the card grid and the table. `variant`
 * "card" is the glass chip over a card's photo (hidden until hover unless
 * pinned); "table" is a plain icon button for the table's first column.
 */
const VehiclePinButton = ({
    pinned = false,
    onToggle,
    variant = "table",
    className = "",
}) => {
    const label = pinned ? "Unpin vehicle" : "Pin to top";

    const base =
        variant === "card"
            ? [
                  "flex h-8 w-8 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition",
                  pinned
                      ? "bg-amber-400 text-white hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400"
                      : "bg-white/90 text-gray-500 hover:bg-white hover:text-gray-900 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:bg-gray-800/90 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
              ].join(" ")
            : [
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  pinned
                      ? "text-amber-500 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                      : "text-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300",
              ].join(" ");

    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={pinned}
            onClick={(event) => {
                event.stopPropagation();
                onToggle?.();
            }}
            className={[base, className].filter(Boolean).join(" ")}
        >
            <Pin
                size={variant === "card" ? 15 : 14}
                fill={pinned ? "currentColor" : "none"}
            />
        </button>
    );
};

export default VehiclePinButton;
