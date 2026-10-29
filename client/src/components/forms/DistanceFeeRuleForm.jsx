import {
    useMemo,
    useState,
} from "react";

import Input from "../common/Input";
import Switch from "../common/Switch";
import Button from "../common/Button";

const EMPTY_FORM = {
    minDistanceKm: "",
    maxDistanceKm: "",
    pickupFee: "",
    returnFee: "",
    enabled: true,
};

const getInitialState = (rule, isEditMode) => {
    if (!isEditMode || !rule) {
        return { ...EMPTY_FORM };
    }

    return {
        minDistanceKm:
            rule.minDistanceKm ?? "",
        maxDistanceKm:
            rule.maxDistanceKm ?? "",
        pickupFee: rule.pickupFee ?? 0,
        returnFee: rule.returnFee ?? 0,
        enabled: rule.enabled ?? true,
    };
};

const DistanceFeeRuleForm = ({
    mode = "create",
    rule = null,
    loading = false,
    errors = null,
    onSubmit,
    onCancel,
}) => {
    const isEditMode = mode === "edit";
    const isViewMode = mode === "view";

    const [formData, setFormData] = useState(
        () => getInitialState(rule, isEditMode)
    );

    const validationErrors = useMemo(() => {
        if (!errors) {
            return {};
        }

        if (typeof errors === "string") {
            return {};
        }

        if (Array.isArray(errors)) {
            return errors.reduce(
                (acc, error) => {
                    if (
                        error?.path &&
                        error.msg
                    ) {
                        acc[error.path] =
                            error.msg;
                    }

                    return acc;
                },
                {}
            );
        }

        if (typeof errors === "object") {
            return { ...errors };
        }

        return {};
    }, [errors]);

    const handleChange = (event) => {
        const { name, value, type, checked } =
            event.target;

        setFormData((previous) => ({
            ...previous,
            [name]:
                type === "checkbox" ||
                type === "switch"
                    ? checked
                    : value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const payload = {
            minDistanceKm:
                formData.minDistanceKm !== ""
                    ? Number(formData.minDistanceKm)
                    : 0,
            maxDistanceKm:
                formData.maxDistanceKm !== ""
                    ? Number(formData.maxDistanceKm)
                    : 0,
            pickupFee:
                formData.pickupFee !== ""
                    ? Number(formData.pickupFee)
                    : 0,
            returnFee:
                formData.returnFee !== ""
                    ? Number(formData.returnFee)
                    : 0,
            enabled: formData.enabled,
        };

        onSubmit?.(payload);
    };

    const getFieldError = (fieldName) => {
        return validationErrors[fieldName] || null;
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-5"
        >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Input
                    label="Minimum Distance (km)"
                    name="minDistanceKm"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.minDistanceKm}
                    onChange={handleChange}
                    error={getFieldError(
                        "minDistanceKm"
                    )}
                    disabled={
                        loading || isViewMode
                    }
                    required
                    placeholder="0"
                />

                <Input
                    label="Maximum Distance (km)"
                    name="maxDistanceKm"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.maxDistanceKm}
                    onChange={handleChange}
                    error={getFieldError(
                        "maxDistanceKm"
                    )}
                    disabled={
                        loading || isViewMode
                    }
                    required
                    placeholder="10"
                />

                <Input
                    label="Pickup Fee"
                    name="pickupFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pickupFee}
                    onChange={handleChange}
                    error={getFieldError(
                        "pickupFee"
                    )}
                    disabled={
                        loading || isViewMode
                    }
                    placeholder="0.00"
                />

                <Input
                    label="Return Fee"
                    name="returnFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.returnFee}
                    onChange={handleChange}
                    error={getFieldError(
                        "returnFee"
                    )}
                    disabled={
                        loading || isViewMode
                    }
                    placeholder="0.00"
                />
            </div>

            <div className="flex flex-col gap-4 border-t border-gray-200 pt-5 dark:border-gray-700">
                <Switch
                    name="enabled"
                    label="Enabled"
                    helperText="Disabled rules will not be used for distance fee calculations."
                    checked={formData.enabled}
                    onChange={handleChange}
                    disabled={
                        loading || isViewMode
                    }
                />
            </div>

            {!isViewMode && (
                <div className="flex justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
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
                        {isEditMode
                            ? "Update Rule"
                            : "Create Rule"}
                    </Button>
                </div>
            )}

            {isViewMode && (
                <div className="flex justify-end border-t border-gray-200 pt-5 dark:border-gray-700">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                    >
                        Close
                    </Button>
                </div>
            )}
        </form>
    );
};

export default DistanceFeeRuleForm;
