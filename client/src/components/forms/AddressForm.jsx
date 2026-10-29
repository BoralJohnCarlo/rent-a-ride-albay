import Input from "../common/Input";

const AddressForm = ({
    register,
    errors,
}) => {
    return (
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                    Address Information
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    Keep your address up to date for bookings, deliveries,
                    and account verification.
                </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
                <Input
                    label="Province"
                    placeholder="Enter province"
                    error={errors.address?.province?.message}
                    {...register("address.province")}
                />

                <Input
                    label="City / Municipality"
                    placeholder="Enter city or municipality"
                    error={errors.address?.city?.message}
                    {...register("address.city")}
                />

                <Input
                    label="Barangay"
                    placeholder="Enter barangay"
                    error={errors.address?.barangay?.message}
                    {...register("address.barangay")}
                />

                <Input
                    label="Street Address"
                    placeholder="House No., Street, Subdivision"
                    error={errors.address?.street?.message}
                    {...register("address.street")}
                />
            </div>
        </div>
    );
};

export default AddressForm;