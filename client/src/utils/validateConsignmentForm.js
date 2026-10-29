const MAX_IMAGES = 10;

const setError = (errors, path, message) => {
    errors[path] = message;
};

const isEmpty = (value) =>
    value === undefined ||
    value === null ||
    String(value).trim() === "";

/*
 * Plate/registration number plus the OR/CR document photos — collected
 * together on the wizard's Documents step, right after Vehicle Information.
 */
const validateDocuments = (form, errors) => {
    const vehicle =
        form?.snapshots?.vehicle || {};

    if (isEmpty(vehicle.plateNumber)) {
        setError(
            errors,
            "snapshots.vehicle.plateNumber",
            "Plate number is required."
        );
    } else if (
        vehicle.plateNumber.trim().length >
        20
    ) {
        setError(
            errors,
            "snapshots.vehicle.plateNumber",
            "Plate number cannot exceed 20 characters."
        );
    }

    if (
        !isEmpty(
            vehicle.registrationNumber
        ) &&
        vehicle.registrationNumber.trim()
            .length > 50
    ) {
        setError(
            errors,
            "snapshots.vehicle.registrationNumber",
            "Registration number cannot exceed 50 characters."
        );
    }

    const documents = vehicle.documents || {};
    const officialReceipt =
        documents.officialReceipt || {};
    const certificateOfRegistration =
        documents.certificateOfRegistration ||
        {};

    if (
        isEmpty(officialReceipt.url) ||
        isEmpty(officialReceipt.publicId)
    ) {
        setError(
            errors,
            "snapshots.vehicle.documents.officialReceipt",
            "Upload a photo of the Official Receipt (OR)."
        );
    }

    if (
        isEmpty(
            certificateOfRegistration.url
        ) ||
        isEmpty(
            certificateOfRegistration.publicId
        )
    ) {
        setError(
            errors,
            "snapshots.vehicle.documents.certificateOfRegistration",
            "Upload a photo of the Certificate of Registration (CR)."
        );
    }
};

const validateVehicle = (form, errors) => {
    const vehicle =
        form?.snapshots?.vehicle || {};

    if (isEmpty(vehicle.brand)) {
        setError(
            errors,
            "snapshots.vehicle.brand",
            "Vehicle brand is required."
        );
    } else if (
        vehicle.brand.trim().length > 100
    ) {
        setError(
            errors,
            "snapshots.vehicle.brand",
            "Vehicle brand cannot exceed 100 characters."
        );
    }

    if (isEmpty(vehicle.model)) {
        setError(
            errors,
            "snapshots.vehicle.model",
            "Vehicle model is required."
        );
    } else if (
        vehicle.model.trim().length > 100
    ) {
        setError(
            errors,
            "snapshots.vehicle.model",
            "Vehicle model cannot exceed 100 characters."
        );
    }

    if (
        !isEmpty(vehicle.variant) &&
        vehicle.variant.trim().length >
            100
    ) {
        setError(
            errors,
            "snapshots.vehicle.variant",
            "Vehicle variant cannot exceed 100 characters."
        );
    }

    if (isEmpty(vehicle.year)) {
        setError(
            errors,
            "snapshots.vehicle.year",
            "Vehicle year is required."
        );
    } else {
        const year = Number(vehicle.year);
        const currentYear =
            new Date().getFullYear();

        if (
            !Number.isInteger(year) ||
            year < 1900 ||
            year > currentYear + 1
        ) {
            setError(
                errors,
                "snapshots.vehicle.year",
                "Vehicle year is invalid."
            );
        }
    }

    if (isEmpty(vehicle.vehicleType)) {
        setError(
            errors,
            "snapshots.vehicle.vehicleType",
            "Vehicle type is required."
        );
    }

    if (isEmpty(vehicle.ownership)) {
        setError(
            errors,
            "snapshots.vehicle.ownership",
            "Ownership type is required."
        );
    }
};

const validateSpecifications = (
    form,
    errors
) => {
    const specifications =
        form?.snapshots?.vehicle
            ?.specifications || {};

    if (
        isEmpty(
            specifications.transmission
        )
    ) {
        setError(
            errors,
            "snapshots.vehicle.specifications.transmission",
            "Transmission is required."
        );
    }

    if (
        isEmpty(
            specifications.fuelType
        )
    ) {
        setError(
            errors,
            "snapshots.vehicle.specifications.fuelType",
            "Fuel type is required."
        );
    }

    if (
        isEmpty(
            specifications.seatingCapacity
        )
    ) {
        setError(
            errors,
            "snapshots.vehicle.specifications.seatingCapacity",
            "Seating capacity is required."
        );
    } else {
        const seatingCapacity =
            Number(
                specifications.seatingCapacity
            );

        if (
            !Number.isInteger(
                seatingCapacity
            ) ||
            seatingCapacity < 1 ||
            seatingCapacity > 100
        ) {
            setError(
                errors,
                "snapshots.vehicle.specifications.seatingCapacity",
                "Seating capacity must be a whole number between 1 and 100."
            );
        }
    }
};

const validateDescription = (
    form,
    errors
) => {
    const description =
        form?.snapshots?.vehicle
            ?.description || {};

    if (
        !isEmpty(description.public)
    ) {
        const publicDescription =
            description.public.trim();

        if (
            publicDescription.length >
            2000
        ) {
            setError(
                errors,
                "snapshots.vehicle.description.public",
                "Public description cannot exceed 2000 characters."
            );
        }
    }

    if (
        !isEmpty(
            description.internal
        )
    ) {
        const internalDescription =
            description.internal.trim();

        if (
            internalDescription.length >
            2000
        ) {
            setError(
                errors,
                "snapshots.vehicle.description.internal",
                "Internal description cannot exceed 2000 characters."
            );
        }
    }
};

const validateImages = (form, errors) => {
    const images =
        form?.snapshots?.vehicle?.images || [];

    if (!Array.isArray(images)) {
        setError(
            errors,
            "snapshots.vehicle.images",
            "Vehicle images must be a valid list."
        );

        return;
    }

    if (images.length === 0) {
        setError(
            errors,
            "snapshots.vehicle.images",
            "Add at least one vehicle image."
        );

        return;
    }

    if (images.length > MAX_IMAGES) {
        setError(
            errors,
            "snapshots.vehicle.images",
            `A vehicle can only have up to ${MAX_IMAGES} images.`
        );

        return;
    }

    let primaryImageCount = 0;

    images.forEach((image, index) => {
        const base =
            `snapshots.vehicle.images.${index}`;

        if (isEmpty(image.url)) {
            setError(
                errors,
                `${base}.url`,
                "Image URL is required."
            );
        } else {
            try {
                new URL(image.url);
            } catch {
                setError(
                    errors,
                    `${base}.url`,
                    "Image URL must be a valid URL."
                );
            }
        }

        if (isEmpty(image.publicId)) {
            setError(
                errors,
                `${base}.publicId`,
                "Image public ID is required."
            );
        } else if (
            image.publicId.trim().length > 255
        ) {
            setError(
                errors,
                `${base}.publicId`,
                "Image public ID cannot exceed 255 characters."
            );
        }

        if (
            !isEmpty(image.originalName) &&
            image.originalName.trim().length >
                255
        ) {
            setError(
                errors,
                `${base}.originalName`,
                "Original filename cannot exceed 255 characters."
            );
        }

        if (image.isPrimary === true) {
            primaryImageCount++;
        }
    });

    if (images.length > 0 && primaryImageCount !== 1) {
        setError(
            errors,
            "snapshots.vehicle.images",
            "Mark exactly one vehicle image as the primary image."
        );
    }
};

const validateConsignmentForm = (form) => {
    const errors = {};

    validateVehicle(form, errors);
    validateDocuments(form, errors);
    validateSpecifications(form, errors);
    validateDescription(form, errors);
    validateImages(form, errors);

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

/*
 * Step-scoped validators for the New Consignment wizard — each covers only
 * the fields collected on that step, so advancing from step 1 doesn't
 * demand step 2's not-yet-filled fields (and vice versa). The full
 * validateConsignmentForm above still runs as a final safety net right
 * before actually submitting.
 */
export const validateVehicleInfoStep = (form) => {
    const errors = {};

    validateVehicle(form, errors);
    validateSpecifications(form, errors);

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

export const validateDocumentsStep = (form) => {
    const errors = {};

    validateDocuments(form, errors);

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

export const validateMediaStep = (form) => {
    const errors = {};

    validateDescription(form, errors);
    validateImages(form, errors);

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

export default validateConsignmentForm;