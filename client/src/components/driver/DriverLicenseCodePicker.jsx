import { useId } from "react";
import { Check } from "lucide-react";
import { DRIVER_LICENSE_CODE_VALUES } from "../../constants/driverConstants";

const MAIN_OPTIONS = [
    { code: "A", label: "Motorcycle" },
    { code: "B", label: "Passenger Car" },
];
const ADDITIONAL_CODES = DRIVER_LICENSE_CODE_VALUES.filter((code) => !["A", "B"].includes(code));

// Keep the existing restrictionCodes array intact; toggling one option never
// converts or drops other recorded categories.
const DriverLicenseCodePicker = ({ value, onChange, disabled = false, error }) => {
    const id = useId();
    const toggleCode = (code) => {
        if (disabled) return;
        onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
    };
    const additionalSelected = value.filter((code) => ADDITIONAL_CODES.includes(code));

    return (
        <fieldset className="min-w-0" disabled={disabled} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}>
            <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">What is this driver licensed to drive?</legend>
            <p id={`${id}-help`} className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">Select all that apply, as shown on the driver's license.</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {MAIN_OPTIONS.map(({ code, label }) => {
                    const selected = value.includes(code);
                    return (
                        <button
                            key={code}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleCode(code)}
                            disabled={disabled}
                            className={`group relative flex min-h-28 min-w-0 flex-col items-center justify-center rounded-lg border p-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${selected
                                ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 dark:bg-blue-900/20"
                                : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"}`}
                        >
                            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-900 dark:bg-gray-800 dark:text-gray-100">{code}</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
                            {selected && <span aria-hidden="true" className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"><Check size={13} /></span>}
                        </button>
                    );
                })}
            </div>
            <details className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <summary className="min-h-11 cursor-pointer rounded-lg px-3 py-3 text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-200">
                    Additional license codes{additionalSelected.length > 0 ? ` (${additionalSelected.join(", ")})` : ""}
                </summary>
                <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4">
                    {ADDITIONAL_CODES.map((code) => (
                        <button key={code} type="button" aria-pressed={value.includes(code)} disabled={disabled} onClick={() => toggleCode(code)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${value.includes(code)
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/50"}`}>{code}</button>
                    ))}
                </div>
            </details>
            {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </fieldset>
    );
};

export default DriverLicenseCodePicker;
