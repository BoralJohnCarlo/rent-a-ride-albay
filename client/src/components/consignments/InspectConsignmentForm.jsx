import { useState } from "react";

import Button from "../common/Button";
import Textarea from "../common/Textarea";
import RadioGroup from "../common/RadioGroup";

const INSPECTION_OPTIONS = [
    {
        label: "Passed",
        value: "Passed",
    },
    {
        label: "Conditional Pass",
        value: "Conditional Pass",
    },
    {
        label: "Failed",
        value: "Failed",
    },
];

const InspectConsignmentForm = ({
    loading = false,
    onCancel,
    onSubmit,
}) => {
    const [formData, setFormData] =
        useState({
            status: "Passed",
            remarks: "",
        });

    const handleStatusChange = (
        status
    ) => {
        setFormData((previous) => ({
            ...previous,
            status,
        }));
    };

    const handleRemarksChange = (
        event
    ) => {
        setFormData((previous) => ({
            ...previous,
            remarks:
                event.target.value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        onSubmit?.({
            status: formData.status,
            remarks:
                formData.remarks.trim(),
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6"
        >
            <RadioGroup
                label="Inspection Result"
                value={formData.status}
                options={
                    INSPECTION_OPTIONS
                }
                onChange={
                    handleStatusChange
                }
                disabled={loading}
            />

            <Textarea
                label="Inspection Remarks"
                value={formData.remarks}
                onChange={
                    handleRemarksChange
                }
                rows={5}
                disabled={loading}
                placeholder="Enter inspection remarks..."
            />

            <div className="flex justify-end gap-3">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>

                <Button
                    type="submit"
                    loading={loading}
                >
                    Complete Inspection
                </Button>
            </div>
        </form>
    );
};

export default InspectConsignmentForm;