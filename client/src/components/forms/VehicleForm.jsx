import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    useEffect,
    useMemo,
    useState,
} from "react";
import { useDispatch } from "react-redux";

import {
    Calendar,
    Check,
    ClipboardCheck,
    FileText,
    IdCard,
    Image as ImageIcon,
    PhilippinePeso,
    Settings2,
    ShieldCheck,
    SlidersHorizontal,
} from "lucide-react";

import Button from "../common/Button";
import { scrollContainerToTop } from "../../hooks/useScrollTopOnChange";
import Input from "../common/Input";
import Select from "../common/Select";
import Switch from "../common/Switch";
import Textarea from "../common/Textarea";
import ReviewSection from "../common/ReviewSection";
import ReviewField from "../common/ReviewField";
import ReviewImageGallery from "../common/ReviewImageGallery";
import ImageUploadZone from "../shared/ImageUploadZone";
import IdImageUploadRow from "../shared/IdImageUploadRow";

import useVehicleCategory from "../../hooks/categories";

import { uploadVehicleImage } from "../../services/vehicleService";
import { checkPlateNumberAvailability, checkRegistrationNumberAvailability } from "../../store/vehicles/vehicleSlice";

import { VEHICLE_BRANDS } from "../../utils/vehicleBrands";

const createInitialState = () => ({
    registrationNumber: "",

    compliance: {
        licenseExpiration: "",
    },

    plateNumber: "",

    brand: "",

    model: "",

    variant: "",

    year: "",

    vehicleType: "",

    category: "",

    specifications: {
        transmission: "",
        fuelType: "",
        seatingCapacity: "",
    },

    pricing: {
        dailyRate: "",
        reservationFee: "",
    },

    securityDeposit: {
        enabled: false,
        amount: "",
    },

    description: {
        public: "",
    },


    availability: {
        bookingEnabled: true,
        availableFrom: "",
    },

     images: [],

     documents: {
         officialReceipt: [],

         certificateOfRegistration: [],
     },

     condition: "Excellent",

     isFeatured: false,
});

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

const FORM_STEPS = [
    {
        title: "Vehicle Identity",
        description:
            "Basic vehicle information.",
        icon: IdCard,
    },
    {
        title: "Specifications",
        description:
            "Vehicle specifications.",
        icon: Settings2,
    },
    {
        title: "Pricing",
        description:
            "Rental pricing, description, and operational settings.",
        icon: PhilippinePeso,
    },
    {
        title: "Images",
        description:
            "Upload vehicle images.",
        icon: ImageIcon,
    },
    {
        title: "Review",
        description:
            "Review before saving.",
        icon: ClipboardCheck,
    },
];

const STEP_FIELD_MAP = {
    0: [
        "registrationNumber",
        "compliance.licenseExpiration",
        "plateNumber",
        "documents.officialReceipt",
        "documents.certificateOfRegistration",
        "vehicleType",
        "category",
        "brand",
        "model",
        "variant",
        "year",
    ],

    1: [
        "specifications.transmission",
        "specifications.fuelType",
        "specifications.seatingCapacity",
    ],

    2: [
        "pricing.dailyRate",
        "pricing.reservationFee",
        "securityDeposit.enabled",
        "securityDeposit.amount",
        "description.public",
        "availability.bookingEnabled",
        "availability.availableFrom",
        "condition",
        "isFeatured",
    ],

    3: [
        "images",
    ],

    4: [],
};

const FIELD_STEP_MAP = Object.entries(
    STEP_FIELD_MAP
).reduce(
    (result, [step, fields]) => {
        fields.forEach((field) => {
            result[field] = Number(step);
        });

        return result;
    },
    {}
);

const EMPTY_ERRORS = {};

const normalizeBackendErrors = (
    errors
) => {
    if (!errors) {
        return {};
    }

    if (
        !Array.isArray(errors) &&
        typeof errors === "object"
    ) {
        return errors;
    }

    if (!Array.isArray(errors)) {
        return {};
    }

    return errors.reduce(
        (result, error) => {
            if (!error) {
                return result;
            }

            const path =
                error.path ||
                error.field ||
                error.param ||
                error.location;

            const message =
                error.msg ||
                error.message ||
                error.error;

            if (path && message) {
                result[path] = message;
            }

            return result;
        },
        {}
    );
};

const VehicleForm = ({
    mode = "create",
    vehicle = null,
    loading = false,
    errors = EMPTY_ERRORS,
    onSubmit,
    onCancel,
    onNext,
}) => {
    const {
        vehicleCategories,
        getVehicleCategories,
    } = useVehicleCategory();

    const dispatch = useDispatch();

    const isViewMode =
        mode === "view";

    const isEditMode =
        mode === "edit";

    const isWizardMode =
        mode === "wizard";

    const isExistingVehicle =
        mode === "edit" ||
        mode === "view";

    const [formData, setFormData] =
        useState(
            createInitialState()
        );

    const [currentStep, setCurrentStep] =
        useState(0);

    const [validationErrors, setValidationErrors] =
        useState({});

    const [backendErrors, setBackendErrors] =
        useState({});

    const [hasValidated, setHasValidated] =
        useState(false);

    const [focusField, setFocusField] =
        useState("");

     const [customBrand, setCustomBrand] =
         useState("");

     const [customModel, setCustomModel] =
         useState("");

     const [isCustom, setIsCustom] =
         useState(false);

     const [isSubmitting, setIsSubmitting] =
         useState(false);

     /*
      * The footer swaps "Next" for the submit button in place as soon as the
      * review step is reached. Without a short arming delay, the second click
      * of a double-click on "Next" lands on the freshly mounted submit button
      * and creates the vehicle before the user ever pressed it.
      */
     const [canSubmit, setCanSubmit] =
         useState(false);

    const isReviewStep =
        currentStep ===
        FORM_STEPS.length - 1;

    useEffect(() => {
        if (!isReviewStep) {
            setCanSubmit(false);

            return;
        }

        const timer =
            window.setTimeout(() => {
                setCanSubmit(true);
            }, 500);

        return () => {
            window.clearTimeout(timer);

            setCanSubmit(false);
        };
    }, [isReviewStep]);

    useEffect(() => {
        getVehicleCategories();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setBackendErrors(
            normalizeBackendErrors(errors)
        );
    }, [errors]);

    useEffect(() => {
        if (
            !isExistingVehicle ||
            !vehicle
        ) {
            return;
        }

        setFormData({
            registrationNumber:
                vehicle.registrationNumber ??
                "",

            compliance: {
                licenseExpiration:
                    vehicle.compliance
                        ?.licenseExpiration
                        ? vehicle.compliance.licenseExpiration.substring(
                              0,
                              10
                          )
                        : "",
            },

            plateNumber:
                vehicle.plateNumber ?? "",

            brand:
                vehicle.brand ?? "",

            model:
                vehicle.model ?? "",

            variant:
                vehicle.variant ?? "",

            year:
                vehicle.year ?? "",

            vehicleType:
                vehicle.vehicleType ?? "",

            category:
                vehicle.category?._id ??
                vehicle.category ??
                "",

            specifications: {
                transmission:
                    vehicle.specifications
                        ?.transmission ?? "",

                fuelType:
                    vehicle.specifications
                        ?.fuelType ?? "",

                seatingCapacity:
                    vehicle.specifications
                        ?.seatingCapacity ?? "",
            },

            pricing: {
                dailyRate:
                    vehicle.pricing
                        ?.dailyRate ?? "",

                reservationFee:
                    vehicle.pricing
                        ?.reservationFee ?? "",
            },

            securityDeposit: {
                enabled:
                    vehicle.securityDeposit
                        ?.enabled ?? false,

                amount:
                    vehicle.securityDeposit
                        ?.amount ?? "",
            },

            description: {
                public:
                    vehicle.description
                        ?.public ?? "",
            },

            availability: {
                bookingEnabled:
                    vehicle.availability
                        ?.bookingEnabled ??
                    true,

                availableFrom:
                    vehicle.availability
                        ?.availableFrom
                        ? vehicle.availability.availableFrom
                              .substring(0, 10)
                        : "",
            },

             images:
                 vehicle.images ?? [],

             documents: {
                 officialReceipt:
                     vehicle.documents
                         ?.officialReceipt
                         ? [
                               vehicle.documents
                                   .officialReceipt,
                           ]
                         : [],

                 certificateOfRegistration:
                     vehicle.documents
                         ?.certificateOfRegistration
                         ? [
                               vehicle.documents
                                   .certificateOfRegistration,
                           ]
                         : [],
             },

             condition:
                vehicle.condition ??
                "Excellent",

            isFeatured:
                vehicle.isFeatured ??
                false,
        });

        setCurrentStep(0);
        setValidationErrors({});
        setBackendErrors({});
        setHasValidated(false);
        setFocusField("");

        setCustomBrand("");

        setCustomModel("");

        setIsCustom(false);
    }, [
        isExistingVehicle,
        vehicle,
    ]);

    const categoryOptions =
        useMemo(() => {
            const options =
                vehicleCategories
                    .filter(
                        (category) =>
                            category.status ===
                                "Active" &&
                            category.vehicleType ===
                                formData.vehicleType
                    )
                    .sort(
                        (a, b) =>
                            a.displayOrder -
                            b.displayOrder
                    )
                    .map((category) => ({
                        label:
                            category.name,
                        value:
                            category._id,
                    }));

            return [
                {
                    label:
                        formData.vehicleType
                            ? "Select Category"
                            : "Select Vehicle Type First",
                    value: "",
                },
                ...options,
            ];
        }, [
            vehicleCategories,
            formData.vehicleType,
        ]);

    const brandOptions = useMemo(() => {
        const brands =
            formData.vehicleType &&
            VEHICLE_BRANDS[formData.vehicleType]
                ? Object.keys(
                      VEHICLE_BRANDS[
                          formData.vehicleType
                      ]
                  )
                : [];

        const hasCurrent =
            formData.brand &&
            !brands.includes(
                formData.brand
            );

        return [
            {
                label: formData.vehicleType
                    ? "Select Brand"
                    : "Select Vehicle Type First",
                value: "",
            },
            ...brands.map(
                (brand) => ({
                    label: brand,
                    value: brand,
                })
            ),
            ...(hasCurrent
                ? [
                      {
                          label: formData.brand,
                          value: formData.brand,
                      },
                  ]
                : []),
        ];
    }, [formData.vehicleType, formData.brand]);

    const modelOptions = useMemo(() => {
        const models =
            formData.vehicleType &&
            formData.brand &&
            VEHICLE_BRANDS[
                formData.vehicleType
            ]?.[formData.brand]
                ? VEHICLE_BRANDS[
                      formData.vehicleType
                  ][formData.brand]
                : [];

        const hasCurrent =
            formData.model &&
            !models.includes(
                formData.model
            );

        return [
            {
                label: formData.brand
                    ? "Select Model"
                    : "Select Brand First",
                value: "",
            },
            ...models.map(
                (model) => ({
                    label: model,
                    value: model,
                })
            ),
            ...(hasCurrent
                ? [
                      {
                          label: formData.model,
                          value: formData.model,
                      },
                  ]
                : []),
        ];
    }, [
        formData.vehicleType,
        formData.brand,
        formData.model,
    ]);

    const clearFieldErrors = (
        field
    ) => {
        setValidationErrors(
            (previous) => {
                if (!previous?.[field]) {
                    return previous;
                }

                const updated = {
                    ...previous,
                };

                delete updated[field];

                return updated;
            }
        );

        setBackendErrors(
            (previous) => {
                if (!previous?.[field]) {
                    return previous;
                }

                const updated = {
                    ...previous,
                };

                delete updated[field];

                return updated;
            }
        );
    };

    const handleChange = (
        event
    ) => {
        const {
            name,
            value,
            type,
            checked,
        } = event.target;

        const newValue = (name === "plateNumber" || name === "registrationNumber") && type !== "checkbox"
            ? value.toUpperCase()
            : value;

        setFormData((previous) => ({
            ...previous,
            [name]:
                type === "checkbox"
                    ? checked
                    : newValue,
        }));

        if (hasValidated) {
            clearFieldErrors(name);
        }
    };

    const handleNestedChange = (
        section,
        field,
        value
    ) => {
        setFormData((previous) => ({
            ...previous,
            [section]: {
                ...previous[section],
                [field]: value,
            },
        }));

        if (hasValidated) {
            clearFieldErrors(
                `${section}.${field}`
            );
        }
    };

    const handleVehicleTypeChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setFormData((previous) => ({
            ...previous,
            vehicleType: value,
            brand: "",
            model: "",
            category: "",
        }));

         setCustomBrand("");

         setCustomModel("");

         setIsCustom(false);

         if (hasValidated) {
            clearFieldErrors(
                "vehicleType"
            );

            clearFieldErrors("brand");

            clearFieldErrors("model");

            clearFieldErrors(
                "category"
            );
        }
    };

    const handleBrandChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setFormData((previous) => ({
            ...previous,
            brand: value,
            model: "",
        }));

        setCustomModel("");

        if (hasValidated) {
            clearFieldErrors("brand");

            clearFieldErrors("model");
        }
    };

    const handleModelChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setFormData((previous) => ({
            ...previous,
            model: value,
        }));

        if (hasValidated) {
            clearFieldErrors("model");
        }
    };

     const handleCustomToggle = (
         event
     ) => {
         const { checked } =
             event.target;

         setIsCustom(checked);

         if (!checked) {
             setCustomBrand("");

             setCustomModel("");

             setFormData(
                 (previous) => ({
                     ...previous,
                     brand: "",
                     model: "",
                 })
             );
         }

         if (hasValidated) {
             clearFieldErrors("brand");

             clearFieldErrors("model");
         }
     };

    const handleCustomBrandChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setCustomBrand(value);

        if (hasValidated) {
            clearFieldErrors("brand");
        }
    };

    const handleCustomModelChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setCustomModel(value);

        if (hasValidated) {
            clearFieldErrors("model");
        }
    };

    const handleImageChange = (
         images
     ) => {
         setFormData((previous) => ({
             ...previous,
             images,
         }));

         if (hasValidated) {
             clearFieldErrors("images");
         }
     };

    const handleDocumentChange = (
         field
     ) => (images) => {
         setFormData((previous) => ({
             ...previous,
             documents: {
                 ...previous.documents,
                 [field]: images,
             },
         }));

          if (hasValidated) {
              clearFieldErrors(
                  `documents.${field}`
              );
          }
     };

    /*
     * IdImageUploadRow (the same front/back row used for a valid ID during
     * registration) works with a 2-slot array, one slot per document —
     * translated here to the officialReceipt/certificateOfRegistration
     * fields, each still stored as a 0-or-1-length array so the rest of
     * this form (processImages, buildPayload) doesn't need to change.
     */
    const handleDocumentImagesChange = (
        next
    ) => {
        handleDocumentChange("officialReceipt")(
            next[0] ? [next[0]] : []
        );

        handleDocumentChange(
            "certificateOfRegistration"
        )(next[1] ? [next[1]] : []);
    };

    const handleSwitchChange = (
        section,
        field,
        checked
    ) => {
        if (section) {
            setFormData((previous) => ({
                ...previous,
                [section]: {
                    ...previous[section],
                    [field]: checked,
                },
            }));

            if (hasValidated) {
                clearFieldErrors(
                    `${section}.${field}`
                );
            }

            return;
        }

        setFormData((previous) => ({
            ...previous,
            [field]: checked,
        }));

        if (hasValidated) {
            clearFieldErrors(field);
        }
    };

    const processSingleImage = async (
         image
     ) => {
         if (
             image?.file &&
             !image?.url &&
             !image?.publicId
         ) {
             try {
                 const result =
                     await uploadVehicleImage(
                         image.file
                     );

                 const uploadedImage =
                     result?.data;

                 return {
                     id:
                         uploadedImage
                             ?.publicId ||
                         image.id,

                     file: null,

                     preview: null,

                     url:
                         uploadedImage
                             ?.url ||
                         null,

                     publicId:
                         uploadedImage
                             ?.publicId ||
                         null,

                     originalName:
                         image.originalName,

                     isPrimary:
                         image.isPrimary ??
                         false,
                 };
             } catch (error) {
                 console.error(
                     "Failed to upload image:",
                     error
                 );

                 throw error;
             }
         }

         return image;
     };

    const processImages = async () => {
         const processedImages =
             await Promise.all(
                 formData.images.map(
                     processSingleImage
                 )
             );

         const processedOfficialReceipt =
             formData.documents
                 .officialReceipt.length
                 ? await processSingleImage(
                       formData.documents
                           .officialReceipt[0]
                   )
                 : null;

         const processedCertificateOfRegistration =
             formData.documents
                 .certificateOfRegistration
                 .length
                 ? await processSingleImage(
                       formData.documents
                           .certificateOfRegistration[0]
                   )
                 : null;

         setFormData(
             (previous) => ({
                 ...previous,
                 images:
                     processedImages,
                 documents: {
                     officialReceipt:
                         processedOfficialReceipt
                             ? [
                                   processedOfficialReceipt,
                               ]
                             : [],

                     certificateOfRegistration:
                         processedCertificateOfRegistration
                             ? [
                                   processedCertificateOfRegistration,
                               ]
                             : [],
                 },
             })
         );

         return {
             images:
                 processedImages,

             documents: {
                 officialReceipt:
                     processedOfficialReceipt,

                 certificateOfRegistration:
                     processedCertificateOfRegistration,
             },
         };
     };

    const buildPayload = (
         processed
     ) => ({
         registrationNumber:
             formData.registrationNumber.trim(),

         compliance: {
             licenseExpiration:
                 formData.compliance
                     .licenseExpiration || null,
         },

         plateNumber:
             formData.plateNumber.trim(),

         brand:
             isCustom
                 ? customBrand.trim()
                 : formData.brand.trim(),

         model:
             isCustom
                 ? customModel.trim()
                 : formData.model.trim(),

        variant:
            formData.variant.trim(),

        year:
            Number.isNaN(
                Number(formData.year)
            )
                ? null
                : Number(formData.year),

        vehicleType:
            formData.vehicleType,

        category:
            formData.category || null,

        specifications: {
            transmission:
                formData.specifications.transmission,

            fuelType:
                formData.specifications.fuelType,

            seatingCapacity:
                Number.isNaN(
                    Number(
                        formData
                            .specifications
                            .seatingCapacity
                    )
                )
                    ? null
                    : Number(
                          formData
                              .specifications
                              .seatingCapacity
                      ),
        },

        pricing: {
            dailyRate:
                Number.isNaN(
                    Number(
                        formData.pricing
                            .dailyRate
                    )
                )
                    ? null
                    : Number(
                          formData.pricing
                              .dailyRate
                      ),

            reservationFee:
                Number.isNaN(
                    Number(
                        formData.pricing
                            .reservationFee
                    )
                )
                    ? null
                    : Number(
                          formData.pricing
                              .reservationFee
                      ),
        },

        securityDeposit: {
            enabled:
                Boolean(
                    formData.securityDeposit
                        .enabled
                ),

            amount:
                formData.securityDeposit.enabled
                    ? Number.isNaN(
                          Number(
                              formData.securityDeposit
                                  .amount
                          )
                      )
                        ? null
                        : Number(
                              formData.securityDeposit
                                  .amount
                          )
                    : 0,
        },

        description: {
            public:
                (formData.description
                    ?.public ?? "").trim(),
        },

        availability: {
            bookingEnabled:
                formData.availability
                    .bookingEnabled,

            availableFrom:
                formData.availability
                    .availableFrom || null,
        },

         images:
             processed?.images ??
             formData.images,

         documents: {
             officialReceipt:
                 processed?.documents
                     ?.officialReceipt ??
                 formData.documents
                     .officialReceipt[0] ??
                 null,

             certificateOfRegistration:
                 processed?.documents
                     ?.certificateOfRegistration ??
                 formData.documents
                     .certificateOfRegistration[0] ??
                 null,
         },

         condition:
            formData.condition,

        isFeatured:
            formData.isFeatured,
    });

    // `.vehicle-form-scroll` is the <form> itself, which doesn't scroll —
    // reset the container that actually does (the Modal body, or window).
    const scrollToTop = () => {
        scrollContainerToTop(
            document.querySelector(
                ".vehicle-form-scroll"
            )
        );
    };

    const scrollToField = (
        field
    ) => {
        if (!field) {
            return;
        }

        const element =
            document.querySelector(
                `[name="${field}"]`
            );

        if (!element) {
            return;
        }

        element.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });

        window.setTimeout(() => {
            if (
                typeof element.focus ===
                "function"
            ) {
                element.focus({
                    preventScroll: true,
                });
            }
        }, 250);
    };

    useEffect(() => {
        if (!focusField) {
            return;
        }

        const timer =
            window.setTimeout(() => {
                scrollToField(
                    focusField
                );

                setFocusField("");
            }, 100);

        return () =>
            window.clearTimeout(timer);
    }, [
        currentStep,
        focusField,
    ]);

    const findFirstErrorField = (
        errors
    ) => {
        const errorFields =
            Object.keys(
                errors ?? {}
            );

        if (!errorFields.length) {
            return "";
        }

        for (
            const stepFields of Object.values(
                STEP_FIELD_MAP
            )
        ) {
            const matchingField =
                stepFields.find(
                    (field) =>
                        errorFields.includes(
                            field
                        )
                );

            if (matchingField) {
                return matchingField;
            }
        }

        return errorFields[0];
    };

    const focusFirstError = (
        errors
    ) => {
        const firstErrorField =
            findFirstErrorField(
                errors
            );

        if (!firstErrorField) {
            return;
        }

        const targetStep =
            FIELD_STEP_MAP[
                firstErrorField
            ];

        if (
            typeof targetStep ===
                "number" &&
            targetStep !== currentStep
        ) {
            setCurrentStep(
                targetStep
            );
        }

        setFocusField(
            firstErrorField
        );
    };

    const validateStep = () => {
        const errors = {};

        switch (currentStep) {
            case 0:
                if (
                    !formData.plateNumber.trim()
                ) {
                    errors.plateNumber =
                        "Plate number is required.";
                }

                 if (
                     isCustom
                         ? !customBrand.trim()
                         : !formData.brand.trim()
                 ) {
                     errors.brand =
                         "Brand is required.";
                 }

                 if (
                     isCustom
                         ? !customModel.trim()
                         : !formData.model.trim()
                 ) {
                     errors.model =
                         "Model is required.";
                 }

                 if (
                     formData.year === "" ||
                    formData.year === null ||
                    formData.year === undefined
                ) {
                    errors.year =
                        "Year is required.";
                } else {
                    const parsedYear =
                        Number(formData.year);

                    if (
                        Number.isNaN(parsedYear) ||
                        parsedYear < 1900 ||
                        parsedYear >
                            new Date().getFullYear() +
                                1
                    ) {
                        errors.year =
                            "Enter a valid vehicle year.";
                    }
                }

                if (
                    !formData.vehicleType
                ) {
                    errors.vehicleType =
                        "Vehicle type is required.";
                }

                break;

            case 1:
                if (
                    !formData.specifications
                        .transmission
                ) {
                    errors[
                        "specifications.transmission"
                    ] =
                        "Transmission is required.";
                }

                if (
                    !formData.specifications
                        .fuelType
                ) {
                    errors[
                        "specifications.fuelType"
                    ] =
                        "Fuel type is required.";
                }

                if (
                    formData.specifications
                        .seatingCapacity ===
                        "" ||
                    formData.specifications
                        .seatingCapacity ===
                        null ||
                    formData.specifications
                        .seatingCapacity ===
                        undefined
                ) {
                    errors[
                        "specifications.seatingCapacity"
                    ] =
                        "Seating capacity is required.";
                } else {
                    const parsedSeatingCapacity =
                        Number(
                            formData
                                .specifications
                                .seatingCapacity
                        );

                    if (
                        Number.isNaN(
                            parsedSeatingCapacity
                        ) ||
                        parsedSeatingCapacity < 1
                    ) {
                        errors[
                            "specifications.seatingCapacity"
                        ] =
                            "Seating capacity must be at least 1.";
                    }
                }

                break;

            case 2: {
                const dailyRateValue =
                    formData.pricing.dailyRate;

                if (
                    dailyRateValue === "" ||
                    dailyRateValue === null ||
                    dailyRateValue === undefined ||
                    String(dailyRateValue).trim() ===
                        ""
                ) {
                    errors[
                        "pricing.dailyRate"
                    ] =
                        "Daily rate is required.";
                } else if (
                    Number.isNaN(
                        Number(dailyRateValue)
                    ) ||
                    Number(dailyRateValue) < 0
                ) {
                    errors[
                        "pricing.dailyRate"
                    ] =
                        "Daily rate must be a valid non-negative number.";
                }

                const reservationFeeValue =
                    formData.pricing
                        .reservationFee;

                if (
                    reservationFeeValue === "" ||
                    reservationFeeValue === null ||
                    reservationFeeValue === undefined ||
                    String(reservationFeeValue).trim() ===
                        ""
                ) {
                    errors[
                        "pricing.reservationFee"
                    ] =
                        "Reservation fee is required.";
                } else if (
                    Number.isNaN(
                        Number(reservationFeeValue)
                    ) ||
                    Number(reservationFeeValue) < 0
                ) {
                    errors[
                        "pricing.reservationFee"
                    ] =
                        "Reservation fee must be a valid non-negative number.";
                }

                if (
                    !errors[
                        "pricing.dailyRate"
                    ] &&
                    !errors[
                        "pricing.reservationFee"
                    ]
                ) {
                    const parsedDailyRate =
                        Number(dailyRateValue);

                    const parsedReservationFee =
                        Number(reservationFeeValue);

                    if (
                        parsedReservationFee >
                        parsedDailyRate
                    ) {
                        errors[
                            "pricing.reservationFee"
                        ] =
                            "Reservation fee cannot be greater than the daily rate.";
                    }
                }

                if (
                    formData.securityDeposit
                        .enabled
                ) {
                    const securityDepositAmountValue =
                        formData
                            .securityDeposit
                            .amount;

                    if (
                        securityDepositAmountValue ===
                            "" ||
                        securityDepositAmountValue ===
                            null ||
                        securityDepositAmountValue ===
                            undefined ||
                        String(
                            securityDepositAmountValue
                        ).trim() ===
                            ""
                    ) {
                        errors[
                            "securityDeposit.amount"
                        ] =
                            "Security deposit amount is required when the security deposit is enabled.";
                    } else if (
                        Number.isNaN(
                            Number(
                                securityDepositAmountValue
                            )
                        ) ||
                        Number(
                            securityDepositAmountValue
                        ) <= 0
                    ) {
                        errors[
                            "securityDeposit.amount"
                        ] =
                            "Security deposit amount must be greater than 0 when the security deposit is enabled.";
                    }
                }

                if (!formData.condition) {
                    errors.condition =
                        "Condition is required.";
                }

                break;
            }

            case 3:
                if (
                    !formData.images.length
                ) {
                    errors.images =
                        "At least one vehicle image is required.";
                }

                break;

            default:
                break;
        }

        setValidationErrors(errors);

        if (
            Object.keys(errors).length
        ) {
            focusFirstError(errors);
        }

        return (
            Object.keys(errors).length ===
            0
        );
    };

    const handleNext = async () => {
        setHasValidated(true);

        if (!validateStep()) {
            return;
        }

        if (currentStep === 0) {
            const trimmedPlate = formData.plateNumber.trim();

            if (trimmedPlate) {
                try {
                    const plateCheckResult = await dispatch(
                        checkPlateNumberAvailability({
                            plateNumber: trimmedPlate,
                            excludeId: vehicle?._id,
                        })
                    ).unwrap();

                    if (plateCheckResult?.data?.exists) {
                        setValidationErrors((prev) => ({
                            ...prev,
                            plateNumber: "Plate number already exists.",
                        }));
                        return;
                    }
                } catch {
                    // Allow navigation to continue if the check fails
                }
            }

            const trimmedReg = formData.registrationNumber.trim();

            if (trimmedReg) {
                try {
                    const regCheckResult = await dispatch(
                        checkRegistrationNumberAvailability({
                            registrationNumber: trimmedReg,
                            excludeId: vehicle?._id,
                        })
                    ).unwrap();

                    if (regCheckResult?.data?.exists) {
                        setValidationErrors((prev) => ({
                            ...prev,
                            registrationNumber: "Registration number already exists.",
                        }));
                        return;
                    }
                } catch {
                    // Allow navigation to continue if the check fails
                }
            }
        }

        setCurrentStep(
            (previous) =>
                previous + 1
        );

        scrollToTop();
    };

    const handlePrevious = () => {
        setCurrentStep(
            (previous) =>
                previous - 1
        );

        scrollToTop();
    };

    const runFullValidation = () => {
        const errors = {};

        if (
            !formData.plateNumber.trim()
        ) {
            errors.plateNumber =
                "Plate number is required.";
        }

         if (
             isCustom
                 ? !customBrand.trim()
                 : !formData.brand.trim()
         ) {
             errors.brand =
                 "Brand is required.";
         }

         if (
             isCustom
                 ? !customModel.trim()
                 : !formData.model.trim()
         ) {
             errors.model =
                 "Model is required.";
         }

         if (
             formData.year === "" ||
            formData.year === null ||
            formData.year === undefined
        ) {
            errors.year =
                "Year is required.";
        } else {
            const parsedYear =
                Number(formData.year);

            if (
                Number.isNaN(parsedYear) ||
                parsedYear < 1900 ||
                parsedYear >
                    new Date().getFullYear() +
                        1
            ) {
                errors.year =
                    "Enter a valid vehicle year.";
            }
        }

        if (
            !formData.vehicleType
        ) {
            errors.vehicleType =
                "Vehicle type is required.";
        }

        if (
            !formData.specifications
                .transmission
        ) {
            errors[
                "specifications.transmission"
            ] =
                "Transmission is required.";
        }

        if (
            !formData.specifications
                .fuelType
        ) {
            errors[
                "specifications.fuelType"
            ] =
                "Fuel type is required.";
        }

        if (
            formData.specifications
                .seatingCapacity === "" ||
            formData.specifications
                .seatingCapacity === null ||
            formData.specifications
                .seatingCapacity === undefined
        ) {
            errors[
                "specifications.seatingCapacity"
            ] =
                "Seating capacity is required.";
        } else {
            const parsedSeatingCapacity =
                Number(
                    formData
                        .specifications
                        .seatingCapacity
                );

            if (
                Number.isNaN(
                    parsedSeatingCapacity
                ) ||
                parsedSeatingCapacity < 1
            ) {
                errors[
                    "specifications.seatingCapacity"
                ] =
                    "Seating capacity must be at least 1.";
            }
        }

        const dailyRateValue =
            formData.pricing.dailyRate;

        if (
            dailyRateValue === "" ||
            dailyRateValue === null ||
            dailyRateValue === undefined ||
            String(dailyRateValue).trim() ===
                ""
        ) {
            errors[
                "pricing.dailyRate"
            ] =
                "Daily rate is required.";
        } else if (
            Number.isNaN(
                Number(dailyRateValue)
            ) ||
            Number(dailyRateValue) < 0
        ) {
            errors[
                "pricing.dailyRate"
            ] =
                "Daily rate must be a valid non-negative number.";
        }

        const reservationFeeValue =
            formData.pricing
                .reservationFee;

        if (
            reservationFeeValue === "" ||
            reservationFeeValue === null ||
            reservationFeeValue === undefined ||
            String(reservationFeeValue).trim() ===
                ""
        ) {
            errors[
                "pricing.reservationFee"
            ] =
                "Reservation fee is required.";
        } else if (
            Number.isNaN(
                Number(reservationFeeValue)
            ) ||
            Number(reservationFeeValue) < 0
        ) {
            errors[
                "pricing.reservationFee"
            ] =
                "Reservation fee must be a valid non-negative number.";
        }

        if (
            !errors[
                "pricing.dailyRate"
            ] &&
            !errors[
                "pricing.reservationFee"
            ]
        ) {
            const parsedDailyRate =
                Number(dailyRateValue);

            const parsedReservationFee =
                Number(reservationFeeValue);

            if (
                parsedReservationFee >
                parsedDailyRate
            ) {
                errors[
                    "pricing.reservationFee"
                ] =
                    "Reservation fee cannot be greater than the daily rate.";
            }
        }

        if (
            formData.securityDeposit
                .enabled
        ) {
            const securityDepositAmountValue =
                formData.securityDeposit.amount;

            if (
                securityDepositAmountValue ===
                    "" ||
                securityDepositAmountValue ===
                    null ||
                securityDepositAmountValue ===
                    undefined ||
                String(
                    securityDepositAmountValue
                ).trim() ===
                    ""
            ) {
                errors[
                    "securityDeposit.amount"
                ] =
                    "Security deposit amount is required when the security deposit is enabled.";
            } else if (
                Number.isNaN(
                    Number(
                        securityDepositAmountValue
                    )
                ) ||
                Number(
                    securityDepositAmountValue
                ) <= 0
            ) {
                errors[
                    "securityDeposit.amount"
                ] =
                    "Security deposit amount must be greater than 0 when the security deposit is enabled.";
            }
        }

        if (
            !formData.images.length
        ) {
            errors.images =
                "At least one vehicle image is required.";
        }

        if (
            !formData.condition
        ) {
            errors.condition =
                "Condition is required.";
        }

        setValidationErrors(errors);

        if (
            Object.keys(errors).length
        ) {
            focusFirstError(errors);
        }

        return (
            Object.keys(errors).length ===
            0
        );
    };

const handleSubmit = async (
        event
    ) => {
        event.preventDefault();

        if (isViewMode) {
            return;
        }

        if (isSubmitting) {
            return;
        }

        /*
         * Only the review step may submit. Any other submit event
         * (implicit submission, a stray click landing on the button as the
         * step changes) must never reach the create/update request.
         */
        if (
            !isReviewStep ||
            !canSubmit
        ) {
            return;
        }

        setHasValidated(true);
        setIsSubmitting(true);
        setValidationErrors({});
        setBackendErrors({});

        try {
            if (isWizardMode) {
                if (currentStep === FORM_STEPS.length - 1) {
                    // Review step in wizard mode: run validation and pass raw data to onNext
                    const formForValidation = formData || {};
                    if (!runFullValidation(formForValidation)) {
                        return;
                    }
                    onNext?.(formData);
                    return;
                }

                if (!runFullValidation()) {
                    return;
                }

                const trimmedPlate = formData.plateNumber.trim();

                if (trimmedPlate) {
                    const plateCheckResult = await dispatch(
                        checkPlateNumberAvailability({
                            plateNumber: trimmedPlate,
                            excludeId: vehicle?._id,
                        })
                    ).unwrap();

                    if (plateCheckResult?.data?.exists) {
                        setValidationErrors((prev) => ({
                            ...prev,
                            plateNumber: "Plate number already exists.",
                        }));
                        return;
                    }
                }

                const trimmedReg = formData.registrationNumber.trim();

                if (trimmedReg) {
                    const regCheckResult = await dispatch(
                        checkRegistrationNumberAvailability({
                            registrationNumber: trimmedReg,
                            excludeId: vehicle?._id,
                        })
                    ).unwrap();

                    if (regCheckResult?.data?.exists) {
                        setValidationErrors((prev) => ({
                            ...prev,
                            registrationNumber: "Registration number already exists.",
                        }));
                        return;
                    }
                }

                const processed =
                     await processImages();

                 const payload =
                     buildPayload(
                         processed
                     );

                 onNext?.(payload);

                 return;
            }

            if (!runFullValidation()) {
                return;
            }

            const trimmedPlate = formData.plateNumber.trim();

            if (trimmedPlate) {
                const plateCheckResult = await dispatch(
                    checkPlateNumberAvailability({
                        plateNumber: trimmedPlate,
                        excludeId: vehicle?._id,
                    })
                ).unwrap();

                if (plateCheckResult?.data?.exists) {
                    setValidationErrors((prev) => ({
                        ...prev,
                        plateNumber: "Plate number already exists.",
                    }));
                    return;
                }
            }

            const trimmedReg = formData.registrationNumber.trim();

            if (trimmedReg) {
                const regCheckResult = await dispatch(
                    checkRegistrationNumberAvailability({
                        registrationNumber: trimmedReg,
                        excludeId: vehicle?._id,
                    })
                ).unwrap();

                if (regCheckResult?.data?.exists) {
                    setValidationErrors((prev) => ({
                        ...prev,
                        registrationNumber: "Registration number already exists.",
                    }));
                    return;
                }
            }

            const processed =
                await processImages();

            const payload =
                buildPayload(
                    processed
                );

            await onSubmit?.(payload);
        } catch (error) {
            console.error(
                "Failed to process vehicle submission:",
                error
            );

            if (error?.errors && Array.isArray(error.errors)) {
                const normalizedErrors = normalizeBackendErrors(error.errors);
                setValidationErrors((prev) => ({
                    ...prev,
                    ...normalizedErrors,
                }));
            }

            if (error?.message) {
                setValidationErrors((prev) => ({
                    ...prev,
                    form: error.message,
                }));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (
            !Object.keys(
                backendErrors
            ).length
        ) {
            return;
        }

        focusFirstError(
            backendErrors
        );
    }, [backendErrors]);

    const getFieldError = (
        path
    ) =>
        validationErrors?.[path] ||
        backendErrors?.[path] ||
        "";

    return (
        <form
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
                const tagName =
                    event.target?.tagName;

                /*
                 * Block implicit submission from Enter in any field, while
                 * leaving textareas and explicit button activation alone.
                 */
                if (
                    event.key === "Enter" &&
                    tagName !== "TEXTAREA" &&
                    tagName !== "BUTTON"
                ) {
                    event.preventDefault();
                }
            }}
            className="vehicle-form-scroll space-y-6"
        >
            <div className="space-y-5">
                <div className="flex items-start">
                    {FORM_STEPS.map((step, index) => {
                        const StepIcon = step.icon;
                        const isComplete = index < currentStep;
                        const isActive = index === currentStep;

                        return (
                            <div
                                key={step.title}
                                className={`flex items-center ${
                                    index === FORM_STEPS.length - 1
                                        ? ""
                                        : "flex-1"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        index < currentStep &&
                                        setCurrentStep(index)
                                    }
                                    disabled={
                                        index > currentStep
                                    }
                                    className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                                >
                                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                                        {isActive && (
                                            <motion.span
                                                layoutId="vehicle-step-ring"
                                                className="absolute inset-0 rounded-full ring-2 ring-blue-400/60 ring-offset-2 ring-offset-white dark:ring-blue-500/50 dark:ring-offset-gray-900"
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 380,
                                                    damping: 32,
                                                }}
                                            />
                                        )}
                                        <span
                                            className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                                                isComplete
                                                    ? "border-blue-600 bg-blue-600 text-white"
                                                    : isActive
                                                      ? "border-blue-600 bg-white text-blue-600 dark:bg-gray-900"
                                                      : "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
                                            }`}
                                        >
                                            {isComplete ? (
                                                <Check size={16} />
                                            ) : (
                                                <StepIcon
                                                    size={16}
                                                />
                                            )}
                                        </span>
                                    </span>

                                    <span
                                        className={`hidden text-[11px] font-semibold sm:block ${
                                            isActive
                                                ? "text-blue-600 dark:text-blue-400"
                                                : isComplete
                                                  ? "text-gray-600 dark:text-gray-300"
                                                  : "text-gray-400 dark:text-gray-500"
                                        }`}
                                    >
                                        {step.title}
                                    </span>
                                </button>

                                {index < FORM_STEPS.length - 1 && (
                                    <span
                                        className={`mx-2 h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                                            isComplete
                                                ? "bg-blue-600"
                                                : "bg-gray-200 dark:bg-gray-700"
                                        }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Step {currentStep + 1} of{" "}
                        {FORM_STEPS.length}
                    </p>

                    <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                        {
                            FORM_STEPS[
                                currentStep
                            ].title
                        }
                    </h2>

                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                        {
                            FORM_STEPS[
                                currentStep
                            ].description
                        }
                    </p>
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    variants={STEP_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={STEP_TRANSITION}
                    className="space-y-6"
                >
                    {currentStep === 0 && (
                        <>
                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <IdCard size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Basic Information
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Enter the vehicle's identification and classification details.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="space-y-6">
                                        <Input
                                            label="Registration Number"
                                            name="registrationNumber"
                                            error={getFieldError(
                                                "registrationNumber"
                                            )}
                                            value={
                                                formData.registrationNumber
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode
                                            }
                                        />

                                        <Input
                                            label="Registration Expiration"
                                            name="compliance.licenseExpiration"
                                            type="date"
                                            error={getFieldError(
                                                "compliance.licenseExpiration"
                                            )}
                                            value={
                                                formData
                                                    .compliance
                                                    .licenseExpiration
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                handleNestedChange(
                                                    "compliance",
                                                    "licenseExpiration",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode
                                            }
                                        />
                                    </div>

                                    <Input
                                        label="Plate Number"
                                        name="plateNumber"
                                        error={getFieldError(
                                            "plateNumber"
                                        )}
                                        value={
                                            formData.plateNumber
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                    />

                                    <div className="md:col-span-2">
                                        <IdImageUploadRow
                                            title="Vehicle Documents"
                                            helperText="Upload a clear photo of the Official Receipt (OR) and Certificate of Registration (CR)."
                                            images={[
                                                formData.documents
                                                    .officialReceipt[0] ||
                                                    null,
                                                formData.documents
                                                    .certificateOfRegistration[0] ||
                                                    null,
                                            ]}
                                            onChange={
                                                handleDocumentImagesChange
                                            }
                                            frontLabel="Official Receipt (OR)"
                                            backLabel="Certificate of Registration (CR)"
                                            disabled={
                                                loading ||
                                                isViewMode
                                            }
                                        />

                                        {(getFieldError(
                                            "documents.officialReceipt"
                                        ) ||
                                            getFieldError(
                                                "documents.officialReceipt.url"
                                            ) ||
                                            getFieldError(
                                                "documents.officialReceipt.publicId"
                                            ) ||
                                            getFieldError(
                                                "documents.certificateOfRegistration"
                                            ) ||
                                            getFieldError(
                                                "documents.certificateOfRegistration.url"
                                            ) ||
                                            getFieldError(
                                                "documents.certificateOfRegistration.publicId"
                                            )) && (
                                            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                                                {getFieldError(
                                                    "documents.officialReceipt"
                                                ) ||
                                                    getFieldError(
                                                        "documents.officialReceipt.url"
                                                    ) ||
                                                    getFieldError(
                                                        "documents.officialReceipt.publicId"
                                                    ) ||
                                                    getFieldError(
                                                        "documents.certificateOfRegistration"
                                                    ) ||
                                                    getFieldError(
                                                        "documents.certificateOfRegistration.url"
                                                    ) ||
                                                    getFieldError(
                                                        "documents.certificateOfRegistration.publicId"
                                                    )}
                                            </p>
                                        )}
                                    </div>

                                    <Select
                                        label="Vehicle Type"
                                        name="vehicleType"
                                        error={getFieldError(
                                            "vehicleType"
                                        )}
                                        value={
                                            formData.vehicleType
                                        }
                                        onChange={
                                            handleVehicleTypeChange
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                        options={[
                                            {
                                                label: "Car",
                                                value: "Car",
                                            },
                                            {
                                                label: "Motorcycle",
                                                value: "Motorcycle",
                                            },
                                        ]}
                                    />

                                    <Select
                                        label="Vehicle Category"
                                        name="category"
                                        value={
                                            formData.category
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        options={
                                            categoryOptions
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode ||
                                            !formData.vehicleType
                                        }
                                        helperText={
                                            formData.vehicleType
                                                ? "Only active categories matching the selected vehicle type are displayed."
                                                : "Select a vehicle type first."
                                        }
                                    />

                                    {!isCustom ? (
                                        <Select
                                            label="Brand"
                                            name="brand"
                                            error={getFieldError(
                                                "brand"
                                            )}
                                            value={
                                                formData.brand
                                            }
                                            onChange={
                                                handleBrandChange
                                            }
                                            options={
                                                brandOptions
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode ||
                                                !formData.vehicleType
                                            }
                                            required
                                        />
                                    ) : (
                                        <Input
                                            id="customBrand"
                                            name="customBrand"
                                            label="Brand"
                                            placeholder="Enter brand name"
                                            value={
                                                customBrand
                                            }
                                            onChange={
                                                handleCustomBrandChange
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode
                                            }
                                            required
                                        />
                                    )}

                                    {!isCustom ? (
                                        <Select
                                            label="Model"
                                            name="model"
                                            error={getFieldError(
                                                "model"
                                            )}
                                            value={
                                                formData.model
                                            }
                                            onChange={
                                                handleModelChange
                                            }
                                            options={
                                                modelOptions
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode ||
                                                !formData.brand
                                            }
                                            required
                                        />
                                    ) : (
                                        <Input
                                            id="customModel"
                                            name="customModel"
                                            label="Model"
                                            placeholder="Enter model name"
                                            value={
                                                customModel
                                            }
                                            onChange={
                                                handleCustomModelChange
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode
                                            }
                                            required
                                        />
                                    )}

                                    <div className="md:col-span-2">
                                        <Switch
                                            id="isCustom"
                                            name="isCustom"
                                            label="Others"
                                            helperText="Please specify if brand or model is not in the list"
                                            checked={
                                                isCustom
                                            }
                                            onChange={
                                                handleCustomToggle
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode ||
                                                !formData.vehicleType
                                            }
                                        />
                                    </div>

                                    <Input
                                        label="Variant"
                                        name="variant"
                                        value={
                                            formData.variant
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                    />

                                    <Input
                                        label="Year"
                                        name="year"
                                        type="number"
                                        min="1900"
                                        max={
                                            new Date().getFullYear() +
                                            1
                                        }
                                        error={getFieldError(
                                            "year"
                                        )}
                                        value={
                                            formData.year
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                    />
                                </div>
                            </section>
                        </>
                    )}

                    {currentStep === 1 && (
                        <>
                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <Settings2 size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Specifications
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Configure the technical specifications of this vehicle.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <Select
                                        label="Transmission"
                                        name="specifications.transmission"
                                        error={getFieldError(
                                            "specifications.transmission"
                                        )}
                                        value={
                                            formData
                                                .specifications
                                                .transmission
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "specifications",
                                                "transmission",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                        options={[
                                            {
                                                label: "Automatic",
                                                value: "Automatic",
                                            },
                                            {
                                                label: "Manual",
                                                value: "Manual",
                                            },
                                            {
                                                label: "CVT",
                                                value: "CVT",
                                            },
                                        ]}
                                    />

                                    <Select
                                        label="Fuel Type"
                                        name="specifications.fuelType"
                                        error={getFieldError(
                                            "specifications.fuelType"
                                        )}
                                        value={
                                            formData
                                                .specifications
                                                .fuelType
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "specifications",
                                                "fuelType",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                        options={[
                                            {
                                                label: "Gasoline",
                                                value: "Gasoline",
                                            },
                                            {
                                                label: "Diesel",
                                                value: "Diesel",
                                            },
                                            {
                                                label: "Electric",
                                                value: "Electric",
                                            },
                                            {
                                                label: "Hybrid",
                                                value: "Hybrid",
                                            },
                                        ]}
                                    />

                                    <Input
                                        label="Seating Capacity"
                                        name="specifications.seatingCapacity"
                                        type="number"
                                        error={getFieldError(
                                            "specifications.seatingCapacity"
                                        )}
                                        min="1"
                                        value={
                                            formData
                                                .specifications
                                                .seatingCapacity
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "specifications",
                                                "seatingCapacity",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                    />
                                </div>
                            </section>
                        </>
                    )}

                    {currentStep === 2 && (
                        <>
                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <PhilippinePeso size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Pricing
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Configure rental pricing for this vehicle.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <Input
                                        label="Daily Rate (₱)"
                                        name="pricing.dailyRate"
                                        type="number"
                                        error={getFieldError(
                                            "pricing.dailyRate"
                                        )}
                                        min="0"
                                        step="0.01"
                                        value={
                                            formData
                                                .pricing
                                                .dailyRate
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "pricing",
                                                "dailyRate",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                    />

                                    <Input
                                        label="Reservation Fee (₱)"
                                        name="pricing.reservationFee"
                                        type="number"
                                        error={getFieldError(
                                            "pricing.reservationFee"
                                        )}
                                        min="0"
                                        step="0.01"
                                        value={
                                            formData
                                                .pricing
                                                .reservationFee
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "pricing",
                                                "reservationFee",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        required
                                    />
                                </div>
                            </section>

                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <ShieldCheck size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Security Deposit
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Optionally require a security deposit for rentals of this vehicle.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <Switch
                                        label="Enable Security Deposit"
                                        checked={
                                            formData
                                                .securityDeposit
                                                .enabled
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleSwitchChange(
                                                "securityDeposit",
                                                "enabled",
                                                event
                                                    .target
                                                    .checked
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        helperText="Optional. Enable this only when rentals of this vehicle require a security deposit."
                                    />

                                    <Input
                                        label="Security Deposit Amount (₱)"
                                        name="securityDeposit.amount"
                                        type="number"
                                        error={getFieldError(
                                            "securityDeposit.amount"
                                        )}
                                        min="0"
                                        step="0.01"
                                        value={
                                            formData
                                                .securityDeposit
                                                .amount
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "securityDeposit",
                                                "amount",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode ||
                                            !formData
                                                .securityDeposit
                                                .enabled
                                        }
                                        helperText={
                                            formData
                                                .securityDeposit
                                                .enabled
                                                ? "Enter the amount that will be required as the vehicle security deposit."
                                                : "Optional. Enable the security deposit to enter its amount."
                                        }
                                    />
                                </div>
                            </section>

                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <FileText size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Description
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Provide customer-facing and internal information about this vehicle.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <Textarea
                                        label="Public Description"
                                        error={getFieldError(
                                            "description.public"
                                        )}
                                        value={
                                            formData
                                                .description
                                                .public
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "description",
                                                "public",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        rows={5}
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        helperText="Displayed to customers when viewing the vehicle."
                                    />
                                </div>
                            </section>

                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <Calendar size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Availability
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Configure when this vehicle can accept bookings.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <Switch
                                        label="Booking Enabled"
                                        checked={
                                            formData
                                                .availability
                                                .bookingEnabled
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleSwitchChange(
                                                "availability",
                                                "bookingEnabled",
                                                event
                                                    .target
                                                    .checked
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        helperText="Disable bookings without archiving the vehicle."
                                    />

                                    <Input
                                        label="Available From"
                                        name="availability.availableFrom"
                                        type="date"
                                        value={
                                            formData
                                                .availability
                                                .availableFrom
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            handleNestedChange(
                                                "availability",
                                                "availableFrom",
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                    />
                                </div>
                            </section>

                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <SlidersHorizontal size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Vehicle Settings
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Configure operational settings for this vehicle.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <Select
                                        label="Condition"
                                        name="condition"
                                        error={getFieldError(
                                            "condition"
                                        )}
                                        value={
                                            formData.condition
                                        }
                                        onChange={(
                                            event
                                        ) => {
                                            setFormData(
                                                (
                                                    previous
                                                ) => ({
                                                    ...previous,
                                                    condition:
                                                        event
                                                            .target
                                                            .value,
                                                })
                                            );

                                            if (
                                                hasValidated
                                            ) {
                                                clearFieldErrors(
                                                    "condition"
                                                );
                                            }
                                        }}
                                        disabled={
                                            loading ||
                                            isViewMode
                                        }
                                        options={[
                                            {
                                                label: "Excellent",
                                                value: "Excellent",
                                            },
                                            {
                                                label: "Good",
                                                value: "Good",
                                            },
                                            {
                                                label: "Fair",
                                                value: "Fair",
                                            },
                                            {
                                                label: "Needs Maintenance",
                                                value: "Needs Maintenance",
                                            },
                                        ]}
                                        required
                                    />

                                    <div className="flex items-center">
                                        <Switch
                                            label="Featured Vehicle"
                                            checked={
                                                formData.isFeatured
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                handleSwitchChange(
                                                    null,
                                                    "isFeatured",
                                                    event
                                                        .target
                                                        .checked
                                                )
                                            }
                                            disabled={
                                                loading ||
                                                isViewMode
                                            }
                                            helperText="Featured vehicles can be highlighted throughout the system."
                                        />
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {currentStep === 3 && (
                        <>
                            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                                <div className="mb-6 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        <ImageIcon size={18} />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            Vehicle Images
                                        </h2>

                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            Upload images that will be displayed to customers.
                                        </p>
                                    </div>
                                </div>

                                {getFieldError(
                                    "images"
                                ) && (
                                    <p className="mb-4 text-sm text-red-600 dark:text-red-400">
                                        {getFieldError(
                                            "images"
                                        )}
                                    </p>
                                )}

                                <ImageUploadZone
                                    images={
                                        formData.images
                                    }
                                    onChange={
                                        handleImageChange
                                    }
                                    disabled={
                                        loading ||
                                        isViewMode
                                    }
                                />
                            </section>
                        </>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <ReviewSection
                                title="Vehicle Identity"
                                onEdit={() =>
                                    setCurrentStep(
                                        0
                                    )
                                }
                             >
                                 <div className="grid gap-6 md:grid-cols-2">
                                     <ReviewField
                                         label="Registration Number"
                                         value={
                                             formData.registrationNumber
                                         }
                                     />

                                     <ReviewField
                                         label="Registration Expiration"
                                         value={
                                             formData
                                                 .compliance
                                                 .licenseExpiration ||
                                             "—"
                                         }
                                     />

                                     <ReviewField
                                         label="Plate Number"
                                         value={
                                             formData.plateNumber
                                         }
                                     />

                                     <ReviewField
                                         label="Vehicle Type"
                                         value={
                                             formData.vehicleType
                                         }
                                     />

                                     <ReviewField
                                         label="Category"
                                         value={
                                             categoryOptions.find(
                                                 (
                                                     option
                                                 ) =>
                                                     option.value ===
                                                     formData.category
                                             )?.label ||
                                             "—"
                                         }
                                     />

                                     <ReviewField
                                         label="Brand"
                                         value={
                                             isCustom
                                                 ? customBrand
                                                 : formData.brand
                                         }
                                     />

                                     <ReviewField
                                         label="Model"
                                         value={
                                             isCustom
                                                 ? customModel
                                                 : formData.model
                                         }
                                     />

                                     <ReviewField
                                         label="Variant"
                                         value={
                                             formData.variant
                                         }
                                     />

                                     <ReviewField
                                         label="Year"
                                         value={
                                             formData.year
                                         }
                                     />
                                 </div>
</ReviewSection>

                            <ReviewSection
                                title="Documents"
                                onEdit={() =>
                                    setCurrentStep(0)
                                }
                            >
                                <div className="grid gap-6 md:grid-cols-2">
                                     <ReviewField
                                         label="Official Receipt (OR)"
                                         value={
                                             formData.documents
                                                 .officialReceipt[0]
                                                 ?.originalName ||
                                             "—"
                                         }
                                     />

                                     <ReviewField
                                         label="Certificate of Registration (CR)"
                                         value={
                                             formData.documents
                                                 .certificateOfRegistration[0]
                                                 ?.originalName ||
                                             "—"
                                         }
                                     />
                                 </div>

                                 <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                                     {formData.documents
                                         .officialReceipt[0] && (
                                         <img
                                             src={
                                                 formData.documents
                                                     .officialReceipt[0]
                                                     .url ??
                                                 formData.documents
                                                     .officialReceipt[0]
                                                     .preview
                                             }
                                             alt="Official Receipt"
                                             className="rounded-lg border border-gray-200 object-cover aspect-square dark:border-gray-700"
                                         />
                                     )}

                                     {formData.documents
                                         .certificateOfRegistration[0] && (
                                         <img
                                             src={
                                                 formData.documents
                                                     .certificateOfRegistration[0]
                                                     .url ??
                                                 formData.documents
                                                     .certificateOfRegistration[0]
                                                     .preview
                                             }
                                             alt="Certificate of Registration"
                                             className="rounded-lg border border-gray-200 object-cover aspect-square dark:border-gray-700"
                                         />
                                     )}
                                 </div>
                             </ReviewSection>

                            <ReviewSection
                                title="Specifications"
                                onEdit={() =>
                                    setCurrentStep(
                                        1
                                    )
                                }
                            >
                                <div className="grid gap-6 md:grid-cols-2">
                                    <ReviewField
                                        label="Transmission"
                                        value={
                                            formData
                                                .specifications
                                                .transmission
                                        }
                                    />

                                    <ReviewField
                                        label="Fuel Type"
                                        value={
                                            formData
                                                .specifications
                                                .fuelType
                                        }
                                    />

                                    <ReviewField
                                        label="Seating Capacity"
                                        value={
                                            formData
                                                .specifications
                                                .seatingCapacity
                                        }
                                    />
                                </div>
                            </ReviewSection>

                            <ReviewSection
                                title="Pricing & Description"
                                onEdit={() =>
                                    setCurrentStep(
                                        2
                                    )
                                }
                            >
                                <div className="grid gap-6 md:grid-cols-2">
                                    <ReviewField
                                        label="Daily Rate"
                                        value={
                                            formData
                                                .pricing
                                                .dailyRate ===
                                            null ||
                                            formData
                                                .pricing
                                                .dailyRate ===
                                                "" ||
                                            formData
                                                .pricing
                                                .dailyRate ===
                                                undefined
                                                ? "—"
                                                : `₱${Number(
                                                      formData
                                                          .pricing
                                                          .dailyRate
                                                  ).toLocaleString()}`
                                        }
                                    />

                                    <ReviewField
                                        label="Reservation Fee"
                                        value={
                                            formData
                                                .pricing
                                                .reservationFee ===
                                            null ||
                                            formData
                                                .pricing
                                                .reservationFee ===
                                                "" ||
                                            formData
                                                .pricing
                                                .reservationFee ===
                                                undefined
                                                ? "—"
                                                : `₱${Number(
                                                      formData
                                                          .pricing
                                                          .reservationFee
                                                  ).toLocaleString()}`
                                        }
                                    />

                                    <ReviewField
                                        label="Security Deposit"
                                        value={
                                            formData
                                                .securityDeposit
                                                .enabled
                                                ? "Enabled"
                                                : "Disabled"
                                        }
                                    />

                                    <ReviewField
                                        label="Security Deposit Amount"
                                        value={
                                            formData
                                                .securityDeposit
                                                .enabled &&
                                                formData
                                                    .securityDeposit
                                                    .amount !==
                                                null &&
                                                formData
                                                    .securityDeposit
                                                    .amount !==
                                                    "" &&
                                                formData
                                                    .securityDeposit
                                                    .amount !==
                                                    undefined
                                                ? `₱${Number(
                                                      formData
                                                          .securityDeposit
                                                          .amount
                                                  ).toLocaleString()}`
                                                : "—"
                                        }
                                    />

                                    </div>
                            </ReviewSection>

                            <ReviewSection
                                title="Operations"
                                onEdit={() =>
                                    setCurrentStep(
                                        2
                                    )
                                }
                            >
                                <div className="grid gap-6 md:grid-cols-2">
                                    <ReviewField
                                        label="Condition"
                                        value={
                                            formData.condition
                                        }
                                    />

                                    <ReviewField
                                        label="Booking Enabled"
                                        value={
                                            formData
                                                .availability
                                                .bookingEnabled
                                                ? "Yes"
                                                : "No"
                                        }
                                    />

                                    <ReviewField
                                        label="Featured Vehicle"
                                        value={
                                            formData
                                                .isFeatured
                                                ? "Yes"
                                                : "No"
                                        }
                                    />
                                </div>
                            </ReviewSection>

                            <ReviewSection
                                title="Vehicle Images"
                                onEdit={() =>
                                    setCurrentStep(
                                        3
                                    )
                                }
                            >
                                <ReviewImageGallery
                                    images={
                                        formData.images
                                    }
                                />
                            </ReviewSection>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between border-t border-gray-200 pt-6">
                <div>
                    {currentStep === 0 ? (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onCancel}
                            disabled={loading}
                        >
                            {isViewMode
                                ? "Close"
                                : "Cancel"}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={
                                handlePrevious
                            }
                            disabled={loading}
                        >
                            Previous
                        </Button>
                    )}
                </div>

                <div>
                    {isReviewStep ? (
                        !isViewMode && (
                            <Button
                                type="submit"
                                loading={isSubmitting || loading}
                                disabled={!canSubmit}
                            >
                                {isWizardMode
                                    ? "Continue"
                                    : isEditMode
                                    ? "Update Vehicle"
                                    : "Create Vehicle"}
                            </Button>
                        )
                    ) : (
                        <Button
                            type="button"
                            onClick={
                                handleNext
                            }
                            disabled={isSubmitting || loading}
                        >
                            Next
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
};

export default VehicleForm;