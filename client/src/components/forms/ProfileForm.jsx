import { useEffect } from "react";
import { useForm } from "react-hook-form";

import Alert from "../common/Alert";
import Button from "../common/Button";
import LoadingSpinner from "../common/LoadingSpinner";

import ProfileInformation from "./ProfileInformation";
import AlternativeContactForm from "./AlternativeContactForm";
import AddressForm from "./AddressForm";
import EmergencyContactForm from "./EmergencyContactForm";

import useUser from "../../hooks/useUser";

const ProfileForm = () => {
    const {
        profile,
        loading,
        error,
        getProfile,
        updateProfile,
        clearError,
    } = useUser();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm({
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phoneNumber: "",
            alternativeContact: "",
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
        },
    });

    useEffect(() => {
        if (!profile) {
            getProfile().catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!profile) {
            return;
        }

        reset({
            firstName: profile.firstName ?? "",
            lastName: profile.lastName ?? "",
            email: profile.email ?? "",
            phoneNumber: profile.phoneNumber ?? "",
            alternativeContact:
                profile.alternativeContact ?? "",
            address: {
                province:
                    profile.address?.province ?? "",
                city:
                    profile.address?.city ?? "",
                barangay:
                    profile.address?.barangay ?? "",
                street:
                    profile.address?.street ?? "",
            },
            emergencyContact: {
                name:
                    profile.emergencyContact?.name ??
                    "",
                relationship:
                    profile.emergencyContact
                        ?.relationship ?? "",
                phoneNumber:
                    profile.emergencyContact
                        ?.phoneNumber ?? "",
            },
        });
    }, [profile, reset]);

    const onSubmit = async (data) => {
        clearError();

        try {
            await updateProfile(data);
        } catch {
            // Error handled by Redux.
        }
    };

    if (loading && !profile) {
        return (
            <LoadingSpinner
                message="Loading profile..."
            />
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <Alert
                    variant="error"
                    message={error}
                    dismissible
                    onDismiss={clearError}
                />
            )}

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
            >
                <ProfileInformation
                    register={register}
                    errors={errors}
                    profile={profile}
                />

                <AlternativeContactForm
                    register={register}
                    errors={errors}
                />

                <AddressForm
                    register={register}
                    errors={errors}
                />

                <EmergencyContactForm
                    register={register}
                    errors={errors}
                />

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        loading={loading}
                        disabled={!isDirty}
                    >
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default ProfileForm;