import {
    CheckCircle2,
    Loader2,
    Pencil,
    Save,
    User,
    X,
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState,
} from "react";

import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

import useAuth from "../../hooks/auth/useAuth";
import useToast from "../../hooks/toast/useToast";

import {
    fetchProfile,
    saveProfile,
} from "../../services/userService";

const Profile = () => {
    const { user } = useAuth();
    const toast = useToast();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        middleName: "",
        phoneNumber: "",
        alternativeContact: "",
        birthdate: "",
        address: {
            province: "",
            city: "",
            barangay: "",
            street: "",
        },
        emergencyContact: {
            name: "",
            relationship: "",
            phoneNumber: "",
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
                address: {
                    province:
                        address?.province || "",
                    city:
                        address?.city || "",
                    barangay:
                        address?.barangay || "",
                    street:
                        address?.street || "",
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
        setFormData((prev) => ({
            ...prev,
            address: {
                ...prev.address,
                [field]: value,
            },
        }));
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

    const handleSave = async () => {
        try {
            setSaving(true);

            await saveProfile(formData);

            toast.success(
                "Profile updated successfully.",
                "Success"
            );

            setEditing(false);

            await loadProfile();
        } catch (error) {
            toast.error(
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

        await loadProfile();
    };

    const formatDate = (dateString) => {
        if (!dateString) {
            return "Not set";
        }

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return "Not set";
        }

        return date.toLocaleDateString(
            "en-PH",
            {
                year: "numeric",
                month: "long",
                day: "numeric",
            }
        );
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

                                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-50 bg-yellow-100 text-yellow-700 dark:border-yellow-500/10 dark:bg-yellow-500/10 dark:text-yellow-400">

                                    {profile?.profileImage ? (
                                        <img
                                            src={
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

                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="truncate text-xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-2xl">
                                            {fullName}
                                        </h2>

                                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400">
                                            Customer
                                        </span>

                                        {profile?.isVerified && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                                                <CheckCircle2
                                                    size={12}
                                                />

                                                Verified
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                                        {email}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                        Rent-A-Ride Albay
                                    </p>
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

                            {/* First Name */}
                            {editing ? (
                                <Input
                                    label="First Name"
                                    value={
                                        formData.firstName
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "firstName",
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
                                        First Name
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formData.firstName ||
                                            "Not set"}
                                    </p>
                                </div>
                            )}

                            {/* Last Name */}
                            {editing ? (
                                <Input
                                    label="Last Name"
                                    value={
                                        formData.lastName
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "lastName",
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
                                        Last Name
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formData.lastName ||
                                            "Not set"}
                                    </p>
                                </div>
                            )}

                            {/* Middle Name */}
                            {editing ? (
                                <Input
                                    label="Middle Name"
                                    value={
                                        formData.middleName
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "middleName",
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
                                        Middle Name
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formData.middleName ||
                                            "Not set"}
                                    </p>
                                </div>
                            )}

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

                            {/* Birthdate */}
                            {editing ? (
                                <Input
                                    label="Birthdate"
                                    type="date"
                                    value={
                                        formData.birthdate
                                            ? formData.birthdate.slice(
                                                  0,
                                                  10
                                              )
                                            : ""
                                    }
                                    onChange={(e) =>
                                        handleChange(
                                            "birthdate",
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
                                        Birthdate
                                    </label>

                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formatDate(
                                            formData.birthdate
                                        )}
                                    </p>
                                </div>
                            )}

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
                                label="Province"
                                value={
                                    formData
                                        .address
                                        .province
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "province",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                            />

                            <Input
                                label="City"
                                value={
                                    formData
                                        .address
                                        .city
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "city",
                                        e.target.value
                                    )
                                }
                                disabled={
                                    !editing ||
                                    saving
                                }
                            />

                            <Input
                                label="Barangay"
                                value={
                                    formData
                                        .address
                                        .barangay
                                }
                                onChange={(e) =>
                                    handleAddressChange(
                                        "barangay",
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
                                        .address
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

                        </div>
                    </div>
                </section>

                {/* Emergency Contact */}
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

                {/* Bottom Spacing */}
                <div className="h-4" />
            </div>
        </main>
    );
};

export default Profile;