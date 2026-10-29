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
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";

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

import {
    fetchProfile,
    saveProfile,
    uploadProfileImage,
} from "../../services/userService";
import formatDateUtil from "../../utils/formatDate";

import ProofOfBillingSection from "../../components/shared/ProofOfBillingSection";
import AcceptedTerms from "../../components/legal/AcceptedTerms";
import useProofOfBillingEnabled from "../../hooks/settings/useProofOfBillingEnabled";

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
        currentAddress: {
            houseUnitLot: "",
            street: "",
            region: "",
            barangay: "",
            cityMunicipality: "",
            province: "",
            postalCode: "",
        },
    });

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);

            const data = await fetchProfile();

            const profileData =
                data?.data || data || {};

            setProfile(profileData);

            const address =
                profileData?.address || {};

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

    const getFieldError = (path) =>
        validationErrors?.[path] || "";

    /*
     * Mirrors the address requirements Register.jsx/RegisterOperator.jsx
     * enforce at signup (region/province/city/barangay/postal code) - the
     * Select fields here already render a `required` asterisk, but until
     * now nothing actually checked for empty values before saving.
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

    /*
     * express-validator failures land as `{message: "Validation failed.",
     * errors: [{path, msg}, ...]}` - the toast used to only ever show the
     * generic top-level message. This maps each field-level error onto the
     * same validationErrors state the client-side checks use, so e.g. a
     * server-side "Phone number is invalid" highlights the actual field
     * instead of leaving the operator to guess which one was wrong.
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
        const fieldErrors = getAddressFieldErrors();

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
                 * profile and then telling the operator everything
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
             * Sync the just-saved fields into the authenticated user Redux
             * carries, using the data the save response already returned —
             * a plain merge, not a re-fetch, so a transient network hiccup
             * here can't deauthenticate the session.
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
            .join(" ") || "Partner";

    const email =
        profile?.email ||
        user?.email ||
        "No email available";

    if (loading) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center">
                <Loader2
                    size={32}
                    className="animate-spin text-yellow-500"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="My Profile"
                subtitle="Manage your personal information and account details."
            />

            {/* Profile Summary Card */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

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
                                            className="text-green-600"
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
                                        Partner
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
                                                ? "Verification on hold — your valid ID has expired. Upload your renewed ID below to get verified again."
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
                            <div className="flex shrink-0 gap-2">

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
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

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
                            Name fields must match the operator's valid ID,
                            so they're read-only here regardless of edit
                            mode - allowing a self-service rename would
                            undermine ID verification. The server enforces
                            this too (updateUserProfile ignores these fields
                            even if sent).
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
                            Birthdate must match the operator's valid ID, so
                            it's read-only here regardless of edit mode - same
                            rationale as the name fields above. The server
                            enforces this too (updateUserProfile ignores this
                            field even if sent).
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
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

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
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

                <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                        Identity
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                        Valid ID
                    </h2>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Your government-issued ID, used to verify
                        your identity.
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
                    className="rounded-2xl shadow-sm"
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

            {/* The Terms & Conditions version accepted at sign-up. */}
            {profile?.termsAcceptance?.document && (
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Terms You Agreed To
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        The version you accepted when you signed up. Each
                        consignment application keeps the Partner Terms
                        version you accepted for it.
                    </p>
                    <AcceptedTerms
                        className="mt-4"
                        acceptance={profile.termsAcceptance}
                    />
                </section>
            )}

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
        </div>
    );
};

export default Profile;
