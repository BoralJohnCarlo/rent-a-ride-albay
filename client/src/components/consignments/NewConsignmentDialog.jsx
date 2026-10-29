import {
    useEffect,
    useState,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    Car,
    FileText,
    Image as ImageIcon,
    Calendar,
    Gavel,
} from "lucide-react";

import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";

import NewConsignmentForm from "./NewConsignmentForm";
import NewConsignmentDocumentsForm from "./NewConsignmentDocumentsForm";
import NewConsignmentMediaForm from "./NewConsignmentMediaForm";
import InspectionAppointmentCalendar from "./InspectionAppointmentCalendar";
import ConsignmentTermsAgreement from "./ConsignmentTermsAgreement";
import { isTermsOutdatedError } from "../../constants/legalDocuments";

import validateConsignmentForm, {
    validateVehicleInfoStep,
    validateDocumentsStep,
    validateMediaStep,
} from "../../utils/validateConsignmentForm";

import useConsignments from "../../hooks/consignments/useConsignments";
import useToast from "../../hooks/toast/useToast";

import { uploadVehicleImage } from "../../services/vehicleService";

import { VEHICLE_OWNERSHIP } from "../../constants/vehicleConstants";

/*
 * The applicant is whichever operator is logged in — their profile is
 * already on file from registration, so this form only asks about the
 * vehicle being submitted for consignment (same scope as the "Vehicle
 * Information" step of operator registration).
 */
const INITIAL_FORM = {
    snapshots: {
        vehicle: {
            plateNumber: "",
            registrationNumber: "",

            compliance: {
                licenseExpiration: "",
            },

            brand: "",
            model: "",
            variant: "",
            year: "",

            vehicleType: "",
            category: "",
            /*
             * Always "Consignment" for anything created through this wizard
             * — never a field the operator picks — but validateVehicle()
             * (shared with the generic form validator) requires it
             * non-empty. Previously this stayed "" until right before the
             * final submit forced it, so handleNext's step-1 validation
             * always failed on a field the UI never shows, silently
             * blocking every new application at "Vehicle Information" with
             * no visible error. Setting it correctly from the start avoids
             * that entirely.
             */
            ownership: VEHICLE_OWNERSHIP.CONSIGNMENT,

            specifications: {
                transmission: "",
                fuelType: "",
                seatingCapacity: "",
            },

            description: {
                public: "",
                internal: "",
            },

            documents: {
                officialReceipt: null,
                certificateOfRegistration: null,
            },

            images: [],
        },
    },
};

/*
 * A consignment created before the Documents step existed won't have a
 * `documents` object at all — without this, handleNestedChange's path walk
 * would try to write onto `undefined` and throw the moment the operator
 * touches an OR/CR upload while editing an old draft.
 */
const normalizeForm = (source) => {
    const cloned = structuredClone(
        source ?? INITIAL_FORM
    );

    if (!cloned.snapshots.vehicle.documents) {
        cloned.snapshots.vehicle.documents =
            structuredClone(
                INITIAL_FORM.snapshots.vehicle
                    .documents
            );
    }

    return cloned;
};

const STEP_VEHICLE = 0;
const STEP_DOCUMENTS = 1;
const STEP_MEDIA = 2;
const STEP_APPOINTMENT = 3;
const STEP_TERMS = 4;

const STEPS = [
    {
        label: "Vehicle Information",
        description:
            "Basic details about the vehicle being submitted for consignment.",
        icon: Car,
    },
    {
        label: "Documents",
        description:
            "Plate/registration numbers and photos of the Official Receipt and Certificate of Registration.",
        icon: FileText,
    },
    {
        label: "Photos & Description",
        description:
            "Upload clear photos and describe the vehicle for customers.",
        icon: ImageIcon,
    },
    {
        label: "Inspection Appointment",
        description:
            "Select a date and time for us to discuss partnership terms and commission rates, and to inspect and set up your vehicle.",
        icon: Calendar,
    },
    {
        label: "Terms & Agreement",
        description:
            "Review and agree to the Partner/Consignment Terms before submitting.",
        icon: Gavel,
    },
];

/*
 * Matches the slide/fade step transition used by VehicleForm.jsx and the
 * operator registration wizard, so this dialog feels consistent with the
 * app's other multi-step forms.
 */
const STEP_VARIANTS = {
    initial: {
        opacity: 0,
        x: 20,
    },
    animate: {
        opacity: 1,
        x: 0,
    },
    exit: {
        opacity: 0,
        x: -20,
    },
};

const STEP_TRANSITION = {
    duration: 0.2,
    ease: "easeOut",
};

const buildAppointmentValue = (consignment) => {
    const scheduledDate =
        consignment?.application?.inspection?.scheduledDate;

    const scheduledTime =
        consignment?.application?.inspection?.scheduledTime;

    return scheduledDate && scheduledTime
        ? `${scheduledDate}T${scheduledTime}:00`
        : "";
};

const NewConsignmentDialog = ({
    open,
    onClose,
    onSuccess,
    mode = "create",
    consignment = null,
}) => {
    const [form, setForm] = useState(() =>
        normalizeForm(null)
    );

    const [errors, setErrors] =
        useState({});

    const [imageUploading, setImageUploading] =
        useState(false);

    const [currentStep, setCurrentStep] =
        useState(STEP_VEHICLE);

    const stepTopRef =
        useScrollTopOnChange(currentStep);

    const [appointmentValue, setAppointmentValue] =
        useState("");

    const [termsAgreed, setTermsAgreed] =
        useState(false);

    // The Partner Terms version shown on the Terms step (sent on submit),
    // and a counter that makes that step fetch the newest one.
    const [termsVersionId, setTermsVersionId] =
        useState(null);
    const [termsReloadKey, setTermsReloadKey] =
        useState(0);

    /*
     * The draft a new application created before its submit failed (e.g.
     * the terms changed meanwhile), so trying again updates it instead of
     * leaving a second draft behind.
     */
    const [createdDraftId, setCreatedDraftId] =
        useState(null);

    const {
    createConsignment,
    updateDraftConsignment,
    submitConsignment,
    bookInspectionAppointment,
    loading,
} = useConsignments();

    const toast = useToast();

    const isEditMode = mode === "edit";

    const resetForm = () => {
        setForm(normalizeForm(null));

        setErrors({});
        setCurrentStep(STEP_VEHICLE);
        setAppointmentValue("");
        setTermsAgreed(false);
        setCreatedDraftId(null);
    };

    const handleClose = () => {
    if (loading || imageUploading) {
        return;
    }

    resetForm();

    onClose?.();
};

useEffect(() => {
    if (!open) {
        return;
    }

    if (isEditMode && consignment) {
        setForm(normalizeForm(consignment));
        setErrors({});
        setCurrentStep(STEP_VEHICLE);
        setAppointmentValue(
            buildAppointmentValue(consignment)
        );
        setTermsAgreed(false);
        return;
    }

    resetForm();
}, [
    open,
    isEditMode,
    consignment,
]);

const handleNestedChange = (
    path,
    value
) => {
    setForm((previous) => {
        const updated =
            structuredClone(previous);

        const keys = path.split(".");

        let current = updated;

        for (
            let index = 0;
            index < keys.length - 1;
            index++
        ) {
            current =
                current[keys[index]];
        }

        current[keys[keys.length - 1]] =
            value;

        return updated;
    });

    setErrors((previous) => {
        if (!(path in previous)) {
            return previous;
        }

        const updated = {
            ...previous,
        };

        delete updated[path];

        return updated;
    });
};

const handleImagesChange = (images) => {
    setForm((previous) => ({
        ...previous,
        snapshots: {
            ...previous.snapshots,
            vehicle: {
                ...previous.snapshots.vehicle,
                images,
            },
        },
    }));

    setErrors((previous) => {
        if (!("snapshots.vehicle.images" in previous)) {
            return previous;
        }

        const updated = { ...previous };
        delete updated["snapshots.vehicle.images"];
        return updated;
    });
};

const handleAppointmentChange = (value) => {
    setAppointmentValue(value);

    setErrors((previous) => {
        if (!("appointment" in previous)) {
            return previous;
        }

        const updated = { ...previous };
        delete updated.appointment;
        return updated;
    });
};

const handleTermsChange = (checked) => {
    setTermsAgreed(checked);

    setErrors((previous) => {
        if (!("terms" in previous)) {
            return previous;
        }

        const updated = { ...previous };
        delete updated.terms;
        return updated;
    });
};

/*
 * Uploads a single pending image (one with a local `file` and no `url`
 * yet) to Cloudinary and returns the resolved {url, publicId, ...} shape.
 * Anything already uploaded (has a url/publicId) or with nothing selected
 * passes through untouched. Shared by both the vehicle-images array and
 * the single-image OR/CR document slots below.
 */
const uploadImageIfPending = async (image) => {
    if (
        !image?.file ||
        image?.url ||
        image?.publicId
    ) {
        return image;
    }

    const result = await uploadVehicleImage(
        image.file
    );

    const uploaded = result?.data;

    return {
        url: uploaded?.url || "",
        publicId: uploaded?.publicId || "",
        originalName: image.originalName || "",
        isPrimary: image.isPrimary ?? false,
    };
};

/*
 * ImageUploadZone only attaches a local blob (`file`/`preview`) to newly
 * picked images — nothing actually reaches Cloudinary until here, right
 * before validation/submission, mirroring VehicleForm.jsx's pattern. Images
 * that already have a `url` (loaded from an existing draft) pass through
 * untouched.
 */
const uploadPendingVehicleImages = async (
    images
) => {
    const hasPending = images.some(
        (image) => image?.file && !image?.url
    );

    if (!hasPending) {
        return images;
    }

    setImageUploading(true);

    try {
        const processed = await Promise.all(
            images.map(uploadImageIfPending)
        );

        setForm((previous) => ({
            ...previous,
            snapshots: {
                ...previous.snapshots,
                vehicle: {
                    ...previous.snapshots.vehicle,
                    images: processed,
                },
            },
        }));

        return processed;
    } finally {
        setImageUploading(false);
    }
};

const uploadPendingDocuments = async (
    documents
) => {
    const officialReceipt =
        documents?.officialReceipt;

    const certificateOfRegistration =
        documents?.certificateOfRegistration;

    const hasPending =
        (officialReceipt?.file &&
            !officialReceipt?.url) ||
        (certificateOfRegistration?.file &&
            !certificateOfRegistration?.url);

    if (!hasPending) {
        return documents;
    }

    setImageUploading(true);

    try {
        const [
            processedOfficialReceipt,
            processedCertificateOfRegistration,
        ] = await Promise.all([
            uploadImageIfPending(
                officialReceipt
            ),
            uploadImageIfPending(
                certificateOfRegistration
            ),
        ]);

        const processed = {
            officialReceipt:
                processedOfficialReceipt,
            certificateOfRegistration:
                processedCertificateOfRegistration,
        };

        setForm((previous) => ({
            ...previous,
            snapshots: {
                ...previous.snapshots,
                vehicle: {
                    ...previous.snapshots.vehicle,
                    documents: processed,
                },
            },
        }));

        return processed;
    } finally {
        setImageUploading(false);
    }
};

const validatePayload = (overrides = {}) => {
    if (loading) {
        return null;
    }

    const payload =
        structuredClone(form);

    payload.snapshots.vehicle.ownership =
        VEHICLE_OWNERSHIP.CONSIGNMENT;

    payload.snapshots.vehicle.category =
        payload.snapshots.vehicle.category || null;

    if (overrides.images) {
        payload.snapshots.vehicle.images =
            overrides.images;
    }

    if (overrides.documents) {
        payload.snapshots.vehicle.documents =
            overrides.documents;
    }

    const {
        isValid,
        errors,
    } = validateConsignmentForm(
        payload
    );

    if (!isValid) {
        setErrors(errors);
        return null;
    }

    return payload;
};

// Only reachable in edit mode — a new consignment can no longer be saved
// as a draft, only submitted directly (see the footer below). Drafts never
// have an appointment booked yet (that requires the consignment to already
// be submitted), so this step is intentionally unaffected by whichever wizard
// step the operator happens to be on, and always runs the full validator.
const handleSaveDraft = async () => {
    let images;
    let documents;

    try {
        images = await uploadPendingVehicleImages(
            form.snapshots.vehicle.images
        );

        documents = await uploadPendingDocuments(
            form.snapshots.vehicle.documents
        );
    } catch (error) {
        toast.error(
            error?.response?.data?.message ||
                error?.message ||
                "Unable to upload one or more images. Please try again."
        );

        return;
    }

    const payload = validatePayload({
        images,
        documents,
    });

    if (!payload) {
        setCurrentStep(STEP_VEHICLE);
        return;
    }

    if (!consignment?._id) {
        toast.error(
            "Consignment draft not found."
        );

        return;
    }

    try {
        await updateDraftConsignment({
            id: consignment._id,
            payload,
        }).unwrap();

        toast.success(
            "Consignment draft updated successfully."
        );

        onSuccess?.();

        handleClose();
    } catch (error) {
        toast.error(
            error?.message ??
                "Unable to update consignment draft."
        );
    }
};

/*
 * Advances the wizard one step, validating only the fields the step that's
 * being left actually collects — vehicle info doesn't need photos/
 * description filled in yet, and vice versa. The full form gets validated
 * again as a safety net right before the final submit.
 */
const handleNext = async () => {
    if (currentStep === STEP_VEHICLE) {
        const { isValid, errors: stepErrors } =
            validateVehicleInfoStep(form);

        if (!isValid) {
            setErrors(stepErrors);
            return;
        }

        setErrors({});
        setCurrentStep(STEP_DOCUMENTS);
        return;
    }

    if (currentStep === STEP_DOCUMENTS) {
        let documents;

        try {
            documents =
                await uploadPendingDocuments(
                    form.snapshots.vehicle
                        .documents
                );
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    "Unable to upload one or more images. Please try again."
            );

            return;
        }

        const documentsForm = {
            ...form,
            snapshots: {
                ...form.snapshots,
                vehicle: {
                    ...form.snapshots.vehicle,
                    documents,
                },
            },
        };

        const { isValid, errors: stepErrors } =
            validateDocumentsStep(documentsForm);

        if (!isValid) {
            setErrors(stepErrors);
            return;
        }

        setErrors({});
        setCurrentStep(STEP_MEDIA);
        return;
    }

    if (currentStep === STEP_MEDIA) {
        let images;

        try {
            images =
                await uploadPendingVehicleImages(
                    form.snapshots.vehicle.images
                );
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    "Unable to upload one or more images. Please try again."
            );

            return;
        }

        const mediaForm = {
            ...form,
            snapshots: {
                ...form.snapshots,
                vehicle: {
                    ...form.snapshots.vehicle,
                    images,
                },
            },
        };

        const { isValid, errors: stepErrors } =
            validateMediaStep(mediaForm);

        if (!isValid) {
            setErrors(stepErrors);
            return;
        }

        setErrors({});
        setCurrentStep(STEP_APPOINTMENT);
        return;
    }

    if (currentStep === STEP_APPOINTMENT) {
        if (!appointmentValue) {
            setErrors((previous) => ({
                ...previous,
                appointment:
                    "Please select an inspection appointment date and time.",
            }));

            return;
        }

        setErrors((previous) => {
            if (!("appointment" in previous)) {
                return previous;
            }

            const updated = { ...previous };
            delete updated.appointment;
            return updated;
        });

        setCurrentStep(STEP_TERMS);
    }
};

const handleBack = () => {
    setCurrentStep((previous) =>
        Math.max(STEP_VEHICLE, previous - 1)
    );
};

const handleSubmitApplication = async () => {
    if (!appointmentValue) {
        setErrors((previous) => ({
            ...previous,
            appointment:
                "Please select an inspection appointment date and time.",
        }));

        setCurrentStep(STEP_APPOINTMENT);

        return;
    }

    if (!termsAgreed) {
        setErrors((previous) => ({
            ...previous,
            terms:
                "Please agree to the Partner/Consignment Terms before submitting.",
        }));

        setCurrentStep(STEP_TERMS);

        return;
    }

    let images;
    let documents;

    try {
        images = await uploadPendingVehicleImages(
            form.snapshots.vehicle.images
        );

        documents = await uploadPendingDocuments(
            form.snapshots.vehicle.documents
        );
    } catch (error) {
        toast.error(
            error?.response?.data?.message ||
                error?.message ||
                "Unable to upload one or more images. Please try again."
        );

        setCurrentStep(STEP_MEDIA);

        return;
    }

    const fullPayload = structuredClone(form);

    fullPayload.snapshots.vehicle.ownership =
        VEHICLE_OWNERSHIP.CONSIGNMENT;

    fullPayload.snapshots.vehicle.category =
        fullPayload.snapshots.vehicle.category ||
        null;

    fullPayload.snapshots.vehicle.images = images;
    fullPayload.snapshots.vehicle.documents =
        documents;

    const {
        isValid: isFullyValid,
        errors: fullErrors,
    } = validateConsignmentForm(fullPayload);

    if (!isFullyValid) {
        setErrors(fullErrors);

        const documentsInvalid =
            fullErrors[
                "snapshots.vehicle.plateNumber"
            ] ||
            fullErrors[
                "snapshots.vehicle.registrationNumber"
            ] ||
            fullErrors[
                "snapshots.vehicle.documents.officialReceipt"
            ] ||
            fullErrors[
                "snapshots.vehicle.documents.certificateOfRegistration"
            ];

        const mediaInvalid =
            fullErrors[
                "snapshots.vehicle.images"
            ] ||
            fullErrors[
                "snapshots.vehicle.description.public"
            ] ||
            fullErrors[
                "snapshots.vehicle.description.internal"
            ];

        setCurrentStep(
            documentsInvalid
                ? STEP_DOCUMENTS
                : mediaInvalid
                  ? STEP_MEDIA
                  : STEP_VEHICLE
        );

        return;
    }

    const payload = fullPayload;

    let consignmentId;

    try {
        if (isEditMode) {
            if (!consignment?._id) {
                toast.error(
                    "Consignment draft not found."
                );

                return;
            }

            await updateDraftConsignment({
                id: consignment._id,
                payload,
            }).unwrap();

            consignmentId =
                consignment._id;
        } else if (createdDraftId) {
            await updateDraftConsignment({
                id: createdDraftId,
                payload,
            }).unwrap();

            consignmentId = createdDraftId;
        } else {
            const response =
                await createConsignment(
                    payload
                ).unwrap();

            consignmentId =
                response?.data?._id;

            setCreatedDraftId(
                consignmentId ?? null
            );
        }

        if (!consignmentId) {
            throw new Error(
                "Unable to determine consignment ID."
            );
        }

        await submitConsignment({
            id: consignmentId,
            data: {
                termsAgreed: true,
                termsVersionId,
            },
        }).unwrap();
    } catch (error) {
        // The terms changed since they were shown: show the new version.
        if (isTermsOutdatedError(error?.message)) {
            setTermsAgreed(false);
            setTermsReloadKey((key) => key + 1);
            setErrors((previous) => ({
                ...previous,
                terms: error.message,
            }));
            setCurrentStep(STEP_TERMS);
        }

        toast.error(
            error?.message ??
                "Unable to submit consignment application."
        );

        return;
    }

    /*
     * The appointment can only be booked once the consignment is actually
     * Pending/Under Review (see bookInspectionAppointment's server-side
     * status gate), so this always runs as a follow-up call after the
     * submit above succeeds — never bundled into the same request. If this
     * one step fails (e.g. the slot filled up in the meantime), the
     * application itself is still successfully submitted; the operator can
     * book/reschedule the appointment afterward from their consignments
     * list, so we surface a warning rather than treating it as a full
     * failure.
     */
    const [date, timePart] =
        appointmentValue.split("T");

    const time = timePart
        ? timePart.slice(0, 5)
        : "";

    try {
        await bookInspectionAppointment({
            consignmentId,
            data: {
                date,
                time,
            },
        }).unwrap();

        toast.success(
            "Consignment application submitted and inspection appointment booked."
        );
    } catch (error) {
        toast.warning(
            error?.message ||
                "Your application was submitted, but the inspection appointment couldn't be booked. You can book it from your consignments list."
        );
    }

    onSuccess?.();

    handleClose();
};

    const footer =
        currentStep === STEP_TERMS ? (
            <>
                <Button
                    variant="secondary"
                    disabled={
                        loading || imageUploading
                    }
                    onClick={handleBack}
                >
                    Back
                </Button>

                <Button
                    variant="secondary"
                    disabled={
                        loading || imageUploading
                    }
                    onClick={handleClose}
                >
                    Cancel
                </Button>

                {isEditMode && (
                    <Button
                        variant="secondary"
                        loading={loading}
                        disabled={loading}
                        onClick={handleSaveDraft}
                    >
                        Save Changes
                    </Button>
                )}

                <Button
                    loading={loading}
                    disabled={loading}
                    onClick={handleSubmitApplication}
                >
                    Submit Application
                </Button>
            </>
        ) : (
            <>
                {currentStep > STEP_VEHICLE && (
                    <Button
                        variant="secondary"
                        disabled={
                            loading || imageUploading
                        }
                        onClick={handleBack}
                    >
                        Back
                    </Button>
                )}

                <Button
                    variant="secondary"
                    disabled={
                        loading || imageUploading
                    }
                    onClick={handleClose}
                >
                    Cancel
                </Button>

                {isEditMode && (
                    <Button
                        variant="secondary"
                        loading={
                            loading || imageUploading
                        }
                        disabled={
                            loading || imageUploading
                        }
                        onClick={handleSaveDraft}
                    >
                        {imageUploading
                            ? "Uploading Images..."
                            : "Save Changes"}
                    </Button>
                )}

                <Button
                    loading={imageUploading}
                    disabled={
                        loading || imageUploading
                    }
                    onClick={handleNext}
                >
                    {imageUploading
                        ? "Uploading Images..."
                        : "Next"}
                </Button>
            </>
        );

    return (
        <Modal
            isOpen={open}
            onClose={handleClose}
            title={
        isEditMode
        ? "Edit Draft"
        : "New Consignment"
}
            size="lg"
            footer={footer}
        >
            <div ref={stepTopRef} className="mb-6 space-y-4">
                <div>
                    <div className="mb-1.5 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {(() => {
                                const StepIcon =
                                    STEPS[currentStep]
                                        .icon;

                                return (
                                    <StepIcon
                                        size={16}
                                    />
                                );
                            })()}
                        </div>

                        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                            Step {currentStep + 1} of{" "}
                            {STEPS.length}
                        </span>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {STEPS[currentStep].label}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {STEPS[currentStep].description}
                    </p>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <motion.div
                        animate={{
                            width: `${((currentStep + 1) / STEPS.length) * 100}%`,
                        }}
                        transition={{
                            duration: 0.25,
                        }}
                        className="h-full rounded-full bg-blue-600"
                    />
                </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={currentStep}
                    variants={STEP_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={STEP_TRANSITION}
                >
                    {currentStep === STEP_VEHICLE && (
                        <NewConsignmentForm
                            form={form}
                            errors={errors}
                            onNestedChange={handleNestedChange}
                        />
                    )}

                    {currentStep === STEP_DOCUMENTS && (
                        <NewConsignmentDocumentsForm
                            form={form}
                            errors={errors}
                            onNestedChange={handleNestedChange}
                            imagesUploading={imageUploading}
                        />
                    )}

                    {currentStep === STEP_MEDIA && (
                        <NewConsignmentMediaForm
                            form={form}
                            errors={errors}
                            onNestedChange={handleNestedChange}
                            onImagesChange={handleImagesChange}
                            imagesUploading={imageUploading}
                        />
                    )}

                    {currentStep === STEP_APPOINTMENT && (
                        <InspectionAppointmentCalendar
                            value={appointmentValue}
                            onChange={handleAppointmentChange}
                            disabled={loading}
                            error={errors.appointment}
                        />
                    )}

                    {currentStep === STEP_TERMS && (
                        <ConsignmentTermsAgreement
                            accepted={termsAgreed}
                            onChange={handleTermsChange}
                            onVersionChange={setTermsVersionId}
                            reloadKey={termsReloadKey}
                            disabled={loading}
                            error={errors.terms}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </Modal>
    );
};

export default NewConsignmentDialog;
