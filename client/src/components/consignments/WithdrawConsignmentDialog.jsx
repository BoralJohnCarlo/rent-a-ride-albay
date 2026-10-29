import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";
import WithdrawConsignmentForm from "./WithdrawConsignmentForm";

const WithdrawConsignmentDialog = ({
    open,
    consignment,
    loading = false,
    onClose,
    onSubmit,
}) => {
    const [step, setStep] = useState(1);

    const stepTopRef = useScrollTopOnChange(step);

    const [form, setForm] = useState({
        remarks: "",
    });

    useEffect(() => {
        if (!open) {
            setStep(1);

            setForm({
                remarks: "",
            });
        }
    }, [open]);

    // The API requires withdrawal remarks to be 5-1000 characters.
    const isValid = useMemo(() => {
        return (
            form.remarks.trim().length >= 5
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

    const footer =
        step === 1 ? (
            <>
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                >
                    Cancel
                </Button>

                <Button
                    onClick={() =>
                        setStep(2)
                    }
                >
                    Continue
                </Button>
            </>
        ) : (
            <>
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                >
                    Cancel
                </Button>

                <Button
                    variant="secondary"
                    onClick={() =>
                        setStep(1)
                    }
                    disabled={loading}
                >
                    Back
                </Button>

                <Button
                    variant="danger"
                    loading={loading}
                    disabled={!isValid}
                    onClick={
                        handleSubmit
                    }
                >
                    Submit Withdrawal
                </Button>
            </>
        );

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Withdraw Consignment"
            size="lg"
            footer={footer}
        >
            <div ref={stepTopRef} className="space-y-6">
                <ConsignmentSummaryCard
                    consignment={
                        consignment
                    }
                />

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                            <AlertTriangle
                                size={18}
                            />
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                                Withdraw this application?
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">
                                Withdrawing this
                                consignment will stop
                                the review process and
                                mark the application
                                as withdrawn. Please
                                provide a brief
                                explanation before
                                confirming your
                                request.
                            </p>
                        </div>
                    </div>
                </div>

                <AnimatePresence
                    initial={false}
                >
                    {step === 2 && (
                        <motion.div
                            key="withdraw-form"
                            initial={{
                                opacity: 0,
                                height: 0,
                            }}
                            animate={{
                                opacity: 1,
                                height: "auto",
                            }}
                            exit={{
                                opacity: 0,
                                height: 0,
                            }}
                            transition={{
                                duration: 0.25,
                            }}
                            className="overflow-hidden"
                        >
                            <WithdrawConsignmentForm
                                value={form}
                                onChange={
                                    setForm
                                }
                                disabled={
                                    loading
                                }
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Modal>
    );
};

export default WithdrawConsignmentDialog;