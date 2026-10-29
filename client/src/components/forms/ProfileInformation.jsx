import Avatar from "../common/Avatar";
import Input from "../common/Input";

const ProfileInformation = ({
    register,
    errors,
    profile,
}) => {
    return (
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-6 flex flex-col items-center gap-4">
                <Avatar
                    src={profile?.profileImage}
                    name={`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`}
                    size="xl"
                />

                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Profile Information
                    </h2>

                    <p className="text-sm text-gray-500">
                        Update your personal information.
                    </p>
                </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
                <Input
                    label="First Name"
                    placeholder="Enter first name"
                    error={errors.firstName?.message}
                    {...register("firstName")}
                />

                <Input
                    label="Last Name"
                    placeholder="Enter last name"
                    error={errors.lastName?.message}
                    {...register("lastName")}
                />

                <Input
                    label="Email Address"
                    type="email"
                    disabled
                    {...register("email")}
                />

                <Input
                    label="Phone Number"
                    placeholder="09XXXXXXXXX"
                    error={errors.phoneNumber?.message}
                    {...register("phoneNumber")}
                />
            </div>
        </div>
    );
};

export default ProfileInformation;