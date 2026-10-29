import Input from "../common/Input";

const EmergencyContactForm = ({
    register,
    errors,
}) => {
    return (
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                    Emergency Contact
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    Add a trusted person we can contact in case of an emergency.
                </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
                <Input
                    label="Full Name"
                    placeholder="Enter full name"
                    error={
                        errors.emergencyContact?.name?.message
                    }
                    {...register("emergencyContact.name")}
                />

                <Input
                    label="Relationship"
                    placeholder="Enter relationship"
                    error={
                        errors.emergencyContact?.relationship?.message
                    }
                    {...register("emergencyContact.relationship")}
                />

                <Input
                    label="Phone Number"
                    placeholder="09XXXXXXXXX"
                    error={
                        errors.emergencyContact?.phoneNumber?.message
                    }
                    {...register("emergencyContact.phoneNumber")}
                />
            </div>
        </div>
    );
};

export default EmergencyContactForm;