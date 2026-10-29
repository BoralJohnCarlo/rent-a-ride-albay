import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheckBig } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";
import ApproveConsignmentForm from "./ApproveConsignmentForm";

const ApproveConsignmentDialog = ({
    open,
    consignment,
    loading = false,
    platformCommissionRate = null,
    onClose,
    onSubmit,
}) => {
    const [step, setStep] = useState(1);

    const stepTopRef = useScrollTopOnChange(step);

    /*
     * Per-approval choice, not a platform-wide setting: ON (default) uses
     * the platform's commission rate for this vehicle; OFF lets the admin
     * give this specific vehicle its own individually-negotiated rate.
     */
    const [useGlobalCommission, setUseGlobalCommission] =
        useState(true);

    const [form, setForm] = useState({
        remarks: "",
        commission: { mode: "", value: "" },
        pricing: { dailyRate: "", reservationFee: "" },
    });

    useEffect(() => {
        if (!open) {
            setStep(1);
            setUseGlobalCommission(true);

            setForm({
                remarks: "",
                commission: { mode: "", value: "" },
                pricing: { dailyRate: "", reservationFee: "" },
            });
        }
    }, [open]);

    const isValid = useMemo(() => {
        const dailyRate = Number(form.pricing?.dailyRate);
        const reservationFee = Number(form.pricing?.reservationFee);

        if (
            !Number.isFinite(dailyRate) ||
            dailyRate < 0 ||
            !Number.isFinite(reservationFee) ||
            reservationFee < 0
        ) {
            return false;
        }

        if (reservationFee > dailyRate) {
            return false;
        }

        if (!useGlobalCommission) {
            const mode = form.commission?.mode;
            const value = Number(form.commission?.value);

            if (!mode || !Number.isFinite(value) || value < 0) {
                return false;
            }

            if (mode === "PERCENTAGE" && value > 100) {
                return false;
            }
        }

        return true;
    }, [form, useGlobalCommission]);

    const handleSubmit = async () => {
        if (!isValid || loading) {
            return;
        }

        await onSubmit?.({
            remarks:
                form.remarks.trim(),
            pricing: {
                dailyRate: Number(form.pricing.dailyRate),
                reservationFee: Number(
                    form.pricing.reservationFee
                ),
            },
            ...(!useGlobalCommission
                ? {
                      commission: {
                          mode: form.commission.mode,
                          value: Number(
                              form.commission.value
                          ),
                      },
                  }
                : {}),
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
                    disabled={loading}
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
                    variant="success"
                    loading={loading}
                    disabled={!isValid}
                    onClick={
                        handleSubmit
                    }
                >
                    Approve
                </Button>
            </>
        );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Approve Consignment"
            size="lg"
            footer={footer}
        >
            <div ref={stepTopRef} className="space-y-6">
                <ConsignmentSummaryCard
                    consignment={
                        consignment
                    }
                />

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                            <CircleCheckBig
                                size={18}
                            />
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
                                Approve this application?
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
                                Approving this
                                consignment confirms
                                that the application
                                has successfully
                                completed the review
                                and inspection
                                process. Select the
                                agreement type, set
                                the vehicle's rental
                                pricing, and
                                optionally record any
                                approval remarks
                                before continuing.
                            </p>
                        </div>
                    </div>
                </div>

                <AnimatePresence
                    initial={false}
                >
                    {step === 2 && (
                        <motion.div
                            key="approve-form"
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
                            <ApproveConsignmentForm
                                value={form}
                                onChange={
                                    setForm
                                }
                                disabled={
                                    loading
                                }
                                useGlobalCommission={
                                    useGlobalCommission
                                }
                                onToggleGlobalCommission={
                                    setUseGlobalCommission
                                }
                                platformCommissionRate={
                                    platformCommissionRate
                                }
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Modal>
    );
};

export default ApproveConsignmentDialog;    