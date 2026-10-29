import PageHeader from "../../components/common/PageHeader";

import ProfileForm from "../../components/forms/ProfileForm";
import ChangePasswordForm from "../../components/forms/ChangePasswordForm";

const Profile = () => {
    return (
        <div className="space-y-8">
            <PageHeader
                title="My Profile"
                subtitle="Manage your personal information, contact details, and account security."
            />

            <ProfileForm />

            <ChangePasswordForm />
        </div>
    );
};

export default Profile;