import { useEffect, useMemo, useState } from "react";

import Input from "../common/Input";
import Select from "../common/Select";
import Textarea from "../common/Textarea";
import Button from "../common/Button";

import { VEHICLE_STATUS } from "../../constants/vehicleConstants";
import {
    TRACKER_PROTOCOL,
    TRACKER_PROTOCOL_OPTIONS,
    TRACKER_PROTOCOL_LABELS,
    getTrackerProtocol,
} from "../../constants/trackerConstants";

const NOTES_MAX_LENGTH = 500;

const initialFormData = {
    imei: "",
    model: "",
    protocol: TRACKER_PROTOCOL.HTTP_SIMULATOR,
    simNumber: "",
    notes: "",
    vehicle: "",
};

const vehicleOptionLabel = (vehicle) => {
    const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
    const label = name || vehicle.vehicleCode || "Vehicle";

    return vehicle.plateNumber ? `${label} (${vehicle.plateNumber})` : label;
};

// Fields mirror the backend validators: create accepts imei/protocol/
// model/simNumber/notes/vehicle; edit accepts model/simNumber/notes only.
// Device ID and protocol are fixed after registration, and status is never
// edited here - it follows assign/unassign/enable/disable.
const TrackerForm = ({
    mode = "create",
    tracker = null,
    vehicles = [],
    trackers = [],
    loading = false,
    onSubmit,
    onCancel,
}) => {
    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        if (mode === "edit" && tracker) {
            setFormData({
                model: tracker.model || "",
                simNumber: tracker.simNumber || "",
                notes: tracker.notes || "",
            });
        } else {
            setFormData(initialFormData);
        }
    }, [mode, tracker]);

    // Optional assignment at registration: only vehicles that can take a
    // tracker (not archived, no tracker yet) - the backend re-checks both.
    const vehicleOptions = useMemo(() => {
        const assignedVehicleIds = new Set(
            trackers
                .filter((item) => item.vehicle)
                .map((item) => String(item.vehicle))
        );

        return [
            { value: "", label: "No vehicle (assign later)" },
            ...vehicles
                .filter(
                    (vehicle) =>
                        vehicle.status !== VEHICLE_STATUS.ARCHIVED &&
                        !assignedVehicleIds.has(vehicle._id)
                )
                .map((vehicle) => ({
                    value: vehicle._id,
                    label: vehicleOptionLabel(vehicle),
                })),
        ];
    }, [vehicles, trackers]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (mode === "create") {
            const payload = { ...formData };

            if (!payload.vehicle) {
                delete payload.vehicle;
            }

            onSubmit?.(payload);
            return;
        }

        onSubmit?.(formData);
    };

    const descriptiveFields = (
        <>
            <Input
                label="Model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="e.g. GPS Tracker 2G+4G LTE"
                helperText="The device model as printed on the tracker (optional)."
            />

            <Input
                label="SIM Number"
                name="simNumber"
                value={formData.simNumber}
                onChange={handleChange}
                placeholder="e.g. 0917 123 4567"
                helperText="The number of the SIM inside the tracker, used to configure it by SMS (optional)."
            />

            <Textarea
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                maxLength={NOTES_MAX_LENGTH}
                placeholder="e.g. Installed under the seat, powered from the 12V battery"
                helperText={`Optional, up to ${NOTES_MAX_LENGTH} characters.`}
            />
        </>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {mode === "create" ? (
                <>
                    <Input
                        label="Device ID / IMEI"
                        name="imei"
                        value={formData.imei}
                        onChange={handleChange}
                        placeholder="e.g. 356938035643809"
                        helperText="The identity the device reports (5-32 characters). Not necessarily a 15-digit IMEI."
                        required
                    />

                    <Select
                        label="Protocol"
                        name="protocol"
                        value={formData.protocol}
                        options={TRACKER_PROTOCOL_OPTIONS}
                        onChange={handleChange}
                        helperText="Simulator trackers get a device key for the mock simulator. AIKA Cloud trackers are polled from the AIKA platform - use the device's AIKA Device ID."
                    />

                    {descriptiveFields}

                    <Select
                        label="Vehicle"
                        name="vehicle"
                        value={formData.vehicle}
                        options={vehicleOptions}
                        onChange={handleChange}
                        helperText="Optional - you can also assign a vehicle later."
                    />
                </>
            ) : (
                <>
                    <Input
                        label="Device ID / IMEI"
                        name="imei"
                        value={tracker?.imei || ""}
                        disabled
                        helperText="The Device ID cannot be changed after registration."
                    />

                    <Input
                        label="Protocol"
                        name="protocol"
                        value={
                            TRACKER_PROTOCOL_LABELS[getTrackerProtocol(tracker)] ||
                            getTrackerProtocol(tracker)
                        }
                        disabled
                        helperText="The protocol cannot be changed after registration."
                    />

                    {descriptiveFields}
                </>
            )}

            <div className="flex justify-end gap-4 pt-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>

                <Button type="submit" loading={loading} disabled={loading}>
                    {mode === "edit"
                        ? "Update Tracker"
                        : "Register Tracker"}
                </Button>
            </div>
        </form>
    );
};

export default TrackerForm;
