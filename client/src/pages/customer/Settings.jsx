import SettingsHub from "../../components/settings/SettingsHub";

// Same settings as the partner Settings page (pages/operator/Settings.jsx),
// in the customer site's page frame. Reached from the user menu only.
const CustomerSettings = () => (
    <main className="min-h-screen bg-[#f8f9fb] px-4 pb-12 pt-24 dark:bg-gray-950 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
            <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                    Account
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                    Settings
                </h1>

                <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                    Manage your notification sounds and account security.
                </p>
            </div>

            <SettingsHub />
        </div>
    </main>
);

export default CustomerSettings;
