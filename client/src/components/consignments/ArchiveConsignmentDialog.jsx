import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";
import ArchiveConsignmentForm from "./ArchiveConsignmentForm";

const ArchiveConsignmentDialog = ({
    open,
    mode = "archive",
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

    const isValid = useMemo(() => {
    if (mode === "restore") {
        return true;
    }

    return (
        form.remarks.trim().length > 0
    );
}, [form, mode]);

    const handleSubmit = async () => {
    if (!isValid || loading) {
        return;
    }

    if (mode === "restore") {
        await onSubmit?.();
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
                    variant="secondary"
                    loading={loading}
                    disabled={!isValid}
                    onClick={handleSubmit}
                >
                    {mode === "restore"
                ? "Restore"
                : "Archive"}
                </Button>
            </>
        );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={
                mode === "restore"
                ? "Restore Consignment"
                : "Archive Consignment"
            }
            size="lg"
            footer={footer}
        >
            <div ref={stepTopRef} className="space-y-6">
                <ConsignmentSummaryCard
                    consignment={
                        consignment
                    }
                />

                <div className="rounded-xl border border-gray-300 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-800/40">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-gray-200 p-2 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            <Archive
                                size={18}
                            />
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Archive this
                                consignment?
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                Archiving this
                                consignment removes
                                it from the active
                                list while preserving
                                all records for future
                                reference. The
                                consignment can be
                                restored later if
                                necessary.
                            </p>
                        </div>
                    </div>
                </div>

                <AnimatePresence
                    initial={false}
                >
                    {step === 2 && (
                        <motion.div
                            key="archive-form"
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
                            <ArchiveConsignmentForm
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

export default ArchiveConsignmentDialog;