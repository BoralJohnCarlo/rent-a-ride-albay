import {
    CheckCircle2,
    Loader2,
    Pencil,
    Save,
    User,
    X,
} from "lucide-react";

import {
    REGIONS,
    getProvinces,
    getCities,
    getBarangays,
} from "../../data/philippineLocations";

import Select from "../../components/common/Select";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Modal from "../../components/common/Modal";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

import useAuth from "../../hooks/auth/useAuth";
import useToast from "../../hooks/toast/useToast";
import useSettings from "../../hooks/settings/useSettings";

import {
    fetchProfile,
    saveProfile,
    uploadProfileImage,
    uploadRenewedValidId,
    requestRenewalAttempt,
} from "../../services/userService";

import { fetchPublicSettings } from "../../services/settingsService";
import formatDateUtil from "../../utils/formatDate";

import ProofOfBillingSection from "../../components/shared/ProofOfBillingSection";
import AcceptedTerms from "../../components/legal/AcceptedTerms";
import useProofOfBillingEnabled from "../../hooks/settings/useProofOfBillingEnabled";

/*
 * Same vocabulary the server now enforces (server/validators/licenseValidators.js).
 * Filtered on load so a profile edited before this validation existed —
 * possibly holding whatever free text the old inputs accepted — doesn't get
 * silently re-submitted verbatim and rejected by the new strict validator
 * the next time the customer saves *any* profile change.
 */
const VALID_LICENSE_CODES = [
    "A",
    "B",
];

const VALID_TRANSMISSIONS = [
    "automatic",
    "manual",
];

const sanitizeLicenseCodes = (codes) =>
    Array.isArray(codes)
        ? codes.filter((code) =>
              VALID_LICENSE_CODES.includes(
                  code
              )
          )
        : [];

const sanitizeTransmission = (
    transmission
) =>
    Array.isArray(transmission)
        ? transmission.filter((value) =>
              VALID_TRANSMISSIONS.includes(
                  value
              )
          )
        : [];

/*
 * Same interaction pattern as the license-codes/transmission picker in
 * Register.jsx, so choosing/renewing a license looks and behaves the same
 * whether it happens at signup or later on the profile page.
 */
const ToggleOptionButton = ({
    selected,
    disabled,
    onClick,
    code,
    label,
    sublabel,
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`group relative flex flex-col items-center justify-center rounded-lg border p-4 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
            selected
                ? "border-yellow-400 bg-yellow-50/50 ring-1 ring-yellow-400 dark:bg-yellow-900/20"
                : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
        }`}
    >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {code}
            </span>
        </div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {label}
        </div>
        {sublabel && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {sublabel}
            </div>
        )}
        {selected && (
            <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                <CheckCircle2 size={12} />
            </div>
        )}
    </button>
);

/*
 * Shows a document image as an actual clickable thumbnail (opening a
 * full-size viewer) instead of a raw URL string. `editable` optionally
 * exposes the underlying URL field below the thumbnail — the image itself
 * is always viewable regardless of edit mode.
 */
const ValidIdImagePreview = ({
    label,
    url,
    editable = false,
    onChangeUrl,
    onView,
    disabled = false,
}) => {
    const [imgError, setImgError] =
        useState(false);

    useEffect(() => {
        setImgError(false);
    }, [url]);

    const hasImage = Boolean(url) && !imgError;

    return (
        <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {label}
            </label>

            {hasImage ? (
                <button
                    type="button"
                    onClick={() =>
                        onView({
                            url,
                            label,
                        })
                    }
                    className="group relative block h-32 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                >
                    <img
                        src={url}
                        alt={label}
                        onError={() =>
                            setImgError(true)
                        }
                        className="h-full w-full object-cover transition group-hover:opacity-80"
                    />

                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                        Click to view
                    </span>
                </button>
            ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                    {url && imgError
                        ? "Unable to load image"
                        : "Not set"}
                </div>
            )}

            {editable && (
                <Input
                    className="mt-2"
                    value={url}
                    placeholder="Image URL"
                    onChange={(e) =>
                        onChangeUrl(
                            e.target.value
                        )
                    }
                    disabled={disabled}
                />
            )}
        </div>
    );
};

const Profile = () => {
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const { settings } = useSettings();
    const { enabled: proofOfBillingEnabled } =
        useProofOfBillingEnabled();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [validationErrors, setValidationErrors] =
        useState({});
    const [imageViewer, setImageViewer] =
        useState(null);

    const [profileImageFile, setProfileImageFile] =
        useState(null);
    const [profileImagePreview, setProfileImagePreview] =
        useState(null);
    const [uploadingImage, setUploadingImage] =
        useState(false);

    const [renewalFile, setRenewalFile] =
        useState(null);
    const [renewalUploading, setRenewalUploading] =
        useState(false);

    const [upgradeToLicense, setUpgradeToLicense] =
        useState(false);
    const [upgradeLicenseNumber, setUpgradeLicenseNumber] =
        useState("");
    const [
        upgradeLicenseExpirationDate,
        setUpgradeLicenseExpirationDate,
    ] = useState("");

    const [renewalRequestDialogOpen, setRenewalRequestDialogOpen] =
        useState(false);

    const [validIdRenewalCount, setValidIdRenewalCount] =
        useState(0);
    const [lastValidIdRenewalAt, setLastValidIdRenewalAt] =
        useState("");

    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        middleName: "",
        phoneNumber: "",
        alternativeContact: "",
        birthdate: "",
        validIdType: "",
        validIdImage: "",
        validIdBack: "",
        licenseNumber: "",
        licenseExpirationDate: "",
        hasDriversLicense: null,
        licenseCodes: [],
        motorcycleTransmission: [],
        carTransmission: [],
        currentAddress: {
            houseUnitLot: "",
            street: "",
            region: "",
            barangay: "",
            cityMunicipality: "",
            province: "",
            postalCode: "",
        },
        emergencyContact: {
            name: "",
            relationship: "",
            phoneNumber: "",
        },
        validIdRenewalCount: 0,
        lastValidIdRenewalAt: "",
    });

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);

            const data = await fetchProfile();

            const profileData =
                data?.data || data || {};

            setProfile(profileData);
            setValidIdRenewalCount(profileData?.validIdRenewalCount ?? 0);
            setLastValidIdRenewalAt(
                profileData?.lastValidIdRenewalAt || null
            );

            const address =
                profileData?.address || {};

            const emergencyContact =
                profileData?.emergencyContact || {};

            setFormData({
                firstName:
                    profileData?.firstName || "",
                lastName:
                    profileData?.lastName || "",
                middleName:
                    profileData?.middleName || "",
                phoneNumber:
                    profileData?.phoneNumber || "",
                alternativeContact:
                    profileData?.alternativeContact ||
                    "",
                birthdate:
                    profileData?.birthdate || "",
                validIdType:
                    profileData?.validIdType || "",
                validIdImage:
                    profileData?.validIdImage || "",
                validIdBack:
                    profileData?.validIdBack || "",
                licenseNumber:
                    profileData?.licenseNumber || "",
                licenseExpirationDate:
                    profileData?.licenseExpirationDate || "",
                hasDriversLicense:
                    profileData?.hasDriversLicense ?? null,
                licenseCodes: sanitizeLicenseCodes(
                    profileData?.licenseCodes
                ),
                motorcycleTransmission:
                    sanitizeTransmission(
                        profileData?.motorcycleTransmission
                    ),
                carTransmission:
                    sanitizeTransmission(
                        profileData?.carTransmission
                    ),
                currentAddress: {
                    houseUnitLot:
                        address?.houseUnitLot || "",
                    street:
                        address?.street || "",
                    region:
                        address?.region || "",
                    barangay:
                        address?.barangay || "",
                    cityMunicipality:
                        address?.city || "",
                    province:
                        address?.province || "",
                    postalCode:
                        address?.postalCode || "",
                },
                emergencyContact: {
                    name:
                        emergencyContact?.name ||
                        "",
                    relationship:
                        emergencyContact?.relationship ||
                        "",
                    phoneNumber:
                        emergencyContact?.phoneNumber ||
                        "",
                },
                validIdRenewalCount:
                    profileData?.validIdRenewalCount ?? 0,
                lastValidIdRenewalAt:
                    profileData?.lastValidIdRenewalAt || "",
            });
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Unable to load profile.",
                "Error"
            );
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    /*
     * Defaults to true (restriction active) while loading, matching
     * Register.jsx, so the license-codes/transmission section doesn't
     * flash away and back if the admin has it enabled.
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

    const handleChange = (
        field,
        value
    ) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleAddressChange = (
        field,
        value
    ) => {
        setFormData((prev) => {
            const updatedAddress = {
                ...prev.currentAddress,
                [field]: value,
            };

            if (field === "region") {
                updatedAddress.province = "";
                updatedAddress.cityMunicipality = "";
                updatedAddress.barangay = "";
            } else if (field === "province") {
                updatedAddress.cityMunicipality = "";
                updatedAddress.barangay = "";
            } else if (field === "cityMunicipality") {
                updatedAddress.barangay = "";
            }

            return {
                ...prev,
                currentAddress: updatedAddress,
            };
        });
    };

    const handleEmergencyChange = (
        field,
        value
    ) => {
        setFormData((prev) => ({
            ...prev,
            emergencyContact: {
                ...prev.emergencyContact,
                [field]: value,
            },
        }));
    };

    const getFieldError = (field) =>
        validationErrors[field] || "";

    const clearFieldErrors = (
        ...fields
    ) => {
        setValidationErrors((previous) => {
            const updated = {
                ...previous,
            };

            fields.forEach((field) => {
                delete updated[field];
            });

            return updated;
        });
    };

    /*
     * Same behavior as Register.jsx's license-codes/transmission picker:
     * deselecting a code clears whichever transmission choice depended on
     * it, so the two can't drift out of sync.
     */
    const handleLicenseCodesChange = (
        code,
        checked
    ) => {
        setFormData((previous) => {
            const updatedCodes = checked
                ? [
                      ...previous.licenseCodes,
                      code,
                  ]
                : previous.licenseCodes.filter(
                      (c) => c !== code
                  );

            const updatedData = {
                ...previous,
                licenseCodes: updatedCodes,
            };

            if (!checked) {
                if (code === "A") {
                    updatedData.motorcycleTransmission =
                        [];
                } else if (code === "B") {
                    updatedData.carTransmission =
                        [];
                }
            }

            return updatedData;
        });

        clearFieldErrors(
            "licenseCodes",
            "motorcycleTransmission",
            "carTransmission"
        );
    };

    /*
     * Selecting "manual" also grants "automatic" (a manual license covers
     * automatic too), mirroring the same rule Register.jsx encodes.
     */
    const handleMotorcycleTransmissionChange = (
        value
    ) => {
        setFormData((previous) => {
            const current =
                previous.motorcycleTransmission;

            if (current.length === 2) {
                return {
                    ...previous,
                    motorcycleTransmission: [],
                };
            }

            if (value === "manual") {
                if (
                    current.includes("manual")
                ) {
                    return {
                        ...previous,
                        motorcycleTransmission:
                            current.filter(
                                (t) =>
                                    t !== "manual"
                            ),
                    };
                }

                return {
                    ...previous,
                    motorcycleTransmission: [
                        ...current,
                        "manual",
                        "automatic",
                    ],
                };
            }

            if (current.includes(value)) {
                return {
                    ...previous,
                    motorcycleTransmission:
                        current.filter(
                            (t) => t !== value
                        ),
                };
            }

            return {
                ...previous,
                motorcycleTransmission: [
                    ...current,
                    value,
                ],
            };
        });

        clearFieldErrors(
            "motorcycleTransmission"
        );
    };

    const handleCarTransmissionChange = (
        value
    ) => {
        setFormData((previous) => {
            const current =
                previous.carTransmission;

            if (current.length === 2) {
                return {
                    ...previous,
                    carTransmission: [],
                };
            }

            if (value === "manual") {
                if (
                    current.includes("manual")
                ) {
                    return {
                        ...previous,
                        carTransmission:
                            current.filter(
                                (t) =>
                                    t !== "manual"
                            ),
                    };
                }

                return {
                    ...previous,
                    carTransmission: [
                        ...current,
                        "manual",
                        "automatic",
                    ],
                };
            }

            if (current.includes(value)) {
                return {
                    ...previous,
                    carTransmission:
                        current.filter(
                            (t) => t !== value
                        ),
                };
            }

            return {
                ...previous,
                carTransmission: [
                    ...current,
                    value,
                ],
            };
        });

        clearFieldErrors("carTransmission");
    };

    const isMotorcycleTransmissionSelected = (
        type
    ) =>
        formData.motorcycleTransmission.includes(
            type
        );

    const isCarTransmissionSelected = (
        type
    ) =>
        formData.carTransmission.includes(
            type
        );

    /*
     * Same rule Register.jsx enforces at signup: license code A (Motorcycle)
     * requires a motorcycle transmission choice, code B (Passenger Car)
     * requires a car transmission choice. Enforced here too so editing a
     * profile can't produce a combination registration would have rejected.
     */
    const getLicenseFieldErrors = () => {
        const errors = {};

        if (
            formData.licenseCodes.includes(
                "A"
            ) &&
            formData.motorcycleTransmission
                .length === 0
        ) {
            errors.motorcycleTransmission =
                "Please select your motorcycle transmission.";
        }

        if (
            formData.licenseCodes.includes(
                "B"
            ) &&
            formData.carTransmission.length ===
                0
        ) {
            errors.carTransmission =
                "Please select your car transmission.";
        }

        return errors;
    };

    /*
     * Mirrors the address requirements Register.jsx enforces at signup
     * (region/province/city/barangay/postal code) - the Select fields here
     * already render a `required` asterisk, but until now nothing actually
     * checked for empty values before saving.
     */
    const getAddressFieldErrors = () => {
        const errors = {};
        const address = formData.currentAddress;

        if (!address.region) {
            errors["currentAddress.region"] =
                "Region is required.";
        }

        if (!address.province) {
            errors["currentAddress.province"] =
                "Province is required.";
        }

        if (!address.cityMunicipality) {
            errors["currentAddress.cityMunicipality"] =
                "City/Municipality is required.";
        }

        if (!address.barangay) {
            errors["currentAddress.barangay"] =
                "Barangay is required.";
        }

        if (!address.postalCode?.trim()) {
            errors["currentAddress.postalCode"] =
                "Postal code is required.";
        } else if (
            !/^\d{4}$/.test(address.postalCode.trim())
        ) {
            errors["currentAddress.postalCode"] =
                "Postal code must be exactly 4 digits.";
        }

        return errors;
    };

    const handleImageSelect = (
        event
    ) => {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {
            toast.error(
                "Please select an image file.",
                "Invalid File"
            );
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error(
                "Image must be 5 MB or smaller.",
                "File Too Large"
            );
            return;
        }

        setProfileImageFile(file);

        const reader =
            new FileReader();

        reader.onloadend = () => {
            setProfileImagePreview(
                reader.result
            );
        };

        reader.readAsDataURL(file);
    };

    const handleImageUpload = async () => {
        if (!profileImageFile) {
            return null;
        }

        try {
            setUploadingImage(true);

            const result =
                await uploadProfileImage(
                    profileImageFile
                );

            const imageUrl =
                result?.data?.data?.url ||
                result?.data?.url ||
                result?.url;

            if (!imageUrl) {
                throw new Error(
                    "No image URL returned."
                );
            }

            toast.success(
                "Profile image uploaded successfully.",
                "Success"
            );

            setProfileImageFile(null);
            setProfileImagePreview(null);

            if (
                fileInputRef
                    .current
            ) {
                fileInputRef.current.value =
                    "";
            }

            return imageUrl;
        } catch (error) {
            toast.error(
                error?.response?.data
                    ?.message ||
                    "Unable to upload profile image.",
                "Upload Failed"
            );

            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRenewalImageSelect = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error(
                "Please select an image file.",
                "Invalid File"
            );
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error(
                "Image must be 5 MB or smaller.",
                "File Too Large"
            );
            return;
        }

        setRenewalFile(file);
    };

    const handleRenewalUpload = async () => {
        if (!renewalFile) {
            toast.error(
                "Please select a file first.",
                "No File"
            );
            return;
        }

        try {
            setRenewalUploading(true);

            const result = await uploadRenewedValidId(
                renewalFile,
                upgradeToLicense
                    ? {
                          validIdType: "Driver's License",
                          licenseNumber: upgradeLicenseNumber,
                          licenseExpirationDate:
                              upgradeLicenseExpirationDate,
                      }
                    : null
            );

            /*
             * The renewal endpoint returns the updated user object (via
             * formatUser), not an upload-response shape — the renewed
             * image lives at result.data.validIdImage, never at a nested
             * .data.data.url/.data.url/.url (that was copy-pasted from the
             * unrelated profile-picture upload handler, whose endpoint
             * really does return that shape).
             */
            const imageUrl = result?.data?.validIdImage;

            if (!imageUrl) {
                throw new Error(
                    "No image URL returned."
                );
            }

            toast.success(
                "Valid ID renewed successfully.",
                "Success"
            );

            /*
             * Same fix already applied to the regular profile save: without
             * this, VehicleDetails.jsx's license checks keep reading the
             * stale Redux user (hasDriversLicense, validIdType) until the
             * next login/refresh, even though the renewal already
             * succeeded server-side.
             */
            if (result?.data) {
                updateUser(result.data);
            }

            setRenewalFile(null);
            setRenewalUploading(false);
            setUpgradeToLicense(false);
            setUpgradeLicenseNumber("");
            setUpgradeLicenseExpirationDate("");
            await loadProfile();
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Unable to upload renewed valid ID.",
                "Upload Failed"
            );
        } finally {
            setRenewalUploading(false);
        }
    };

    const handleRequestRenewalAttempt = async () => {
        try {
            await requestRenewalAttempt();
            setRenewalRequestDialogOpen(false);
            toast.success(
                "Renewal request submitted. Admins have been notified.",
                "Request Submitted"
            );
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    "Unable to request renewal attempt."
            );
        }
    };

    /*
     * express-validator failures land as `{message: "Validation failed.",
     * errors: [{path, msg}, ...]}` - the toast used to only ever show the
     * generic top-level message. This maps each field-level error onto the
     * same validationErrors state the client-side checks use, so e.g. a
     * server-side "Phone number is invalid" highlights the actual field
     * instead of leaving the customer to guess which one was wrong.
     */
    const applyServerValidationErrors = (error) => {
        const serverErrors =
            error?.response?.data?.errors;

        if (
            !Array.isArray(serverErrors) ||
            serverErrors.length === 0
        ) {
            return null;
        }

        const mapped = {};

        serverErrors.forEach((fieldError) => {
            if (fieldError?.path && fieldError?.msg) {
                mapped[fieldError.path] =
                    fieldError.msg;
            }
        });

        if (Object.keys(mapped).length === 0) {
            return null;
        }

        setValidationErrors((previous) => ({
            ...previous,
            ...mapped,
        }));

        return serverErrors[0]?.msg || null;
    };

    const handleSave = async () => {
        const fieldErrors = {
            ...getLicenseFieldErrors(),
            ...getAddressFieldErrors(),
        };

        setValidationErrors(fieldErrors);

        if (Object.keys(fieldErrors).length > 0) {
            toast.error(
                "Please fix the highlighted fields before saving.",
                "Validation Error"
            );

            return;
        }

        try {
            setSaving(true);

            const hadPendingImage = Boolean(
                profileImageFile
            );

            const profileImageUrl =
                await handleImageUpload();

            if (hadPendingImage && !profileImageUrl) {
                /*
                 * handleImageUpload() already showed an "Upload Failed"
                 * toast - stop here instead of saving the rest of the
                 * profile and then telling the customer everything
                 * (including the photo) saved successfully.
                 */
                return;
            }

            const payload = {
                ...formData,
                profileImage:
                    profileImageUrl ??
                    profile?.profileImage ??
                    "",
            };

            const saveResult =
                await saveProfile(payload);

            toast.success(
                "Profile updated successfully.",
                "Success"
            );

            setEditing(false);

            setProfileImageFile(null);
            setProfileImagePreview(null);

            if (fileInputRef.current) {
                fileInputRef.current.value =
                    "";
            }

            await loadProfile();

            /*
             * Sync the just-saved fields (e.g. a renewed license expiration
             * date) into the authenticated user Redux carries, using the
             * data the save response already returned — this is what
             * VehicleDetails.jsx's license-expiry check reads, and without
             * this it stays stale until the next login or full page reload.
             * A plain merge, not a re-fetch: no risk of a transient network
             * hiccup here deauthenticating the session.
             */
            if (saveResult?.data) {
                updateUser(saveResult.data);
            }
        } catch (error) {
            toast.error(
                applyServerValidationErrors(error) ||
                    error?.response?.data?.message ||
                    "Unable to update profile.",
                "Error"
            );
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        if (saving) {
            return;
        }

        setEditing(false);
        setValidationErrors({});

        /*
         * Without this, a picked-but-unsaved profile image stays selected:
         * the avatar keeps showing the local preview after Cancel, and a
         * later Save (without picking a new file) would silently upload
         * this "cancelled" file anyway.
         */
        setProfileImageFile(null);
        setProfileImagePreview(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        await loadProfile();
    };

    const formatDate = (dateString) => {
        const formatted = formatDateUtil(
            dateString,
            { month: "long" }
        );

        return formatted === "-"
            ? "Not set"
            : formatted;
    };

    const fullName =
        [
            formData.firstName,
            formData.middleName,
            formData.lastName,
        ]
            .filter(Boolean)
            .join(" ") || "Customer";

    const email =
        profile?.email ||
        user?.email ||
        "No email available";

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f8f9fb] dark:bg-gray-950">
                <div className="flex min-h-[70vh] items-center justify-center">
                    <Loader2
                        size={32}
                        className="animate-spin text-yellow-500"
                    />
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f8f9fb] px-4 pb-12 pt-24 dark:bg-gray-950 sm:px-6 sm:pt-28 lg:px-8">

            <div className="mx-auto w-full max-w-5xl">

                {/* Page Header */}
                <div className="mb-7">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                        Account
                    </p>

                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                                My Profile
                            </h1>

                            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                                Manage your personal information
                                and account details.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Profile Summary Card */}
                <section className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-gray-900">

                    <div className="p-6 sm:p-8">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

                            {/* Identity */}
                            <div className="flex min-w-0 items-center gap-4">

                                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-yellow-50 bg-yellow-100 text-yellow-700 dark:border-yellow-500/10 dark:bg-yellow-500/10 dark:text-yellow-400">

                                        <div className="h-full w-full overflow-hidden rounded-full flex items-center justify-center">
                                            {(profileImagePreview || profile?.profileImage) ? (
                                                <img
                                                    src={
                                                        profileImagePreview ??
                                                        profile.profileImage
                                                    }
                                                    alt="Profile"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <User
                                                    size={38}
                                                    strokeWidth={
                                                        1.7
                                                    }
                                                />
                                            )}
                                        </div>

                                        {editing && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    fileInputRef.current?.click()
                                                }
                                                disabled={
                                                    uploadingImage
                                                }
                                                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
                                            >
                                                {uploadingImage ? (
                                                    <Loader2
                                                        size={20}
                                                        className="animate-spin text-white"
                                                    />
                                                ) : (
                                                    <Pencil
                                                        size={20}
                                                        className="text-white"
                                                    />
                                                )}
                                            </button>
                                        )}

                                        {profile?.isVerified && (
                                            <span className="absolute -top-1 -right-1 rounded-full bg-white p-0.5">
                                                <CheckCircle2
                                                    size={18}
                                                    className="text-blue-600"
                                                />
                                            </span>
                                        )}
                                    </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    className="hidden"
                                    onChange={
                                        handleImageSelect
                                    }
                                />

                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="truncate text-xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-2xl">
                                            {fullName}
                                        </h2>

                                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400">
                                            Customer
                                        </span>
                                    </div>

                                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                                        {email}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                        Rent-A-Ride Albay
                                    </p>

                                    {profile?.verifiedByAdmin &&
                                        !profile?.isVerified && (
                                            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                                {profile?.validIdExpired
                                                    ? "Verification on hold — your valid ID has expired. Upload a renewed ID to get verified again."
                                                    : "Verification on hold — your license has expired. Renew it to restore your verified badge."}
                                            </p>
                                        )}
                                </div>
                            </div>

                            {/* Actions */}
                            {!editing ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        setEditing(
                                            true
                                        )
                                    }
                                    leftIcon={
                                        <Pencil
                                            size={
                                                16
                                            }
                                        />
                                    }
                                    className="shrink-0"
                                >
                                    Edit Profile
                                </Button>
                            ) : (
                                <div className="flex shrink-0 flex-wrap gap-2">

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={
                                            handleCancel
                                        }
                                        disabled={
                                            saving
                                        }
                                        leftIcon={
                                            <X
                                                size={
                                                    16
                                                }
                                            />
                                        }
                                    >
                                        Cancel
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={
                                            handleSave
                                        }
                                        disabled={
                                            saving
                                        }
                                        leftIcon={
                                            saving ? (
                                                <Loader2
                                                    size={
                                                        16
                                                    }
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <Save
                                                    size={
                                                        16
                                                    }
                                                />
                                            )
                                        }
                                    >
                                        {saving
                                            ? "Saving..."
                                            : "Save Changes"}
                                    </Button>

                                </div>
                            )}

                        </div>
                    </div>
                </section>

                {/* Personal Information */}
                <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)] dark:border-gray-800 dark:bg-gray-900">

                    <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                            Personal Details
                        </p>

                        <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                            Personal Information
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Your basic personal and contact
                            information.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                            {/*
                                Name fields must match the customer's valid
                                ID, so they're read-only here regardless of
                                edit mode - allowing a self-service rename
                                would undermine ID verification. The server
                                enforces this too (updateUserProfile ignores
                                these fields even if sent).
                            */}

                            {/* First Name */}
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    First Name
                                </label>

                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {formData.firstName ||
                                        "Not set"}
                                </p>

                                {editing && (
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        Contact support to
                                        change your legal name.
                                    </p>
                                )}
                            </div>

                            {/* Last Name */}
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Last Name
                                </label>

                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {formData.lastName ||
                                        "Not set"}
                                </p>

                                {editing && (
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        Contact support to
                                        change your legal name.
                                    </p>
                                )}
                            </div>

                            {/* Middle Name */}
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Middle Name
                                </label>

                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {formData.middleName ||
                                        "Not set"}
                                </p>

                                {editing && (
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        Contact support to
                                        change your legal name.
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Email Address
                                </label>

                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {email}
                                </p>

                                {editing && (
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        Email cannot be changed
                                        from this page.
                                    </p>
                                )}
                            </div>

                            {/* Phone */}
                            {editing ? (
                                <Input
                                    label="Phone Number"
                                    value={
                                        formData.phoneNumber
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "phoneNumber",
                                            e.target.value
                                        )
                                    }
                                    disabled={
                                        saving
                                    }
                                />
                            ) : (
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Phone Number
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formData.phoneNumber ||
                                            "Not set"}
                                    </p>
                                </div>
                            )}

                            {/* Alternative Contact */}
                            {editing ? (
                                <Input
                                    label="Alternative Contact"
                                    value={
                                        formData.alternativeContact
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "alternativeContact",
                                            e.target.value
                                        )
                                    }
                                    disabled={
                                        saving
                                    }
                                />
                            ) : (
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Alternative Contact
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formData.alternativeContact ||
                                            "Not set"}
                                    </p>
                                </div>
                            )}

                            {/*
                                Birthdate must match the customer's valid ID,
                                so it's read-only here regardless of edit mode
                                - same rationale as the name fields above. The
                                server enforces this too (updateUserProfile
                                ignores this field even if sent).
                            */}

                            {/* Birthdate */}
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Birthdate
                                </label>

                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {formatDate(
                                        formData.birthdate
                                    )}
                                </p>

                                {editing && (
                                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                        Contact support to
                                        change your birthdate.
                                    </p>
                                )}
                            </div>

                        </div>
                    </div>
                </section>

                {/* Address */}
                <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)] dark:border-gray-800 dark:bg-gray-900">

                    <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                            Location
                        </p>

                        <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                            Address
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Your current residential address.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                            <Input
                                label="House / Unit / Lot"
                                value={
                                    formData
                                        .currentAddress
                                        .houseUnitLot
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "houseUnitLot",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                            />

                            <Input
                                label="Street"
                                value={
                                    formData
                                        .currentAddress
                                        .street
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "street",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                            />

                            <Select
                                label="Region"
                                value={formData.currentAddress.region}
                                onChange={(e) =>
                                    handleAddressChange(
                                        "region",
                                        e.target.value
                                    )
                                }
                                options={REGIONS.map(
                                    (r) => ({
                                        value: r,
                                        label: r,
                                    })
                                )}
                                placeholder="Select region"
                                disabled={
                                    !editing || saving
                                }
                                error={getFieldError(
                                    "currentAddress.region"
                                )}
                                required
                            />

                            <Select
                                label="Province"
                                value={
                                    formData.currentAddress.province
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "province",
                                        e.target.value
                                    )
                                }
                                options={
                                    formData.currentAddress.region
                                        ? getProvinces(
                                              formData.currentAddress.region
                                          ).map((p) => ({
                                              value: p,
                                              label: p,
                                          }))
                                        : []
                                }
                                placeholder="Select province"
                                disabled={
                                    !editing ||
                                    saving ||
                                    !formData.currentAddress.region
                                }
                                error={getFieldError(
                                    "currentAddress.province"
                                )}
                                required
                            />

                            <Select
                                label="City / Municipality"
                                value={
                                    formData.currentAddress.cityMunicipality
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "cityMunicipality",
                                        e.target.value
                                    )
                                }
                                options={
                                    formData.currentAddress.province
                                        ? getCities(
                                              formData.currentAddress.region,
                                              formData.currentAddress.province
                                          ).map((c) => ({
                                              value: c,
                                              label: c,
                                          }))
                                        : []
                                }
                                placeholder="Select city"
                                disabled={
                                    !editing ||
                                    saving ||
                                    !formData.currentAddress.province
                                }
                                error={getFieldError(
                                    "currentAddress.cityMunicipality"
                                )}
                                required
                            />

                            <Select
                                label="Barangay"
                                value={formData.currentAddress.barangay}
                                onChange={(e) =>
                                    handleAddressChange(
                                        "barangay",
                                        e.target.value
                                    )
                                }
                                options={
                                    formData.currentAddress.cityMunicipality
                                        ? getBarangays(
                                              formData.currentAddress.region,
                                              formData.currentAddress.province,
                                              formData.currentAddress.cityMunicipality
                                          ).map((b) => ({
                                              value: b,
                                              label: b,
                                          }))
                                        : []
                                }
                                placeholder="Select barangay"
                                disabled={
                                    !editing ||
                                    saving ||
                                    !formData.currentAddress.cityMunicipality
                                }
                                error={getFieldError(
                                    "currentAddress.barangay"
                                )}
                                required
                            />

                            <Input
                                label="Postal Code"
                                value={
                                    formData
                                        .currentAddress
                                        .postalCode
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "postalCode",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                                error={getFieldError(
                                    "currentAddress.postalCode"
                                )}
                                required
                            />

                        </div>
                    </div>
                </section>

                {/* Valid ID */}
                <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)] dark:border-gray-800 dark:bg-gray-900">

                    <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                            Identity
                        </p>

                        <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                            Valid ID
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Your government-issued ID, used to verify
                            your identity. This is separate from your
                            driver's license below.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                            {editing ? (
                                <Input
                                    label="Valid ID Type"
                                    value={
                                        formData
                                            .validIdType
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "validIdType",
                                            e.target.value
                                        )
                                    }
                                    disabled={
                                        saving
                                    }
                                />
                            ) : (
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Valid ID Type
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formData
                                            .validIdType
                                            ? formData
                                                .validIdType
                                            : "Not set"}
                                    </p>
                                </div>
                            )}

                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">

                            <ValidIdImagePreview
                                label="Valid ID Image"
                                url={
                                    formData.validIdImage
                                }
                                editable={editing}
                                disabled={saving}
                                onChangeUrl={(value) =>
                                    handleChange(
                                        "validIdImage",
                                        value
                                    )
                                }
                                onView={
                                    setImageViewer
                                }
                            />

                            <ValidIdImagePreview
                                label="Valid ID Back Image"
                                url={
                                    formData.validIdBack
                                }
                                editable={editing}
                                disabled={saving}
                                onChangeUrl={(value) =>
                                    handleChange(
                                        "validIdBack",
                                        value
                                    )
                                }
                                onView={
                                    setImageViewer
                                }
                            />

                        </div>

                                        </div>
                </section>

                {/* Proof of Billing Address — always right below Valid ID */}
                {proofOfBillingEnabled && (
                    <ProofOfBillingSection
                        className="mt-6 rounded-[28px] shadow-[0_10px_35px_rgba(0,0,0,0.035)]"
                        url={profile?.proofOfBillingImage || ""}
                        onView={setImageViewer}
                        onUploaded={(url) =>
                            setProfile((previous) => ({
                                ...previous,
                                proofOfBillingImage: url,
                            }))
                        }
                    />
                )}

                {/* Valid ID Renewal */}
                <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)] dark:border-gray-800 dark:bg-gray-900">

                    <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                            Renewals
                        </p>

                        <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                            Renew Your Valid ID
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Upload your renewed valid ID once per year.
                            This does not update your driver's license —
                            to update your license expiration date or
                            codes, edit the Driver's License section
                            below instead.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Renewal Attempts Used
                                </label>

<p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {validIdRenewalCount} /{" "}
                                        {settings?.validIdRenewalSettings?.maxUploadsPerYear ?? 1}
                                    </p>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Last Renewal
                                </label>

                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {lastValidIdRenewalAt
                                        ? formatDate(lastValidIdRenewalAt)
                                        : "Not set"}
                                </p>
                            </div>

                        </div>

                        <div className="mt-6 flex flex-wrap items-end gap-3">
                            <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                className="hidden"
                                id="renewal-upload-input"
                                onChange={handleRenewalImageSelect}
                                disabled={renewalUploading}
                            />

                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                leftIcon={renewalFile ? <CheckCircle2 size={16} /> : <Pencil size={16} />}
                                onClick={() => document.getElementById('renewal-upload-input')?.click()}
                                disabled={renewalUploading}
                            >
                                {renewalFile
                                    ? renewalFile.name
                                    : "Choose file"}
                            </Button>

                            {renewalFile && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleRenewalUpload}
                                    disabled={renewalUploading}
                                    leftIcon={renewalUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                >
                                    Upload Renewed Valid ID
                                </Button>
                            )}

                            {renewalFile && !renewalUploading && (
                                <button
                                    type="button"
                                    onClick={() => setRenewalFile(null)}
                                    className="-m-2 rounded-md p-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Cancel
                                </button>
                            )}

                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                leftIcon={<Pencil size={16} />}
                                onClick={() => setRenewalRequestDialogOpen(true)}
                                disabled={
                                    renewalUploading ||
                                    validIdRenewalCount >=
                                        (settings?.validIdRenewalSettings
                                            ?.maxUploadsPerYear ?? 1)
                                }
                                className="mt-3"
                            >
                                {validIdRenewalCount >=
                                (settings?.validIdRenewalSettings
                                    ?.maxUploadsPerYear ?? 1)
                                    ? "Limit Reached"
                                    : "Request Renewal Attempt"}
                            </Button>
                        </div>

                        {formData.validIdType !== "Driver's License" && (
                            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                                <label className="flex items-start gap-2.5 text-sm">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 dark:border-gray-600 dark:bg-gray-800"
                                        checked={upgradeToLicense}
                                        onChange={(e) =>
                                            setUpgradeToLicense(e.target.checked)
                                        }
                                        disabled={renewalUploading}
                                    />
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                        Switch my valid ID to a driver's
                                        license instead, using the photo
                                        uploaded above.
                                    </span>
                                </label>

                                {upgradeToLicense && (
                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Input
                                            label="License Number"
                                            value={upgradeLicenseNumber}
                                            onChange={(e) =>
                                                setUpgradeLicenseNumber(
                                                    e.target.value
                                                )
                                            }
                                            disabled={renewalUploading}
                                        />

                                        <Input
                                            label="Expiration Date"
                                            type="date"
                                            value={
                                                upgradeLicenseExpirationDate
                                            }
                                            onChange={(e) =>
                                                setUpgradeLicenseExpirationDate(
                                                    e.target.value
                                                )
                                            }
                                            disabled={renewalUploading}
                                        />

                                        <p className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">
                                            Choose a file above and click
                                            "Upload Renewed Valid ID" to
                                            apply this. Your license
                                            categories and transmission
                                            can be added afterward in the
                                            Driver's License section
                                            below.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </section>

                {/* Driver's License */}
                <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)] dark:border-gray-800 dark:bg-gray-900">

                    <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                            License
                        </p>

                        <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                            Driver's License
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Your driver's license information.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">

                        <div className="mb-6 space-y-1.5">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Do you have a driver's license?
                            </h3>

                            {editing ? (
                                <div className="grid grid-cols-2 gap-2.5 sm:max-w-xs">
                                    <ToggleOptionButton
                                        code="Y"
                                        label="Yes"
                                        selected={formData.hasDriversLicense === true}
                                        disabled={saving}
                                        onClick={() =>
                                            handleChange("hasDriversLicense", true)
                                        }
                                    />

                                    <ToggleOptionButton
                                        code="N"
                                        label="No"
                                        selected={formData.hasDriversLicense === false}
                                        disabled={saving}
                                        onClick={() =>
                                            handleChange("hasDriversLicense", false)
                                        }
                                    />
                                </div>
                            ) : (
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {formData.hasDriversLicense === true
                                        ? "Yes"
                                        : formData.hasDriversLicense === false
                                        ? "No"
                                        : "Not specified"}
                                </p>
                            )}

                            {formData.hasDriversLicense === false && (
                                <p className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                                    You can only book vehicles with a driver. Update this once you have a license to unlock self-drive bookings.
                                </p>
                            )}
                        </div>

                        {formData.hasDriversLicense !== false && (
                        <>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                            {editing ? (
                                <Input
                                    label="License Number"
                                    value={
                                        formData
                                            .licenseNumber
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "licenseNumber",
                                            e.target.value
                                        )
                                    }
                                    disabled={
                                        saving
                                    }
                                />
                            ) : (
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        License Number
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formData
                                            .licenseNumber ||
                                            "Not set"}
                                    </p>
                                </div>
                            )}

                            {editing ? (
                                <Input
                                    label="Expiration Date"
                                    type="date"
                                    value={
                                        formData
                                            .licenseExpirationDate
                                            ? formData
                                                .licenseExpirationDate
                                                .slice(
                                                    0,
                                                    10
                                                )
                                            : ""
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "licenseExpirationDate",
                                            e.target.value
                                        )
                                    }
                                    disabled={
                                        saving
                                    }
                                />
                            ) : (
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Expiration Date
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formatDate(
                                            formData.licenseExpirationDate
                                        )}
                                    </p>
                                </div>
                            )}

                        </div>

                        {licenseRestrictionEnabled && (
                        <>
                        <div className="mt-6 space-y-1.5">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                What are you licensed
                                to drive?
                            </h3>

                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Select all that apply.
                            </p>

                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <ToggleOptionButton
                                    code="A"
                                    label="Motorcycle"
                                    selected={formData.licenseCodes.includes(
                                        "A"
                                    )}
                                    disabled={
                                        !editing ||
                                        saving
                                    }
                                    onClick={() =>
                                        handleLicenseCodesChange(
                                            "A",
                                            !formData.licenseCodes.includes(
                                                "A"
                                            )
                                        )
                                    }
                                />

                                <ToggleOptionButton
                                    code="B"
                                    label="Passenger Car"
                                    selected={formData.licenseCodes.includes(
                                        "B"
                                    )}
                                    disabled={
                                        !editing ||
                                        saving
                                    }
                                    onClick={() =>
                                        handleLicenseCodesChange(
                                            "B",
                                            !formData.licenseCodes.includes(
                                                "B"
                                            )
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {formData.licenseCodes.includes(
                            "A"
                        ) && (
                            <div className="mt-6 space-y-1.5">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Motorcycle
                                    Transmission
                                </h3>

                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Select the
                                    transmission for
                                    your motorcycle
                                    license.
                                </p>

                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                    <ToggleOptionButton
                                        code="AT"
                                        label="Automatic"
                                        selected={isMotorcycleTransmissionSelected(
                                            "automatic"
                                        )}
                                        disabled={
                                            !editing ||
                                            saving
                                        }
                                        onClick={() =>
                                            handleMotorcycleTransmissionChange(
                                                "automatic"
                                            )
                                        }
                                    />

                                    <ToggleOptionButton
                                        code="MT"
                                        label="Manual"
                                        selected={isMotorcycleTransmissionSelected(
                                            "manual"
                                        )}
                                        disabled={
                                            !editing ||
                                            saving
                                        }
                                        onClick={() =>
                                            handleMotorcycleTransmissionChange(
                                                "manual"
                                            )
                                        }
                                    />
                                </div>

                                {getFieldError(
                                    "motorcycleTransmission"
                                ) && (
                                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                        {getFieldError(
                                            "motorcycleTransmission"
                                        )}
                                    </p>
                                )}
                            </div>
                        )}

                        {formData.licenseCodes.includes(
                            "B"
                        ) && (
                            <div className="mt-6 space-y-1.5">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Car Transmission
                                </h3>

                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Select the
                                    transmission for
                                    your passenger car
                                    license.
                                </p>

                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                    <ToggleOptionButton
                                        code="AT"
                                        label="Automatic"
                                        selected={isCarTransmissionSelected(
                                            "automatic"
                                        )}
                                        disabled={
                                            !editing ||
                                            saving
                                        }
                                        onClick={() =>
                                            handleCarTransmissionChange(
                                                "automatic"
                                            )
                                        }
                                    />

                                    <ToggleOptionButton
                                        code="MT"
                                        label="Manual"
                                        selected={isCarTransmissionSelected(
                                            "manual"
                                        )}
                                        disabled={
                                            !editing ||
                                            saving
                                        }
                                        onClick={() =>
                                            handleCarTransmissionChange(
                                                "manual"
                                            )
                                        }
                                    />
                                </div>

                                {getFieldError(
                                    "carTransmission"
                                ) && (
                                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                        {getFieldError(
                                            "carTransmission"
                                        )}
                                    </p>
                                )}
                            </div>
                        )}
                        </>
                        )}
                        </>
                        )}
                    </div>
                </section>
                <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)] dark:border-gray-800 dark:bg-gray-900">

                    <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                            Safety
                        </p>

                        <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                            Emergency Contact
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Someone we can contact in case of
                            an emergency.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

                            <Input
                                label="Name"
                                value={
                                    formData
                                        .emergencyContact
                                        .name
                                }
                                onChange={(e) =>
                                    handleEmergencyChange(
                                        "name",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                            />

                            <Input
                                label="Relationship"
                                value={
                                    formData
                                        .emergencyContact
                                        .relationship
                                }
                                onChange={(e) =>
                                    handleEmergencyChange(
                                        "relationship",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                            />

                            <Input
                                label="Phone Number"
                                value={
                                    formData
                                        .emergencyContact
                                        .phoneNumber
                                }
                                onChange={(e) =>
                                    handleEmergencyChange(
                                        "phoneNumber",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                            />

                        </div>
                    </div>
                </section>

                {/* The Terms & Conditions version accepted at sign-up. */}
                {profile?.termsAcceptance?.document && (
                    <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.035)] dark:border-gray-800 dark:bg-gray-900">
                        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                                Agreements
                            </p>

                            <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                                Terms You Agreed To
                            </h2>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                The version you accepted when you signed up.
                                Each booking also keeps the version you
                                accepted for it.
                            </p>
                        </div>

                        <div className="p-6 sm:p-8">
                            <AcceptedTerms acceptance={profile.termsAcceptance} />
                        </div>
                    </section>
                )}

                {/* Renewal Request Dialog */}
                <ConfirmDialog
                    isOpen={renewalRequestDialogOpen}
                    onClose={() => setRenewalRequestDialogOpen(false)}
                    onConfirm={handleRequestRenewalAttempt}
                    title="Request Renewal Attempt"
                    message="Are you sure you want to request an additional valid ID renewal attempt? This will notify the admins who can approve your request."
                    confirmText="Submit Request"
                    cancelText="Cancel"
                    confirmVariant="primary"
                />

                {/* Image viewer */}
                <Modal
                    isOpen={Boolean(
                        imageViewer
                    )}
                    onClose={() =>
                        setImageViewer(null)
                    }
                    title={
                        imageViewer?.label ||
                        "Valid ID"
                    }
                    size="lg"
                >
                    {imageViewer && (
                        <img
                            src={imageViewer.url}
                            alt={
                                imageViewer.label
                            }
                            className="mx-auto max-h-[65vh] w-auto rounded-lg object-contain"
                        />
                    )}
                </Modal>

                {/* Bottom Spacing */}
                <div className="h-4" />
            </div>
        </main>
    );
};

export default Profile;