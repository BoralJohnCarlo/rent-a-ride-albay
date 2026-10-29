import { Check, X } from "lucide-react";

// `rules` from utils/passwordRules getPasswordRules; `columns` lays them
// out two-up from the sm breakpoint.
const PasswordChecklist = ({ rules, columns = false, className = "" }) => (
    <ul
        className={`${
            columns ? "grid gap-x-4 gap-y-2 sm:grid-cols-2" : "space-y-2"
        } ${className}`}
    >
        {rules.map((rule) => (
            <li
                key={rule.label}
                className={`flex items-center gap-2 text-sm transition-colors ${
                    rule.met
                        ? "text-green-700 dark:text-green-400"
                        : "text-gray-500 dark:text-gray-400"
                }`}
            >
                <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        rule.met
                            ? "bg-green-100 dark:bg-green-500/15"
                            : "bg-gray-100 dark:bg-gray-800"
                    }`}
                >
                    {rule.met ? (
                        <Check size={13} strokeWidth={3} />
                    ) : (
                        <X size={12} strokeWidth={2.5} />
                    )}
                </span>
                {rule.label}
            </li>
        ))}
    </ul>
);

export default PasswordChecklist;
