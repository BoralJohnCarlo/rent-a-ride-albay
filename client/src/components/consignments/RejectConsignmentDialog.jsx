import { useEffect, useMemo, useState } from "react";
import { CircleX } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";
import RejectConsignmentForm from "./RejectConsignmentForm";

const RejectConsignmentDialog = ({
    open,
    consignment,
    loading = false,
    onClose,
    onSubmit,
}) => {
    const [form, setForm] = useState({
        remarks: "",
    });

    useEffect(() => {
        if (!open) {
            setForm({
                remarks: "",
            });
        }
    }, [open]);

    const isValid = useMemo(() => {
        return (
            form.remarks.trim().length > 0
        );
    }, [form]);

    const handleSubmit = async () => {
        if (!isValid || loading) {
            return;
        }

        await onSubmit?.({
            remarks:
                form.remarks.trim(),
        });
    };

    const footer = (
        <>
            <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
            >
                Cancel
            </Button>

            <Button
                variant="danger"
                loading={loading}
                disabled={!isValid}
                onClick={handleSubmit}
            >
                Reject
            </Button>
        </>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Reject Consignment"
            size="lg"
            footer={footer}
        >
            <div className="space-y-6">
                <ConsignmentSummaryCard
                    consignment={
                        consignment
                    }
                />

                <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/30">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                            <CircleX
                                size={18}
                            />
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-red-900 dark:text-red-200">
                                Reject this
                                application?
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-300">
                                Rejecting
                                this
                                consignment
                                permanently
                                ends the
                                current
                                application
                                process.
                                Please
                                provide the
                                reason for
                                rejection
                                before
                                confirming.
                                The
                                applicant
                                may submit
                                a new
                                application
                                in the
                                future if
                                they wish
                                to proceed.
                            </p>
                        </div>
                    </div>
                </div>

                <RejectConsignmentForm
                    value={form}
                    onChange={setForm}
                    disabled={loading}
                />
            </div>
        </Modal>
    );
};

export default RejectConsignmentDialog;
