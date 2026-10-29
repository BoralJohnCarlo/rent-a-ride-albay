import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    Link,
    useNavigate,
} from "react-router-dom";

import {
    Check,
    ChevronLeft,
    ChevronRight,
    Contact,
    IdCard,
    Lock,
    ReceiptText,
    Mail,
    Phone,
    ShieldCheck,
    User,
} from "lucide-react";

import {
    REGIONS,
    getProvinces,
    getCities,
    getBarangays,
} from "../../data/philippineLocations";

import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import IdImageUploadRow, {
    SingleImageUpload,
} from "../../components/shared/IdImageUploadRow";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import TermsAgreement from "../../components/booking/TermsAgreement";

import {
    PASSWORD_HINT,
    getNameError,
    getPasswordError,
    getPhoneError,
    getRegistrationErrorField,
    isAlreadyVerifiedError,
    isPastDate,
    isPendingVerificationError,
} from "../../utils/registrationRules";

import useAuth from "../../hooks/auth/useAuth";

import {
    verifyUserEmail,
    resendVerificationEmail as resendVerificationEmailApi,
    loginUser,
} from "../../services/authService";

import { fetchPublicSettings } from "../../services/settingsService";

import {
    uploadValidId,
    uploadProofOfBilling,
    removeTemporaryValidId,
} from "../../services/authService";

import useProofOfBillingEnabled from "../../hooks/settings/useProofOfBillingEnabled";
import useLegalDocument from "../../hooks/legal/useLegalDocument";
import {
    LEGAL_DOCUMENT_TYPES,
    isTermsOutdatedError,
} from "../../constants/legalDocuments";

import image1 from "../../assets/images/slideshow/image1.webp";
import image2 from "../../assets/images/slideshow/image2.webp";
import image3 from "../../assets/images/slideshow/image3.png";
import image4 from "../../assets/images/slideshow/image4.jpg";
import image5 from "../../assets/images/slideshow/image5.png";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";

const REGISTER_IMAGES = [
    image1,
    image2,
    image3,
    image4,
    image5,
];

/*
 * Driver's License listed first and labeled preferred - it's the ID type
 * this platform gets the most value from (it's also what unlocks self-drive
 * bookings), but any of these is accepted.
 */
const VALID_ID_TYPES = [
    "Driver's License",
    "Philippine Passport",
    "SSS ID",
    "PhilHealth ID",
    "Pag-IBIG ID",
    "National ID (PhilSys)",
    "Voter's ID",
    "Postal ID",
    "Senior Citizen ID",
    "PWD ID",
];

const FORM_STEPS = [
    {
        title: "Personal Information",
        description:
            "Tell us a bit about yourself.",
    },
    {
        title: "ID Verification",
        description:
            "Upload your valid ID.",
    },
    {
        title: "Email & Security",
        description:
            "Set up your email and password.",
    },
    {
        title: "Verify Email",
        description:
            "Enter the 6-digit code sent to your email.",
    },
    {
        title: "Complete",
        description: "Your account has been created.",
    },
];

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

const Register = () => {
    const navigate = useNavigate();

    const {
        register,
        loading,
        error,
        clearError,
        isAuthenticated,
    } = useAuth();

    const [formData, setFormData] = useState({
        firstName: "",
        middleName: "",
        lastName: "",
        birthdate: "",
        phoneNumber: "",
        alternativeContact: "",
        password: "",
        confirmPassword: "",
        email: "",
        validIdType: "Driver's License",
        validIdImage: "",
        validIdBack: "",
        licenseNumber: "",
        licenseExpirationDate: "",
        hasDriversLicense: true,
        licenseCodes: [],
        motorcycleTransmission: [],
        carTransmission: [],
        currentAddress: {
            houseUnitLot: "",
            street: "",
            barangay: "",
            cityMunicipality: "",
            province: "",
            postalCode: "",
        },
    });

    const [termsAgreed, setTermsAgreed] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    // The Terms version on show (here and in the pop-up): the one recorded
    // as accepted when the registration is sent.
    const {
        document: termsDocument,
        reload: reloadTerms,
    } = useLegalDocument(LEGAL_DOCUMENT_TYPES.BOOKING_TERMS);

    const [currentStep, setCurrentStep] = useState(0);
    const stepTopRef = useScrollTopOnChange(currentStep);

    const registrationFlowRef = useRef(false);

    const [validationErrors, setValidationErrors] =
        useState({});

    const [idImages, setIdImages] = useState([]);

    const [idUploading, setIdUploading] =
        useState(false);

    /*
     * Proof of billing address: shown and required only while the admin has
     * it on. `billingRequiredByServer` covers the admin turning it on after
     * this form loaded - the server names the field and the form adds it.
     */
    const { enabled: proofOfBillingSetting } =
        useProofOfBillingEnabled();
    const [billingRequiredByServer, setBillingRequiredByServer] =
        useState(false);
    const proofOfBillingEnabled =
        proofOfBillingSetting || billingRequiredByServer;
    const [billingImage, setBillingImage] = useState(null);

    const [isVerifying, setIsVerifying] =
        useState(false);

    const [code, setCode] =
        useState(["", "", "", "", "", ""]);
    const codeInputRefs = useRef([]);
    const [resendCooldown, setResendCooldown] =
        useState(0);
    const [resendDisabled, setResendDisabled] =
        useState(false);
    const [verificationError, setVerificationError] =
        useState(null);
    const [resendError, setResendError] =
        useState(null);
    const resendTimerRef = useRef(null);

    const [currentImage, setCurrentImage] =
        useState(0);

    /*
     * Defaults to true (restriction active) so the form behaves the same as
     * before this setting existed while the actual value is still loading -
     * only flips to hide these fields once we've confirmed the admin turned
     * the restriction off.
     */
    const [licenseRestrictionEnabled, setLicenseRestrictionEnabled] =
        useState(true);

    useEffect(() => {
        let cancelled = false;

        fetchPublicSettings()
            .then((response) => {
                if (cancelled) {
                    return;
                }

                const enabled =
                    response?.data?.licenseRestrictionEnabled;

                if (typeof enabled === "boolean") {
                    setLicenseRestrictionEnabled(enabled);
                }
            })
            .catch(() => {
                // Keep the safe default (restriction enabled) on failure.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        clearError();
    }, [
        clearError,
    ]);

    useEffect(() => {
        return () => {
            if (resendTimerRef.current) {
                window.clearInterval(resendTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
    if (
        isAuthenticated &&
        !registrationFlowRef.current
    ) {
        navigate("/", {
            replace: true,
        });
    }
}, [
    isAuthenticated,
    navigate,
]);

    useEffect(() => {
        if (REGISTER_IMAGES.length <= 1) {
            return undefined;
        }

        REGISTER_IMAGES.forEach((src) => {
            const image = new Image();

            image.src = src;
        });

        const interval = window.setInterval(() => {
            setCurrentImage(
                (previous) =>
                    (previous + 1) %
                    REGISTER_IMAGES.length
            );
        }, 5000);

        return () => {
            window.clearInterval(interval);
        };
    }, []);

    const handleChange = ({
        target,
    }) => {
        const {
            name,
            value,
        } = target;

        if (error) {
            clearError();
        }

        if (
            validationErrors[name]
        ) {
            setValidationErrors(
                (previous) => {
                    const updated = {
                        ...previous,
                    };

                    delete updated[name];

                    return updated;
                }
            );
        }

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    /*
     * Choosing "Driver's License" as the ID type answers the yes/no
     * question implicitly (can't submit a license as your ID while saying
     * you don't have one) - switching to a different type clears any
     * previous answer so the customer has to actually answer it for that
     * ID type, rather than silently inheriting a stale "yes".
     */
    const handleValidIdTypeChange = (event) => {
        const value = event.target.value;

        setFormData((previous) => ({
            ...previous,
            validIdType: value,
            hasDriversLicense:
                value === "Driver's License"
                    ? true
                    : previous.validIdType ===
                      "Driver's License"
                    ? null
                    : previous.hasDriversLicense,
        }));
    };

    const handleHasDriversLicenseChange = (value) => {
        setValidationErrors((previous) => {
            const updated = { ...previous };
            delete updated.hasDriversLicense;
            return updated;
        });

        setFormData((previous) => ({
            ...previous,
            hasDriversLicense: value,
            ...(value
                ? {}
                : {
                      licenseNumber: "",
                      licenseExpirationDate: "",
                      licenseCodes: [],
                      motorcycleTransmission: [],
                      carTransmission: [],
                  }),
        }));
    };

    const handlePhoneNumberChange = (e) => {
        const value = e.target.value.replace(/\D/g, "");
        if (validationErrors.phoneNumber) {
            setValidationErrors((previous) => {
                const updated = { ...previous };
                delete updated.phoneNumber;
                return updated;
            });
        }
        setFormData((previous) => ({
            ...previous,
            phoneNumber: value,
        }));
    };

    const handleLicenseNumberChange = (e) => {
        const raw = e.target.value;
        const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

        if (cleaned.length > 13) {
            return;
        }

        const formatted =
            cleaned.length > 1 && /^[A-Z]$/.test(cleaned[0])
                ? (() => {
                      const letter = cleaned[0];
                      const digits = cleaned.slice(1);
                      let result = letter;
                      if (digits.length >= 1) result += digits.slice(0, 2);
                      if (digits.length >= 3) result += "-" + digits.slice(2, 4);
                      if (digits.length >= 5) result += "-" + digits.slice(4);
                      return result;
                  })()
                : cleaned;

        if (validationErrors.licenseNumber) {
            setValidationErrors((previous) => {
                const updated = { ...previous };
                delete updated.licenseNumber;
                return updated;
            });
        }

        setFormData((previous) => ({
            ...previous,
            licenseNumber: formatted,
        }));
    };

    const handleLicenseCodesChange = (code, checked) => {
        setFormData((previous) => {
            const updatedCodes = checked
                ? [...previous.licenseCodes, code]
                : previous.licenseCodes.filter((c) => c !== code);
            const updatedData = {
                ...previous,
                licenseCodes: updatedCodes,
            };
            if (!checked) {
                if (code === "A") {
                    updatedData.motorcycleTransmission = [];
                } else if (code === "B") {
                    updatedData.carTransmission = [];
                }
            }
            return updatedData;
        });
    };

    const handleMotorcycleTransmissionChange = (value) => {
        setFormData((previous) => {
            const current = previous.motorcycleTransmission;
            if (current.length === 2) {
                return { ...previous, motorcycleTransmission: [] };
            }
            if (value === "manual") {
                if (current.includes("manual")) {
                    return {
                        ...previous,
                        motorcycleTransmission: current.filter((t) => t !== "manual"),
                    };
                }
                return {
                    ...previous,
                    motorcycleTransmission: [...current, "manual", "automatic"],
                };
            }
            if (current.includes(value)) {
                return {
                    ...previous,
                    motorcycleTransmission: current.filter((t) => t !== value),
                };
            }
            return {
                ...previous,
                motorcycleTransmission: [...current, value],
            };
        });
    };

    const handleCarTransmissionChange = (value) => {
        setFormData((previous) => {
            const current = previous.carTransmission;
            if (current.length === 2) {
                return { ...previous, carTransmission: [] };
            }
            if (value === "manual") {
                if (current.includes("manual")) {
                    return {
                        ...previous,
                        carTransmission: current.filter((t) => t !== "manual"),
                    };
                }
                return {
                    ...previous,
                    carTransmission: [...current, "manual", "automatic"],
                };
            }
            if (current.includes(value)) {
                return {
                    ...previous,
                    carTransmission: current.filter((t) => t !== value),
                };
            }
            return {
                ...previous,
                carTransmission: [...current, value],
            };
        });
    };

    const isMotorcycleTransmissionSelected = (type) => {
        return formData.motorcycleTransmission.includes(type);
    };

    const isCarTransmissionSelected = (type) => {
        return formData.carTransmission.includes(type);
    };

    const handleIdImagesChange = (
        images
    ) => {
        const [front, back] = images;

        setIdImages(images);

        setFormData(
            (previous) => ({
                ...previous,
                validIdImage: front
                    ? front.url ||
                      front.publicId ||
                      front.preview ||
                      ""
                    : "",
                validIdBack: back
                    ? back.url ||
                      back.publicId ||
                      back.preview ||
                      ""
                    : "",
            })
        );

        if (
            validationErrors.validIdImage ||
            validationErrors.validIdBack
        ) {
            setValidationErrors(
                (previous) => {
                    const updated = {
                        ...previous,
                    };

                    if (
                        updated.validIdImage
                    ) {
                        delete updated.validIdImage;
                    }

                    if (
                        updated.validIdBack
                    ) {
                        delete updated.validIdBack;
                    }

                    return updated;
                }
            );
        }
    };

    const validateStep = () => {
        const errors = {};

        switch (currentStep) {
            case 0:
                {
                    const nameErrors = {
                        firstName: getNameError(
                            formData.firstName,
                            "First name"
                        ),
                        middleName: getNameError(
                            formData.middleName,
                            "Middle name",
                            { required: false }
                        ),
                        lastName: getNameError(
                            formData.lastName,
                            "Last name"
                        ),
                    };

                    Object.entries(nameErrors).forEach(([field, message]) => {
                        if (message) {
                            errors[field] = message;
                        }
                    });
                }

                if (
                    !formData.birthdate
                ) {
                    errors.birthdate =
                        "Birthdate is required.";
                } else {
                    const [
                        year,
                        month,
                        day,
                    ] = formData.birthdate
                        .split("-")
                        .map(Number);

                    const birthdate =
                        new Date(
                            year,
                            month -
                                1,
                            day
                        );

                    const today =
                        new Date();

                    today.setHours(
                        0,
                        0,
                        0,
                        0
                    );

                    if (
                        birthdate >=
                        today
                    ) {
                        errors.birthdate =
                            "Birthdate cannot be in the future.";
                    } else {
                        const age =
                            today.getFullYear() -
                            birthdate.getFullYear();

                        const monthDiff =
                            today.getMonth() -
                            birthdate.getMonth();

                        const dayDiff =
                            today.getDate() -
                            birthdate.getDate();

                        const isOver18 =
                            age > 18 ||
                            (age === 18 &&
                                monthDiff >
                                    0) ||
                            (age ===
                                18 &&
                                monthDiff ===
                                    0 &&
                                dayDiff >=
                                    0);

                        if (
                            !isOver18
                        ) {
                            errors.birthdate =
                                "You must be at least 18 years old.";
                        }
                    }
                }

                {
                    const phoneError = getPhoneError(
                        formData.phoneNumber
                    );

                    if (phoneError) {
                        errors.phoneNumber = phoneError;
                    }
                }

                // Address validation
                if (
                    !formData.currentAddress.barangay.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        barangay: "Barangay is required.",
                    };
                }

                if (
                    !formData.currentAddress.cityMunicipality.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        cityMunicipality: "City/Municipality is required.",
                    };
                }

                if (
                    !formData.currentAddress.province.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        province: "Province is required.",
                    };
                }

                if (
                    !formData.currentAddress.postalCode.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        postalCode: "Postal Code is required.",
                    };
                } else if (
                    !/^\d{4}$/.test(
                        formData.currentAddress.postalCode.trim()
                    )
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        postalCode: "Postal Code must be exactly 4 digits.",
                    };
                }

                if (!formData.currentAddress.region) {
                    errors.region = "Region is required.";
                }

                break;

            case 1: {
                if (
                    !formData.validIdType
                ) {
                    errors.validIdType =
                        "Please select a valid ID type.";
                }

                if (!idImages[0]?.file && !formData.validIdImage) {
                    errors.validIdImage =
                        "Valid ID front image is required.";
                }

                if (!idImages[1]?.file && !formData.validIdBack) {
                    errors.validIdBack =
                        "Valid ID back image is required.";
                }

                if (proofOfBillingEnabled && !billingImage?.file) {
                    errors.proofOfBillingImage =
                        "Proof of billing address is required.";
                }

                if (formData.hasDriversLicense === null) {
                    errors.hasDriversLicense =
                        "Please let us know if you have a driver's license.";
                }

                const hasLicense =
                    formData.hasDriversLicense === true;

                if (hasLicense) {
                    if (
                        !formData.licenseNumber
                    ) {
                        errors.licenseNumber =
                            "License number is required.";
                    }

                    if (
                        !formData.licenseExpirationDate
                    ) {
                        errors.licenseExpirationDate =
                            "Expiration date is required.";
                    } else if (
                        isPastDate(formData.licenseExpirationDate)
                    ) {
                        errors.licenseExpirationDate =
                            "Your driver's license has already expired. Please renew it, or register without a license for now.";
                    }

                    if (licenseRestrictionEnabled) {
                        if (
                            !formData.licenseCodes ||
                            formData.licenseCodes.length === 0
                        ) {
                            errors.licenseCodes =
                                "Please select at least one driving category.";
                        }

                        if (
                            formData.licenseCodes.includes("A") &&
                            (!formData.motorcycleTransmission ||
                                formData.motorcycleTransmission.length === 0)
                        ) {
                            errors.motorcycleTransmission =
                                "Please select your motorcycle transmission.";
                        }

                        if (
                            formData.licenseCodes.includes("B") &&
                            (!formData.carTransmission ||
                                formData.carTransmission.length === 0)
                        ) {
                            errors.carTransmission =
                                "Please select your car transmission.";
                        }
                    }
                }

                break;
            }

            case 2:
                if (
                    !formData.email.trim()
                ) {
                    errors.email =
                        "Email is required.";
                } else                 if (
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                        formData.email
                    )
                ) {
                    errors.email =
                        "Email must include an @ symbol and a domain (e.g., user@example.com).";
                }

                {
                    const passwordError = getPasswordError(
                        formData.password
                    );

                    if (passwordError) {
                        errors.password = passwordError;
                    }
                }

                if (!termsAgreed) {
                    errors.termsAgreed =
                        "Please agree to the Terms and Conditions and the Privacy Notice.";
                }

                if (
                    !formData.confirmPassword
                ) {
                    errors.confirmPassword =
                        "Please confirm your password.";
                } else if (
                    formData.password !==
                        formData.confirmPassword
                ) {
                    errors.confirmPassword =
                        "Passwords do not match.";
                }

                break;

            default:
                break;
        }

        setValidationErrors(errors);

        const hasErrors = (obj) => {
            if (!obj || typeof obj !== "object") return false;
            for (const key of Object.keys(obj)) {
                const value = obj[key];
                if (typeof value === "string" && value) return true;
                if (typeof value === "object" && hasErrors(value)) return true;
            }
            return false;
        };

        if (hasErrors(errors)) {
            return false;
        }

        return true;
    };

    const handleNext = () => {
        if (!validateStep()) {
            return;
        }

        setCurrentStep(
            (previous) =>
                previous + 1
        );
    };

    const handlePrevious = () => {
        setCurrentStep(
            (previous) =>
                previous - 1
        );
    };

    const verifyCode = async () => {
        if (
            isVerifying ||
            code.some((digit) => digit === "")
        ) {
            return;
        }

        setVerificationError(null);
        setResendError(null);
        setIsVerifying(true);

        try {
            await verifyUserEmail(
                formData.email,
                code.join("")
            );

            /*
             * The account exists from here on. Signing in is a convenience:
             * if it fails (e.g. the code was for an earlier registration
             * with a different password), the success step still shows,
             * with its "Go to Login" button.
             */
            try {
                await loginUser({
                    email: formData.email,
                    password: formData.password,
                });
            } catch {
                // Not an error here — fall through to the success step.
                clearError();
            }

            setCurrentStep(
                (previous) =>
                    previous + 1
            );
        } catch (err) {
            const message =
                err.response?.data?.message ||
                "Verification failed. Please try again.";

            // The code was already used (e.g. submitted twice): the account
            // exists, so this is the success step, not an error.
            if (isAlreadyVerifiedError(message)) {
                setCurrentStep((previous) => previous + 1);

                return;
            }

            setVerificationError(message);
        } finally {
            setIsVerifying(false);
        }
    };

    const startResendCooldown = () => {
        if (resendTimerRef.current) {
            window.clearInterval(resendTimerRef.current);
        }

        setResendDisabled(true);
        setResendCooldown(60);

        resendTimerRef.current = window.setInterval(() => {
            setResendCooldown((previous) => {
                if (previous <= 1) {
                    window.clearInterval(resendTimerRef.current);
                    resendTimerRef.current = null;
                    setResendDisabled(false);
                    return 0;
                }

                return previous - 1;
            });
        }, 1000);
    };

    const resendCode = async () => {
        if (resendDisabled) {
            return;
        }

        setResendError(null);
        startResendCooldown();

        try {
            await resendVerificationEmailApi(
                formData.email
            );
        } catch (err) {
            setResendError(
                err.response?.data?.message ||
                    "Failed to resend code. Please try again."
            );
            setResendDisabled(false);
            setResendCooldown(0);
            if (resendTimerRef.current) {
                window.clearInterval(resendTimerRef.current);
                resendTimerRef.current = null;
            }
            return;
        }

    };

    const handleSubmit = async () => {
        if (
            !validateStep() ||
            loading
        ) {
            return;
        }

        registrationFlowRef.current = true;

        /*
         * The ID images are uploaded fresh on every attempt and the chosen
         * files stay in `idImages` — never swapped for the uploaded URLs. A
         * failed attempt deletes its uploads (below), so keeping those URLs
         * around would make the next attempt register images that no longer
         * exist.
         */
        const temporaryUploadIds = [];

        const discardUploads = () =>
            Promise.all(
                temporaryUploadIds.map((uploadId) =>
                    removeTemporaryValidId(uploadId).catch(() => undefined)
                )
            );

        const uploadIdImage = async (index, field, message) => {
            if (!idImages[index]?.file) {
                return formData[field];
            }

            try {
                const response = await uploadValidId(
                    idImages[index].file
                );

                if (response?.data?.uploadId) {
                    temporaryUploadIds.push(response.data.uploadId);
                }

                return response?.data?.url || "";
            } catch {
                setValidationErrors({ [field]: message });

                return null;
            }
        };

        try {
            setIdUploading(true);

            const validIdImageUrl = await uploadIdImage(
                0,
                "validIdImage",
                "Failed to upload valid ID front image. Please try again."
            );

            const validIdBackUrl =
                validIdImageUrl === null
                    ? null
                    : await uploadIdImage(
                          1,
                          "validIdBack",
                          "Failed to upload valid ID back image. Please try again."
                      );

            let proofOfBillingUrl = "";

            if (
                validIdBackUrl !== null &&
                proofOfBillingEnabled &&
                billingImage?.file
            ) {
                try {
                    const response = await uploadProofOfBilling(
                        billingImage.file
                    );

                    if (response?.data?.uploadId) {
                        temporaryUploadIds.push(response.data.uploadId);
                    }

                    proofOfBillingUrl = response?.data?.url || "";
                } catch {
                    setValidationErrors({
                        proofOfBillingImage:
                            "Failed to upload proof of billing address. Please try again.",
                    });

                    proofOfBillingUrl = null;
                }
            }

            setIdUploading(false);

            if (
                validIdImageUrl === null ||
                validIdBackUrl === null ||
                proofOfBillingUrl === null
            ) {
                await discardUploads();
                registrationFlowRef.current = false;

                return;
            }

            const payload = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                password: formData.password,
                phoneNumber: formData.phoneNumber.trim(),
                alternativeContact: formData.alternativeContact.trim(),
                middleName: formData.middleName.trim(),
                birthdate: formData.birthdate,
                validIdType: formData.validIdType,
                validIdImage: validIdImageUrl,
                validIdBack: validIdBackUrl,
                proofOfBillingImage: proofOfBillingUrl,
                licenseNumber: formData.licenseNumber.trim(),
                licenseExpirationDate: formData.licenseExpirationDate,
                hasDriversLicense: formData.hasDriversLicense,
                licenseCodes: formData.licenseCodes,
                motorcycleTransmission: formData.motorcycleTransmission,
                carTransmission: formData.carTransmission,
                currentAddress: formData.currentAddress,
                temporaryUploadIds,
                termsAgreed,
                termsVersionId: termsDocument?._id ?? null,
            };

            await register(payload);

            startResendCooldown();

            setCurrentStep(
                (previous) => previous + 1
            );
        } catch (err) {
            setIdUploading(false);
            await discardUploads();
            registrationFlowRef.current = false;

            const errorMessage =
                typeof err === "string"
                    ? err
                    : err.response?.data?.message || err.message || "";

            // Only a registration still awaiting its code has one to enter;
            // a verified account keeps the error ("please log in") shown.
            if (isPendingVerificationError(errorMessage)) {
                clearError();
                startResendCooldown();
                setCurrentStep((previous) => previous + 1);

                return;
            }

            // The terms were updated since this form loaded: show the new
            // version and ask for the box to be ticked again.
            if (isTermsOutdatedError(errorMessage)) {
                clearError();
                setTermsAgreed(false);
                reloadTerms();
                setValidationErrors({ termsAgreed: errorMessage });
                setCurrentStep(2);

                return;
            }

            // A problem with the phone number is fixed on the first step.
            if (getRegistrationErrorField(errorMessage) === "phoneNumber") {
                clearError();
                setValidationErrors({ phoneNumber: errorMessage });
                setCurrentStep(0);
            }

            // Proof of billing was turned on after this form loaded.
            if (
                getRegistrationErrorField(errorMessage) ===
                "proofOfBillingImage"
            ) {
                clearError();
                setBillingRequiredByServer(true);
                setValidationErrors({ proofOfBillingImage: errorMessage });
                setCurrentStep(1);
            }
        }
    };

    const getFieldError = (path) => {
        const keys = path.split(".");
        let value = validationErrors;
        for (const key of keys) {
            if (!value || typeof value !== "object") return "";
            value = value[key];
        }
        return value || "";
    };

    return (
        <div className="relative min-h-screen w-full overflow-x-hidden bg-[#f3f1ec] dark:bg-gray-950">
            {/* Background slideshow */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <AnimatePresence initial={false}>
                    <motion.img
                        key={currentImage}
                        src={REGISTER_IMAGES[currentImage]}
                        alt=""
                        initial={{ opacity: 0, scale: 1.03 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.01 }}
                        transition={{
                            opacity: {
                                duration: 1.4,
                                ease: "easeInOut",
                            },
                            scale: {
                                duration: 6,
                                ease: "linear",
                            },
                        }}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                </AnimatePresence>

                <div className="absolute inset-0 bg-gray-950/55" />
                <div className="absolute inset-0 bg-gradient-to-br from-gray-950/70 via-gray-950/45 to-yellow-950/15" />
            </div>

            {/* Main registration card */}
            <div className="relative z-10 flex min-h-screen items-start justify-center px-3 pb-4 pt-20 sm:px-5 sm:pb-5 sm:pt-20 lg:px-8 lg:pt-20">
                <div className="h-[480px] max-h-[calc(100vh-96px)] w-full max-w-[660px] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10">
                    <div className="flex h-full min-h-0 flex-col lg:flex-row">
                            {/* Sidebar / Stepper */}
                            <aside className="relative w-full shrink-0 overflow-hidden bg-[#f8f7f3] px-4 py-4 sm:px-5 sm:py-4 lg:h-full lg:w-[27%] lg:px-5 lg:py-5 dark:bg-gray-900">
<div className="absolute -bottom-24 -left-16 h-44 w-44 rounded-full border-[28px] border-gray-200/60 dark:border-gray-700/60" />
                                 <div className="absolute -bottom-32 left-12 h-44 w-44 rounded-full border-[28px] border-gray-200/40 dark:border-gray-700/40" />

                                <div className="relative z-10 flex h-full flex-col">
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h1 className="text-sm font-bold tracking-tight text-gray-950 dark:text-gray-100 sm:text-base">
                                                Create Your Account
                                            </h1>
                                        </div>

                                        <p className="mt-1 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                                            Complete the steps to get started.
                                        </p>
                                    </div>

                                    {/* Desktop / tablet vertical stepper */}
                                    <div className="mt-5 hidden sm:block lg:mt-4">
                                        {FORM_STEPS.map((step, index) => {
                                            const isActive = currentStep === index;
                                            const isComplete = currentStep > index;

                                            return (
                                                <div key={step.title} className="flex min-h-[48px]">
                                                    <div className="mr-2 flex w-6 flex-col items-center">
                                                        <motion.div
                                                            animate={{
                                                                scale: isActive ? 1.05 : 1,
                                                            }}
                                                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold transition-all ${
                                                                isComplete
                                                                    ? "border-yellow-500 bg-yellow-500 text-gray-950"
                                                               : isActive
                                                                       ? "border-yellow-500 bg-white text-yellow-600 dark:bg-gray-800 dark:text-yellow-400"
                                                                       : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800"
                                                            }`}
                                                        >
                                                            {isComplete ? (
                                                                <Check size={13} strokeWidth={2.5} />
                                                            ) : (
                                                                index + 1
                                                            )}
                                                        </motion.div>

                                                        {index < FORM_STEPS.length - 1 && (
                                                            <div
                                                                className={`mt-1 w-px flex-1 ${
                                                                    currentStep > index
                                                                        ? "bg-yellow-400"
                                                                        : "bg-gray-300"
                                                                }`}
                                                            />
                                                        )}
                                                    </div>

                                                    <div className="pb-1.5 pt-0.5">
                                                        <p
                                                            className={`text-[11px] font-semibold ${
                                                                isActive || isComplete
                                                                    ? "text-gray-900 dark:text-gray-100"
                                                                    : "text-gray-400"
                                                            }`}
                                                        >
                                                            {step.title}
                                                        </p>
                                                        <p
                                                            className={`mt-0.5 text-[8px] leading-3 ${
                                                                isActive
                                                                    ? "text-gray-500"
                                                                    : "text-gray-400"
                                                            }`}
                                                        >
                                                            {step.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Mobile stepper */}
                                    <div className="mt-5 sm:hidden">
                                        <div className="flex items-center">
                                            {FORM_STEPS.map((step, index) => {
                                                const isActive = currentStep === index;
                                                const isComplete = currentStep > index;

                                                return (
                                                    <div
                                                        key={step.title}
                                                        className="flex flex-1 items-center"
                                                    >
                                                        <div
                                                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ${
                                                                isComplete
                                                                    ? "border-yellow-500 bg-yellow-500 text-gray-950"
                                                                    : isActive
                                                                      ? "border-yellow-500 bg-white text-yellow-600 dark:bg-gray-800 dark:text-yellow-400"
                                                                      : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800"
                                                            }`}
                                                        >
                                                            {isComplete ? (
                                                                <Check size={13} />
                                                            ) : (
                                                                index + 1
                                                            )}
                                                        </div>

                                                        {index < FORM_STEPS.length - 1 && (
                                                            <div
                                                                className={`mx-1 h-px flex-1 ${
                                                                    currentStep > index
                                                                        ? "bg-yellow-400"
                                                                        : "bg-gray-300"
                                                                }`}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-2">
                                            <p className="text-[11px] font-semibold text-gray-900">
                                                {FORM_STEPS[currentStep].title}
                                            </p>
<p className="text-[9px] text-gray-500 dark:text-gray-400">
                                                {FORM_STEPS[currentStep].description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-auto hidden pt-3 sm:block">
                                        <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                            Already have an account?
                                        </p>
                                        <Link
                                            to="/login"
                                            className="mt-0.5 inline-flex text-[9px] font-semibold text-gray-700 transition-colors hover:text-yellow-600 hover:underline dark:text-gray-300"
                                        >
                                            Back to login
                                        </Link>
                                    </div>
                                </div>
                            </aside>

                            {/* Form */}
                            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6 lg:py-4">
                                <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col">
                                    {error && (
                                        <Alert
                                            variant="error"
                                            message={error}
                                            className="mb-3"
                                        />
                                    )}

                                    <div className="mb-2.5 shrink-0 sm:mb-3">
                                        <div className="mb-1.5 flex items-center gap-2">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-100 text-yellow-700">
                                                {currentStep === 0 && <User size={15} />}
                                                {currentStep === 1 && <ShieldCheck size={15} />}
                                                {currentStep === 2 && <Lock size={15} />}
                                                {currentStep === 3 && <Mail size={15} />}
                                            </div>
                                            <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-gray-400">
                                                Step {currentStep + 1} of {FORM_STEPS.length}
                                            </span>
                                        </div>

                                        <h2 className="text-[15px] font-bold tracking-tight text-gray-950 dark:text-gray-100 sm:text-base">
                                            {FORM_STEPS[currentStep].title}
                                        </h2>

                                        <p className="mt-0.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400 sm:text-xs">
                                            {FORM_STEPS[currentStep].description}
                                        </p>
                                    </div>

                                    {/* Separator between step header and step content */}
                                    <div className="mb-3 shrink-0 border-b border-gray-200 dark:border-gray-700" />

                                    <div ref={stepTopRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [&_label]:text-xs [&_h3]:text-[13px] [&_p]:text-[11px] [&_input]:py-2 [&_input]:text-[13px] [&_[role=combobox]]:py-2 [&_[role=combobox]]:text-[13px] [&_.space-y-2]:space-y-1">
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.div
                                                key={currentStep}
                                                variants={STEP_VARIANTS}
                                                initial="initial"
                                                animate="animate"
                                                exit="exit"
                                                transition={STEP_TRANSITION}
                                                className="flex min-h-full w-full flex-col justify-center"
                                            >
                                            {currentStep === 0 && (
                                                <div className="w-full space-y-1.5">
                                                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 sm:grid-cols-2">
                                                        <Input
                                                            id="firstName"
                                                            name="firstName"
                                                            label="First Name"
                                                            placeholder="Enter first name"
                                                            value={formData.firstName}
                                                            onChange={handleChange}
                                                            autoComplete="given-name"
                                                            leftIcon={<User size={17} />}
                                                            error={getFieldError("firstName")}
                                                            required
                                                        />

                                                        <Input
                                                            id="lastName"
                                                            name="lastName"
                                                            label="Last Name"
                                                            placeholder="Enter last name"
                                                            value={formData.lastName}
                                                            onChange={handleChange}
                                                            autoComplete="family-name"
                                                            leftIcon={<User size={17} />}
                                                            error={getFieldError("lastName")}
                                                            required
                                                        />

                                                        <Input
                                                            id="middleName"
                                                            name="middleName"
                                                            label="Middle Name"
                                                            placeholder="Optional"
                                                            value={formData.middleName}
                                                            onChange={handleChange}
                                                            autoComplete="additional-name"
                                                            leftIcon={<User size={17} />}
                                                            error={getFieldError("middleName")}
                                                        />

                                                        <Input
                                                            id="birthdate"
                                                            name="birthdate"
                                                            type="date"
                                                            label="Birthdate"
                                                            value={formData.birthdate}
                                                            onChange={handleChange}
                                                            max={
                                                                new Date(
                                                                    new Date().getTime() -
                                                                        new Date().getTimezoneOffset() * 60000
                                                                )
                                                                    .toISOString()
                                                                    .split("T")[0]
                                                            }
                                                            error={getFieldError("birthdate")}
                                                            required
                                                        />

                                                        <Input
                                                             id="phoneNumber"
                                                             name="phoneNumber"
                                                             type="tel"
                                                             label="Phone Number"
                                                             placeholder="09XXXXXXXXX"
                                                             value={formData.phoneNumber}
                                                             onChange={handlePhoneNumberChange}
                                                             autoComplete="tel"
                                                             leftIcon={<Phone size={17} />}
                                                             error={getFieldError("phoneNumber")}
                                                             required
                                                         />

                                                               <Input
                                                            id="alternativeContact"
                                                            name="alternativeContact"
                                                            label="Alternative Contact"
                                                            placeholder=""
                                                            value={formData.alternativeContact}
                                                            onChange={handleChange}
                                                            autoComplete="off"
                                                            leftIcon={<Contact size={17} />}
                                                        />
                                                    </div>

                                                    <div className="mt-4">
                                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                            Current Address
                                                            <span className="ml-1 text-red-500">*</span>
                                                        </h3>
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            Provide your current residential address.
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 sm:grid-cols-3">
                                                        <Input
                                                            id="currentAddress.houseUnitLot"
                                                            name="currentAddress.houseUnitLot"
                                                            label="House/Unit/Lot No."
                                                            placeholder="123"
                                                            value={formData.currentAddress.houseUnitLot}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        houseUnitLot: value,
                                                                    },
                                                                }));
                                                            }}
                                                        />

                                                        <Input
                                                            id="currentAddress.street"
                                                            name="currentAddress.street"
                                                            label="Street"
                                                            placeholder="Main Street"
                                                            value={formData.currentAddress.street}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        street: value,
                                                                    },
                                                                }));
                                                            }}
                                                        />

<Select
                                                              id="currentAddress.region"
                                                              name="currentAddress.region"
                                                              label="Region"
                                                              value={formData.currentAddress.region}
                                                              onChange={(e) => {
                                                                 const value = e.target.value;
                                                                 setFormData((prev) => ({
                                                                     ...prev,
                                                                     currentAddress: {
                                                                         ...prev.currentAddress,
                                                                         region: value,
                                                                         province: "",
                                                                         cityMunicipality: "",
                                                                         barangay: "",
                                                                     },
                                                                 }));
                                                                 if (error) clearError();
                                                                 if (validationErrors.region) {
                                                                     setValidationErrors((prev) => {
                                                                         const updated = { ...prev };
                                                                         delete updated.region;
                                                                         return updated;
                                                                     });
                                                                 }
                                                              }}
                                                             options={REGIONS.map((r) => ({
                                                                 value: r,
                                                                 label: r,
                                                             }))}
                                                             placeholder="Select region"
                                                             error={getFieldError("region")}
                                                             required
                                                             fullOptionText
                                                         />

                                                        <Select
                                                            id="currentAddress.province"
                                                            label="Province"
                                                            value={formData.currentAddress.province}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        province: value,
                                                                        cityMunicipality: "",
                                                                        barangay: "",
                                                                    },
                                                                }));
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
options={formData.currentAddress.region
                                                                 ? getProvinces(formData.currentAddress.region).map((p) => ({
                                                                       value: p,
                                                                       label: p,
                                                                   }))
                                                                 : []}
                                                            placeholder="Select province"
                                                            error={getFieldError("currentAddress.province")}
                                                            required
                                                            fullOptionText
                                                            disabled={!formData.currentAddress.region}
                                                        />

                                                        <Select
                                                            id="currentAddress.cityMunicipality"
                                                            label="City/Municipality"
                                                            value={formData.currentAddress.cityMunicipality}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        cityMunicipality: value,
                                                                        barangay: "",
                                                                    },
                                                                }));
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
options={formData.currentAddress.province
                                                                 ? getCities(formData.currentAddress.region, formData.currentAddress.province).map((c) => ({
                                                                       value: c,
                                                                       label: c,
                                                                   }))
                                                                 : []}
                                                            placeholder="Select city"
                                                            error={getFieldError("currentAddress.cityMunicipality")}
                                                            required
                                                            fullOptionText
                                                            disabled={!formData.currentAddress.province}
                                                        />

                                                        <Select
                                                            id="currentAddress.barangay"
                                                            label="Barangay"
                                                            value={formData.currentAddress.barangay}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        barangay: value,
                                                                    },
                                                                }));
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
options={formData.currentAddress.cityMunicipality
                                                                 ? getBarangays(formData.currentAddress.region, formData.currentAddress.province, formData.currentAddress.cityMunicipality).map((b) => ({
                                                                      value: b,
                                                                      label: b,
                                                                  }))
                                                                : []}
                                                            placeholder="Select barangay"
                                                            error={getFieldError("currentAddress.barangay")}
                                                            required
                                                            fullOptionText
                                                            disabled={!formData.currentAddress.cityMunicipality}
                                                        />

                                                        <Input
                                                            id="currentAddress.postalCode"
                                                            name="currentAddress.postalCode"
                                                            label="Postal Code"
                                                            placeholder="1234"
                                                            value={formData.currentAddress.postalCode}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        postalCode: value,
                                                                    },
                                                                }));
                                                            }}
                                                            error={getFieldError("currentAddress.postalCode")}
                                                            required
                                                        />
                                                    </div>

                                                    <div className="flex justify-end pt-0.5">
                                                        <Button
                                                            type="button"
                                                            onClick={handleNext}
                                                            rightIcon={<ChevronRight size={16} />}
                                                            className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300"
                                                        >
                                                            Continue
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

{currentStep === 1 && (
                                                <div className="w-full space-y-1.5">
                                                    <Select
                                                        label="Valid ID Type"
                                                        name="validIdType"
                                                        value={formData.validIdType}
                                                        onChange={handleValidIdTypeChange}
                                                        options={VALID_ID_TYPES.map((type) => ({
                                                            label:
                                                                type === "Driver's License"
                                                                    ? "Driver's License (Preferred)"
                                                                    : type,
                                                            value: type,
                                                        }))}
                                                        placeholder="Select ID type"
                                                        leftIcon={<IdCard size={17} />}
                                                        error={getFieldError("validIdType")}
                                                        required
                                                    />

                                                    {formData.validIdType &&
                                                        formData.validIdType !== "Driver's License" && (
                                                        <div className="space-y-1.5">
                                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                                Do you have a driver's license?
                                                                <span className="ml-1 text-red-500">*</span>
                                                            </h3>

                                                            <div className="grid grid-cols-2 gap-2.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleHasDriversLicenseChange(true)}
                                                                    className={`rounded-lg border p-2.5 text-sm font-medium transition-all duration-200 ${
                                                                        formData.hasDriversLicense === true
                                                                            ? "border-yellow-400 bg-yellow-50/50 ring-1 ring-yellow-400 dark:bg-yellow-900/20"
                                                                            : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/50"
                                                                    }`}
                                                                >
                                                                    Yes
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleHasDriversLicenseChange(false)}
                                                                    className={`rounded-lg border p-2.5 text-sm font-medium transition-all duration-200 ${
                                                                        formData.hasDriversLicense === false
                                                                            ? "border-yellow-400 bg-yellow-50/50 ring-1 ring-yellow-400 dark:bg-yellow-900/20"
                                                                            : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/50"
                                                                    }`}
                                                                >
                                                                    No
                                                                </button>
                                                            </div>

                                                            {getFieldError("hasDriversLicense") && (
                                                                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                                                                    {getFieldError("hasDriversLicense")}
                                                                </p>
                                                            )}

                                                            {formData.hasDriversLicense === false && (
                                                                <p className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                                                                    You'll only be able to book vehicles with a driver until you add a license to your profile.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-700 dark:bg-gray-800/60">
                                                        <div className="mb-2 flex items-start gap-2">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-yellow-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-yellow-400 dark:ring-gray-700">
                                                                <IdCard size={16} />
                                                            </div>

                                                            <div>
                                                                 <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                                                                     {formData.validIdType
                                                                         ? `Upload your ${formData.validIdType.toLowerCase()}`
                                                                         : "Upload your valid ID"}
                                                                 </p>
                                                                 <p className="mt-0.5 text-[10px] leading-4 text-gray-500">
                                                                     Upload the front first, then the back.
                                                                 </p>
                                                            </div>
                                                        </div>

                                                        <IdImageUploadRow
                                                            images={idImages}
                                                            onChange={handleIdImagesChange}
                                                            disabled={idUploading || loading}
                                                            title="Upload Valid ID"
                                                            helperText="Front and back images are required."
                                                        />

                                                        {idImages.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    idImages
                                                                        .map((image) => image.temporaryUploadId)
                                                                        .filter(Boolean)
                                                                        .forEach((uploadId) => {
                                                                            removeTemporaryValidId(uploadId).catch(() => undefined);
                                                                        });
                                                                    setIdImages([]);
                                                                    setFormData((previous) => ({
                                                                        ...previous,
                                                                        validIdImage: "",
                                                                        validIdBack: "",
                                                                    }));
                                                                }}
                                                                disabled={idUploading || loading}
                                                                className="mt-2 text-xs font-medium text-yellow-700 hover:underline disabled:opacity-50 dark:text-yellow-400"
                                                            >
                                                                Replace ID images
                                                            </button>
                                                        )}

                                                        {(getFieldError("validIdImage") ||
                                                            getFieldError("validIdBack")) && (
                                                            <p
                                                                className="mt-2 text-xs text-red-600 dark:text-red-400"
                                                                role="alert"
                                                            >
                                                                {getFieldError("validIdImage") ||
                                                                    getFieldError("validIdBack")}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {proofOfBillingEnabled && (
                                                        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-700 dark:bg-gray-800/60">
                                                            <div className="mb-2 flex items-start gap-2">
                                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-yellow-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-yellow-400 dark:ring-gray-700">
                                                                    <ReceiptText size={16} />
                                                                </div>

                                                                <div>
                                                                    <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                                                                        Proof of billing address
                                                                        <span className="ml-1 text-red-500">*</span>
                                                                    </p>
                                                                    <p className="mt-0.5 text-[10px] leading-4 text-gray-500">
                                                                        A recent utility bill or bank statement showing your name and address. One image, JPG, PNG, or WEBP, max 5MB.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <SingleImageUpload
                                                                label="Proof of billing"
                                                                image={billingImage}
                                                                onChange={(image) => {
                                                                    setBillingImage(image);
                                                                    setValidationErrors((previous) => {
                                                                        const updated = { ...previous };
                                                                        delete updated.proofOfBillingImage;
                                                                        return updated;
                                                                    });
                                                                }}
                                                                disabled={idUploading || loading}
                                                            />

                                                            {getFieldError("proofOfBillingImage") && (
                                                                <p
                                                                    className="mt-2 text-xs text-red-600 dark:text-red-400"
                                                                    role="alert"
                                                                >
                                                                    {getFieldError("proofOfBillingImage")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {formData.hasDriversLicense && (
                                                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
<Input
                                                            id="licenseNumber"
                                                            name="licenseNumber"
                                                            label="License Number"
                                                            placeholder="N01-XX-XXXXXX"
                                                            value={formData.licenseNumber}
                                                            onChange={handleLicenseNumberChange}
                                                            error={getFieldError("licenseNumber")}
                                                            required
                                                            helperText="Enter the license number exactly as shown on your driver's license."
                                                        />

                                                        <Input
                                                            id="licenseExpirationDate"
                                                            name="licenseExpirationDate"
                                                            type="date"
                                                            label="Expiration Date"
                                                            value={formData.licenseExpirationDate}
                                                            onChange={handleChange}
                                                            error={getFieldError("licenseExpirationDate")}
                                                            required
                                                        />
                                                    </div>
                                                    )}

                                                    {formData.hasDriversLicense && licenseRestrictionEnabled && (
                                                    <>
                                                    <div className="mt-4 space-y-1.5">
<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                             What are you licensed to drive?
                                                             <span className="ml-1 text-red-500">*</span>
                                                         </h3>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            Select all that apply (a customer may have multiple license categories).
                                                        </p>
                                                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleLicenseCodesChange("A", !formData.licenseCodes.includes("A"))}
                                                                className={`group relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200
                                    ${formData.licenseCodes.includes("A")
                                                                        ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20 ring-1 ring-yellow-400"
                                                                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                                            >
                                                                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">A</span>
                                                                </div>
                                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Motorcycle</div>
                                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Motorcycle</div>
                                                                {formData.licenseCodes.includes("A") && (
                                                                    <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                                                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleLicenseCodesChange("B", !formData.licenseCodes.includes("B"))}
                                                                className={`group relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200
                                    ${formData.licenseCodes.includes("B")
                                                                        ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20 ring-1 ring-yellow-400"
                                                                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                                            >
                                                                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">B</span>
                                                                </div>
                                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Passenger Car</div>
                                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Passenger Car</div>
                                                                {formData.licenseCodes.includes("B") && (
                                                                    <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                                                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                )}
</button>
                                                            </div>
                                                        </div>

                                                    {/* Motorcycle Transmission Section - Only shows if A is selected */}
                                                    {formData.licenseCodes.includes("A") && (
                                                        <div className="mt-6 space-y-1.5">
<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                                 Motorcycle Transmission
                                                                 <span className="ml-1 text-red-500">*</span>
                                                             </h3>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                Select the transmission for your motorcycle license.
                                                            </p>
                                                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMotorcycleTransmissionChange("automatic")}
                                                                    className={`group relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200
${isMotorcycleTransmissionSelected("automatic")
                                                                         ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20 ring-1 ring-yellow-400"
                                                                         : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                                                 >
                                                                     <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                                         <span className="text-lg font-bold text-gray-900 dark:text-gray-100">AT</span>
                                                                     </div>
<div className="text-sm font-medium text-gray-900 dark:text-gray-100">Automatic</div>
                                                                      {isMotorcycleTransmissionSelected("automatic") && (
                                                                        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                                                                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                            </svg>
                                                                        </div>
                                                                    )}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleMotorcycleTransmissionChange("manual")}
                                                                    className={`group relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200
${isMotorcycleTransmissionSelected("manual")
                                                                         ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20 ring-1 ring-yellow-400"
                                                                         : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                                                 >
                                                                     <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                                         <span className="text-lg font-bold text-gray-900 dark:text-gray-100">MT</span>
                                                                     </div>
<div className="text-sm font-medium text-gray-900 dark:text-gray-100">Manual</div>
                                                                      {isMotorcycleTransmissionSelected("manual") && (
                                                                        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                                                                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                     )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Car Transmission Section - Only shows if B is selected */}
                                                    {formData.licenseCodes.includes("B") && (
                                                        <div className="mt-6 space-y-1.5">
<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                                 Car Transmission
                                                                 <span className="ml-1 text-red-500">*</span>
                                                             </h3>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                Select the transmission for your passenger car license.
                                                            </p>
                                                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCarTransmissionChange("automatic")}
                                                                    className={`group relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200
${isCarTransmissionSelected("automatic")
                                                                         ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20 ring-1 ring-yellow-400"
                                                                         : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                                                 >
                                                                     <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                                         <span className="text-lg font-bold text-gray-900 dark:text-gray-100">AT</span>
                                                                     </div>
<div className="text-sm font-medium text-gray-900 dark:text-gray-100">Automatic</div>
                                                                      {isCarTransmissionSelected("automatic") && (
                                                                        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                                                                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                            </svg>
                                                                        </div>
                                                                    )}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCarTransmissionChange("manual")}
                                                                    className={`group relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200
${isCarTransmissionSelected("manual")
                                                                         ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20 ring-1 ring-yellow-400"
                                                                         : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                                                 >
                                                                     <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                                         <span className="text-lg font-bold text-gray-900 dark:text-gray-100">MT</span>
                                                                     </div>
<div className="text-sm font-medium text-gray-900 dark:text-gray-100">Manual</div>
                                                                      {isCarTransmissionSelected("manual") && (
                                                                        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                                                                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                     )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {getFieldError("licenseCodes") && (
                                                        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                                                            {getFieldError("licenseCodes")}
                                                        </p>
                                                    )}

                                                    {getFieldError("motorcycleTransmission") && (
                                                        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                                                            {getFieldError("motorcycleTransmission")}
                                                        </p>
                                                    )}

                                                    {getFieldError("carTransmission") && (
                                                        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                                                            {getFieldError("carTransmission")}
                                                        </p>
                                                    )}
                                                    </>
                                                    )}

                                                    <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={handlePrevious}
                                                            leftIcon={<ChevronLeft size={16} />}
                                                            className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800"
                                                        >
                                                            Back
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={handleNext}
                                                            disabled={idUploading || loading}
                                                            rightIcon={<ChevronRight size={16} />}
                                                            className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300"
                                                        >
                                                            Continue
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

{currentStep === 2 && (
                                                <div className="w-full space-y-1.5">
                                                    <Input
                                                        id="email"
                                                        name="email"
                                                        type="email"
                                                        label="Email"
                                                        placeholder="Enter your email"
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        autoComplete="email"
                                                        leftIcon={<Mail size={17} />}
                                                        error={getFieldError("email")}
                                                        required
                                                    />

                                                    <Input
                                                        id="password"
                                                        name="password"
                                                        type="password"
                                                        label="Password"
                                                        placeholder="Create a password"
                                                        value={formData.password}
                                                        onChange={handleChange}
                                                        autoComplete="new-password"
                                                        leftIcon={<Lock size={17} />}
                                                        helperText={PASSWORD_HINT}
                                                        error={getFieldError("password")}
                                                        required
                                                    />

                                                    <Input
                                                        id="confirmPassword"
                                                        name="confirmPassword"
                                                        type="password"
                                                        label="Confirm Password"
                                                        placeholder="Repeat your password"
                                                        value={formData.confirmPassword}
                                                        onChange={handleChange}
                                                        autoComplete="new-password"
                                                        leftIcon={<Lock size={17} />}
                                                        error={getFieldError("confirmPassword")}
                                                        required
                                                    />

                                                    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                                                        <label className="flex cursor-pointer items-start gap-2.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={termsAgreed}
                                                                onChange={(event) => {
                                                                    setTermsAgreed(event.target.checked);

                                                                    if (validationErrors.termsAgreed) {
                                                                        setValidationErrors((previous) => {
                                                                            const updated = { ...previous };
                                                                            delete updated.termsAgreed;
                                                                            return updated;
                                                                        });
                                                                    }
                                                                }}
                                                                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                                            />
                                                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                                                I agree to Rent-A-Ride Albay&apos;s{" "}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowTermsModal(true)}
                                                                    className="font-medium text-yellow-700 underline hover:text-yellow-800 dark:text-yellow-400"
                                                                >
                                                                    Terms and Conditions
                                                                </button>
                                                                , and I consent to my personal information and ID
                                                                images being collected and used to verify my
                                                                identity and manage my bookings, as described in
                                                                the Privacy Notice section of the terms.
                                                            </span>
                                                        </label>

                                                        {getFieldError("termsAgreed") && (
                                                            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                                {getFieldError("termsAgreed")}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={handlePrevious}
                                                            leftIcon={<ChevronLeft size={16} />}
                                                            className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800"
                                                        >
                                                            Back
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={handleSubmit}
                                                            loading={loading || idUploading}
                                                            rightIcon={<ChevronRight size={16} />}
                                                            className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300"
                                                        >
                                                            Continue
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {currentStep === 3 && (
    <div className="w-full space-y-1.5">
        {verificationError && (
            <Alert
                variant="error"
                message={verificationError}
                className="mb-3"
            />
        )}
        {resendError && (
            <Alert
                variant="error"
                message={resendError}
                className="mb-3"
            />
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                    <Mail size={22} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Verify Your Email
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        We've sent a 6-digit code to{" "}
                        <span className="font-medium">
                            {formData.email}
                        </span>
                        .
                    </p>
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Verification Code
                </label>
                <div className="mt-2 flex flex-wrap justify-center gap-1 sm:gap-2">
                    {code.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => {
                                codeInputRefs.current[index] =
                                    el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => {
                                setVerificationError(null);
                                setResendError(null);
                                const value =
                                    e.target.value.replace(
                                        /\D/g,
                                        ""
                                    );

                                if (
                                    value.length >
                                    1
                                ) {
                                    return;
                                }

                                const newCode =
                                    [
                                        ...code,
                                    ];

                                newCode[
                                    index
                                ] =
                                    value;

                                setCode(
                                    newCode
                                );

                                if (
                                    value &&
                                    index <
                                        5
                                ) {
                                    codeInputRefs.current[
                                        index + 1
                                    ]?.focus();
                                }
                            }}
                            onKeyDown={(e) => {
                                if (
                                    e.key ===
                                    "Backspace" &&
                                    !code[index] &&
                                    index > 0
                                ) {
                                    codeInputRefs.current[
                                        index - 1
                                    ]?.focus();
                                }
                            }}
                            onPaste={(e) => {
                                const pasted =
                                    e.clipboardData
                                        .getData(
                                            "text"
                                        )
                                        .replace(
                                            /\D/g,
                                            ""
                                        )
                                        .slice(
                                            0,
                                            6
                                        );

                                if (pasted) {
                                    e.preventDefault();

                                    const newCode = [
                                        "",
                                        "",
                                        "",
                                        "",
                                        "",
                                        "",
                                    ];

                                    pasted.split(
                                        ""
                                    ).forEach(
                                        (
                                            char,
                                            i
                                        ) => {
                                            newCode[
                                                i
                                            ] =
                                                char;
                                        }
                                    );

                                    setCode(
                                        newCode
                                    );

                                    const lastIndex =
                                        Math.min(
                                            pasted.length,
                                            6
                                        ) - 1;

                                    codeInputRefs.current[
                                        lastIndex
                                    ]?.focus();
                                }
                            }}
                            className="h-11 w-8 rounded-lg border border-gray-300 bg-gray-50 text-center text-lg font-semibold text-gray-900 placeholder-gray-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 sm:h-12 sm:w-12 sm:text-xl dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-yellow-400 dark:focus:ring-yellow-400"
                        />
                    ))}
                </div>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Didn't receive the code?
                    <br />
                    {resendCooldown > 0 ? (
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            Resend in {resendCooldown}s
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={resendCode}
                            disabled={resendDisabled}
                            className="ml-1 font-medium text-yellow-600 hover:text-yellow-700 disabled:opacity-50 dark:text-yellow-400"
                        >
                            Resend Code
                        </button>
                    )}
                </p>
            </div>

            <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    leftIcon={<ChevronLeft size={16} />}
                    className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800"
                >
                    Back
                </Button>

                <Button
                    type="button"
                    onClick={verifyCode}
                    loading={isVerifying}
                    disabled={isVerifying || code.some((digit) => digit === "")}
                    className="!min-w-[132px] !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-xs !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300"
                >
                    Verify &amp; Continue
                </Button>
            </div>
        </div>
    </div>
)}

                                            {currentStep === 4 && (
                                                    <div className="w-full space-y-1.5">
                                                        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
                                                            <div className="mb-5 flex justify-center">
                                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                                    <ShieldCheck size={28} />
                                                                </div>
                                                            </div>

                                                            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                                                Account Created!
                                                            </h3>

                                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                Your account has been verified!
                                                            </p>
                                                        </div>

                                                        <div className="flex justify-center">
                                                            <Link to="/login">
                                                                <Button
                                                                    type="button"
                                                                    className="!min-w-[132px] !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-xs !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300"
                                                                >
                                                                    Go to Login
                                                                </Button>
                                                            </Link>
</div>
                                                    </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>
                        </main>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showTermsModal}
                onClose={() => setShowTermsModal(false)}
                title="Terms and Conditions"
                size="full"
                footer={
                    <Button
                        type="button"
                        onClick={() => setShowTermsModal(false)}
                    >
                        Close
                    </Button>
                }
            >
                <TermsAgreement
                    accepted={termsAgreed}
                    onChange={(checked) => {
                        setTermsAgreed(checked);

                        if (checked && validationErrors.termsAgreed) {
                            setValidationErrors((previous) => {
                                const updated = { ...previous };
                                delete updated.termsAgreed;
                                return updated;
                            });
                        }
                    }}
                    showAcceptButton={false}
                />
            </Modal>
        </div>
    );

};

export default Register;