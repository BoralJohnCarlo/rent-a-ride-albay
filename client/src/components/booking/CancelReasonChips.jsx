/* Common reasons a customer cancels — one tap fills the reason field. */
const QUICK_CANCEL_REASONS = [
    "Change of plans",
    "Booked the wrong dates",
    "Found another vehicle",
    "Trip was cancelled",
    "Price is too high",
    "Payment issues",
];

/*
 * Quick-pick chips shown above the cancellation reason textarea. Tapping a
 * chip replaces the reason with that text (tapping it again clears it); the
 * customer can still edit or write their own reason in the textarea below.
 */
const CancelReasonChips = ({ value = "", onSelect, disabled = false }) => {
    const current = value.trim();

    return (
        <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Quick reasons
            </p>

            <div className="flex flex-wrap gap-2">
                {QUICK_CANCEL_REASONS.map((reason) => {
                    const selected = current === reason;

                    return (
                        <button
                            key={reason}
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            onClick={() => onSelect?.(selected ? "" : reason)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                selected
                                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800/60"
                            }`}
                        >
                            {reason}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CancelReasonChips;
