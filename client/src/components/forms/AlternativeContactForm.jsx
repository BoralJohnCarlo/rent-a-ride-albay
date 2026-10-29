import Input from "../common/Input";

const AlternativeContactForm = ({
    register,
    errors,
}) => {
    return (
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                    Alternative Contact
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    Provide an alternative phone number that can be used if we are unable to reach your primary contact.
                </p>
            </div>

            <Input
                label="Alternative Contact Number"
                placeholder="09XXXXXXXXX"
                error={
                    errors.alternativeContact?.message
                }
                {...register("alternativeContact")}
            />
        </div>
    );
};

export default AlternativeContactForm;