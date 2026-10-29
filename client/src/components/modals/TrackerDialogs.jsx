import { useEffect, useState } from "react";

import Modal from "../common/Modal";
import TrackerForm from "../forms/TrackerForm";

import useToast from "../../hooks/toast/useToast";
import useTracker from "../../hooks/trackers";

const TrackerDialogs = ({
    open = false,
    mode = "create",
    tracker = null,
    vehicles = [],
    trackers = [],
    onClose,
    onRegistered,
}) => {
    const toast = useToast();

    const { loading, registerTracker, updateTracker } = useTracker();

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setSubmitting(false);
        }
    }, [open]);

    const handleSubmit = async (formData) => {
        setSubmitting(true);

        try {
            if (mode === "create") {
                const result = await registerTracker(
                    formData
                ).unwrap();

                toast.success("Tracker registered successfully.");
                onClose?.();
                onRegistered?.(result?.data);
            } else {
                await updateTracker(
                    tracker._id,
                    formData
                ).unwrap();

                toast.success("Tracker updated successfully.");
                onClose?.();
            }
        } catch (error) {
            toast.error(error || "Unable to save tracker.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={
                mode === "create"
                    ? "Register Tracker"
                    : "Edit Tracker"
            }
        >
            <TrackerForm
                mode={mode}
                tracker={tracker}
                vehicles={vehicles}
                trackers={trackers}
                loading={loading || submitting}
                onSubmit={handleSubmit}
                onCancel={onClose}
            />
        </Modal>
    );
};

export default TrackerDialogs;
