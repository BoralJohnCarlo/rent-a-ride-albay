import {
    useState,
} from "react";

const BookingAgreements = ({
    checked,
    onChange,
    error,
}) => {
    const [agreed, setAgreed] = useState(checked || false);

    const handleChange = (event) => {
        const newValue = event.target.checked;
        setAgreed(newValue);
        onChange?.(newValue);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Terms and Agreements
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Please review and accept the terms before proceeding.
                </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-start gap-4">
                    <div className="flex h-5 shrink-0 items-center">
                        <input
                            type="checkbox"
                            id="terms-agreement"
                            name="terms-agreement"
                            checked={agreed}
                            onChange={handleChange}
                            className="
                                h-5
                                w-5
                                rounded
                                border-gray-300
                                text-yellow-500
                                focus:ring-yellow-500
                                dark:border-gray-600
                                dark:bg-gray-800
                            "
                        />
                    </div>

                    <div className="flex-1">
                        <label
                            htmlFor="terms-agreement"
                            className="
                                cursor-pointer
                                text-sm
                                font-medium
                                text-gray-900
                                dark:text-white
                            "
                        >
                            I have read and agree to the Terms and Conditions
                        </label>

                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            placeholder
                        </p>
                    </div>
                </div>

                {error && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                    By proceeding with this booking, you acknowledge that you
                    have read, understood, and agree to be bound by our
                    terms and conditions.
                </p>
            </div>
        </div>
    );
};

export default BookingAgreements;
