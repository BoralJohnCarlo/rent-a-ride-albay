import PageHeader from "../../components/common/PageHeader";
import SettingsHub from "../../components/settings/SettingsHub";

const OperatorSettings = () => (
    <div className="space-y-6">
        <PageHeader
            title="Settings"
            subtitle="Manage your notification sounds and account security."
        />

        <SettingsHub />
    </div>
);

export default OperatorSettings;
