import { Info } from "lucide-react";

import Textarea from "../common/Textarea";

const MAX_REMARKS_LENGTH = 500;

const WithdrawConsignmentForm = ({
    value = {},
    disabled = false,
    onChange,
}) => {
    const remarks =
        value.remarks ?? "";

    const handleRemarksChange = (
        event
    ) => {
        onChange?.({
            remarks:
                event.target.value.slice(
                    0,
                    MAX_REMARKS_LENGTH
                ),
        });
    };

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Withdrawal Remarks
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Provide a brief explanation for
                        withdrawing this consignment
                        application.
                    </p>
                </div>

                <Textarea
                    label="Remarks"
                    value={remarks}
                    onChange={
                        handleRemarksChange
                    }
                    rows={5}
                    maxLength={
                        MAX_REMARKS_LENGTH
                    }
                    disabled={disabled}
                    required
                    placeholder="Enter your withdrawal remarks..."
                />

                <div className="mt-2 flex justify-end">
                    <span className="text-sm text-gray-500">
                        {remarks.length} /{" "}
                        {MAX_REMARKS_LENGTH}
                    </span>
                </div>
            </section>

            <section className="rounded-xl border border-blue-100 bg-blue-50 p-6">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-blue-100 p-2 text-blue-600">
                        <Info size={18} />
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-blue-900">
                            What happens next?
                        </h3>

                        <ul className="mt-3 space-y-2 text-sm text-blue-800">
                            <li>
                                • This application
                                will be marked as
                                Withdrawn.
                            </li>

                            <li>
                                • The review process
                                will stop immediately.
                            </li>

                            <li>
                                • A new consignment
                                application may be
                                submitted in the
                                future if needed.
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default WithdrawConsignmentForm;