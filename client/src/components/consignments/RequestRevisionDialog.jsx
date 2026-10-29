import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";
import RequestRevisionForm from "./RequestRevisionForm";

const RequestRevisionDialog = ({
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
                variant="warning"
                loading={loading}
                disabled={!isValid}
                onClick={handleSubmit}
            >
                Request Revision
            </Button>
        </>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Request Revision"
            size="lg"
            footer={footer}
        >
            <div className="space-y-6">
                <ConsignmentSummaryCard
                    consignment={
                        consignment
                    }
                />

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                            <TriangleAlert
                                size={18}
                            />
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                                Request revisions?
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">
                                Requesting revisions
                                returns this
                                application to the
                                applicant for
                                correction. Clearly
                                describe the required
                                changes so the
                                applicant can update
                                the submission before
                                it continues through
                                the review process.
                            </p>
                        </div>
                    </div>
                </div>

                <RequestRevisionForm
                    value={form}
                    onChange={setForm}
                    disabled={loading}
                />
            </div>
        </Modal>
    );
};

export default RequestRevisionDialog;
