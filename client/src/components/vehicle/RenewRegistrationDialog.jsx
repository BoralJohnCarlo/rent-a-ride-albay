import { useEffect, useState } from "react";
import {
    AlertCircle,
    CalendarCheck,
    FileText,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";
import Input from "../common/Input";
import ImageUploadZone from "../shared/ImageUploadZone";
import SingleDatePicker from "./SingleDatePicker";

import useAuth from "../../hooks/auth/useAuth";
import useVehicle from "../../hooks/vehicles/useVehicle";
import useToast from "../../hooks/toast/useToast";

import { uploadVehicleImage } from "../../services/vehicleService";

const STEP_RENEW = 1;
const STEP_AVAILABILITY = 2;

const isExpirationInFuture = (vehicle) => {
    const expiration =
        vehicle?.compliance?.licenseExpiration;

    return (
        Boolean(expiration) &&
        new Date(expiration) > new Date()
    );
};

/*
 * Renewing a vehicle's registration is a 2-step flow: (1) replace the OR
 * image and set a new expiration date — subject to the operator's renewal
 * limit (Settings > Vehicle Registration), admin unrestricted — then (2)
 * pick when the vehicle becomes bookable again, now or a specific future
 * date. Step 1 deliberately doesn't flip the vehicle's status, so closing
 * the dialog after step 1 and reopening it later resumes at step 2.
 */
const RenewRegistrationDialog = ({
    open,
    vehicle,
    onClose,
    onSuccess,
}) => {
    const { user } = useAuth();
    const toast = useToast();

    const {
        renewVehicleRegistration,
        setVehicleRegistrationAvailability,
        getVehicleRegistrationRenewalEligibility,
        requestVehicleRegistrationRenewalAttempt,
        clearRegistrationRenewalEligibility,
        registrationRenewalEligibility,
    } = useVehicle();

    const isOperator =
        user?.role === "operator";

    const [step, setStep] = useState(STEP_RENEW);

    const stepTopRef = useScrollTopOnChange(step);
    const [officialReceiptImages, setOfficialReceiptImages] =
        useState([]);
    const [expirationDate, setExpirationDate] =
        useState("");
    const [availableFrom, setAvailableFrom] =
        useState(null);
    const [submitting, setSubmitting] =
        useState(false);
    const [requestingAttempt, setRequestingAttempt] =
        useState(false);

    useEffect(() => {
        if (!open || !vehicle) {
            return;
        }

        setOfficialReceiptImages([]);
        setExpirationDate("");
        setAvailableFrom(null);
        setSubmitting(false);

        const resumable =
            vehicle.status ===
                "RegistrationExpired" &&
            isExpirationInFuture(vehicle);

        setStep(
            resumable
                ? STEP_AVAILABILITY
                : STEP_RENEW
        );

        /*
         * registrationRenewalEligibility is a single global Redux slot,
         * not keyed by vehicle — clear it before fetching this vehicle's
         * numbers so a previous vehicle's eligibility never flashes here
         * while the new fetch is in flight.
         */
        clearRegistrationRenewalEligibility();

        if (isOperator) {
            getVehicleRegistrationRenewalEligibility(
                vehicle._id
            );
        }
    }, [
        open,
        vehicle,
        isOperator,
        getVehicleRegistrationRenewalEligibility,
        clearRegistrationRenewalEligibility,
    ]);

    const eligibility = isOperator
        ? registrationRenewalEligibility
        : null;

    const outOfAttempts =
        eligibility &&
        !eligibility.unlimited &&
        eligibility.remaining <= 0;

    const handleRequestAttempt = async () => {
        setRequestingAttempt(true);

        try {
            await requestVehicleRegistrationRenewalAttempt(
                vehicle._id
            ).unwrap();

            toast.success(
                "Renewal attempt request sent to admins."
            );

            await getVehicleRegistrationRenewalEligibility(
                vehicle._id
            );
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to request a renewal attempt."
            );
        } finally {
            setRequestingAttempt(false);
        }
    };

    const handleRenewSubmit = async () => {
        const pendingImage = officialReceiptImages[0];

        if (
            !pendingImage?.file &&
            !pendingImage?.url
        ) {
            toast.error(
                "Please upload a new Official Receipt (OR) image."
            );

            return;
        }

        if (!expirationDate) {
            toast.error(
                "Please set the new registration expiration date."
            );

            return;
        }

        setSubmitting(true);

        try {
            let officialReceipt = pendingImage;

            if (
                pendingImage.file &&
                !pendingImage.url
            ) {
                const result =
                    await uploadVehicleImage(
                        pendingImage.file
                    );

                const uploaded = result?.data;

                officialReceipt = {
                    url: uploaded?.url,
                    publicId: uploaded?.publicId,
                    originalName:
                        pendingImage.originalName,
                };
            }

            await renewVehicleRegistration(
                vehicle._id,
                officialReceipt,
                expirationDate
            ).unwrap();

            toast.success(
                "Registration renewed. Now set when the vehicle becomes available again."
            );

            setStep(STEP_AVAILABILITY);
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to renew vehicle registration."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleAvailabilitySubmit = async (
        chosenDate
    ) => {
        setSubmitting(true);

        try {
            await setVehicleRegistrationAvailability(
                vehicle._id,
                chosenDate
            ).unwrap();

            toast.success(
                "Vehicle is now available for booking."
            );

            onSuccess?.();
            onClose?.();
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to update vehicle availability."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const footer =
        step === STEP_RENEW ? (
            <>
                <Button
                    variant="secondary"
                    disabled={submitting}
                    onClick={onClose}
                >
                    Cancel
                </Button>

                {outOfAttempts ? (
                    <Button
                        loading={requestingAttempt}
                        disabled={requestingAttempt}
                        onClick={
                            handleRequestAttempt
                        }
                    >
                        Request Extra Attempt
                    </Button>
                ) : (
                    <Button
                        loading={submitting}
                        disabled={submitting}
                        onClick={handleRenewSubmit}
                    >
                        Renew Registration
                    </Button>
                )}
            </>
        ) : (
            <>
                <Button
                    variant="secondary"
                    disabled={submitting}
                    onClick={onClose}
                >
                    Cancel
                </Button>

                <Button
                    variant="secondary"
                    loading={submitting}
                    disabled={submitting}
                    onClick={() =>
                        handleAvailabilitySubmit(
                            null
                        )
                    }
                >
                    Make Available Now
                </Button>

                <Button
                    loading={submitting}
                    disabled={
                        submitting || !availableFrom
                    }
                    onClick={() =>
                        handleAvailabilitySubmit(
                            availableFrom
                        )
                    }
                >
                    Set Selected Date
                </Button>
            </>
        );

    if (!vehicle) {
        return null;
    }

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Renew Vehicle Registration"
            size="md"
            footer={footer}
        >
            <span ref={stepTopRef} hidden />

            {step === STEP_RENEW ? (
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <FileText size={16} />
                        <span>
                            Replace the Official
                            Receipt (OR) and set the
                            vehicle's new registration
                            expiration date.
                        </span>
                    </div>

                    <ImageUploadZone
                        title="Official Receipt (OR)"
                        helperText="Upload a clear photo of the renewed official receipt."
                        images={
                            officialReceiptImages
                        }
                        onChange={
                            setOfficialReceiptImages
                        }
                        maxFiles={1}
                        canSetPrimary={false}
                        disabled={submitting}
                    />

                    <Input
                        label="New Registration Expiration"
                        type="date"
                        value={expirationDate}
                        onChange={(event) =>
                            setExpirationDate(
                                event.target.value
                            )
                        }
                        disabled={submitting}
                        required
                    />

                    {isOperator &&
                        eligibility &&
                        !eligibility.unlimited && (
                            <div
                                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                                    outOfAttempts
                                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                                        : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                                }`}
                            >
                                <AlertCircle
                                    size={16}
                                    className="mt-0.5 shrink-0"
                                />

                                <span>
                                    {outOfAttempts
                                        ? `You've used all ${eligibility.maxRenewalsPerPeriod} renewal(s) for this period. Request an extra attempt from an admin below.`
                                        : `${eligibility.remaining} of ${eligibility.maxRenewalsPerPeriod} renewal(s) remaining this period.`}
                                </span>
                            </div>
                        )}
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <CalendarCheck size={16} />
                        <span>
                            Choose when {vehicle.vehicleCode}{" "}
                            becomes bookable again —
                            immediately, or starting a
                            specific date.
                        </span>
                    </div>

                    <SingleDatePicker
                        value={availableFrom}
                        onChange={setAvailableFrom}
                        disabled={submitting}
                    />
                </div>
            )}
        </Modal>
    );
};

export default RenewRegistrationDialog;
