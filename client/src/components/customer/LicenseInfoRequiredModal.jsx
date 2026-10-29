import {
    useEffect,
    useState,
} from "react";

import { CheckCircle2 } from "lucide-react";

import Button from "../common/Button";
import Modal from "../common/Modal";

import useAuth from "../../hooks/auth/useAuth";
import useToast from "../../hooks/toast/useToast";

import { fetchPublicSettings } from "../../services/settingsService";
import { saveProfile } from "../../services/userService";

const LICENSE_CODE_VALUES = ["A", "B"];
const TRANSMISSION_VALUES = ["automatic", "manual"];

const sanitizeCodes = (codes) =>
    Array.isArray(codes)
        ? codes.filter((code) => LICENSE_CODE_VALUES.includes(code))
        : [];

const sanitizeTransmission = (transmission) =>
    Array.isArray(transmission)
        ? transmission.filter((value) => TRANSMISSION_VALUES.includes(value))
        : [];

/*
 * Same rule the registration/profile pickers use: choosing "manual" also
 * grants "automatic" (a manual-capable driver can drive an automatic too),
 * and re-clicking once both are set clears the selection.
 */
const toggleTransmissionValue = (current, value) => {
    if (current.length === 2) {
        return [];
    }

    if (value === "manual") {
        return current.includes("manual")
            ? current.filter((t) => t !== "manual")
            : [...current, "manual", "automatic"];
    }

    return current.includes(value)
        ? current.filter((t) => t !== value)
        : [...current, value];
};

/*
 * Same cross-field rule enforced at registration and on the profile page
 * (server/validators/licenseValidators.js): no codes on file at all is a
 * profile-completeness gap, and so is a selected code without its
 * transmission declared.
 *
 * Exception: a customer who has explicitly said they have no driver's
 * license at all (hasDriversLicense === false) has nothing to be missing -
 * empty codes is the correct, complete state for them, not a gap to nag
 * about. Only customers who never answered (null/undefined, every
 * pre-existing account) or who said yes but haven't filled in codes yet
 * should be prompted.
 */
const isMissingLicenseInfo = (user) => {
    if (user?.hasDriversLicense === false) {
        return false;
    }

    const codes = sanitizeCodes(user?.licenseCodes);

    if (codes.length === 0) {
        return true;
    }

    if (
        codes.includes("A") &&
        sanitizeTransmission(user?.motorcycleTransmission).length === 0
    ) {
        return true;
    }

    if (
        codes.includes("B") &&
        sanitizeTransmission(user?.carTransmission).length === 0
    ) {
        return true;
    }

    return false;
};

/*
 * Same interaction pattern as the license-codes/transmission picker in
 * Register.jsx and Profile.jsx, kept local here since this modal has its
 * own independent form state.
 */
const OptionButton = ({ selected, onClick, code, label }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group relative flex flex-col items-center justify-center rounded-lg border p-4 transition-all duration-200 ${
            selected
                ? "border-yellow-400 bg-yellow-50/50 ring-1 ring-yellow-400 dark:bg-yellow-900/20"
                : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
        }`}
    >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {code}
            </span>
        </div>

        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {label}
        </div>

        {selected && (
            <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white">
                <CheckCircle2 size={12} />
            </div>
        )}
    </button>
);

/*
 * Prompts a customer to fill in what they're licensed to drive when an
 * admin turns the license-restriction setting back on and this account
 * (created, or last edited, while the setting was off) is missing that
 * info. Mounted once in CustomerLayout so it's checked on every fresh
 * layout load without re-nagging on every in-app navigation.
 */
const LicenseInfoRequiredModal = () => {
    const { user, updateUser } = useAuth();
    const toast = useToast();

    const [restrictionEnabled, setRestrictionEnabled] = useState(false);
    const [settingsChecked, setSettingsChecked] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const [licenseCodes, setLicenseCodes] = useState([]);
    const [motorcycleTransmission, setMotorcycleTransmission] = useState([]);
    const [carTransmission, setCarTransmission] = useState([]);

    const userId = user?.id;
    const userRole = user?.role;

    useEffect(() => {
        if (!userId || userRole !== "customer") {
            return undefined;
        }

        let cancelled = false;

        fetchPublicSettings()
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setRestrictionEnabled(
                    Boolean(response?.data?.licenseRestrictionEnabled)
                );
            })
            .catch(() => {
                // Fail closed - don't prompt if we couldn't confirm the setting.
            })
            .finally(() => {
                if (!cancelled) {
                    setSettingsChecked(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [userId, userRole]);

    useEffect(() => {
        setLicenseCodes(sanitizeCodes(user?.licenseCodes));
        setMotorcycleTransmission(
            sanitizeTransmission(user?.motorcycleTransmission)
        );
        setCarTransmission(sanitizeTransmission(user?.carTransmission));
    }, [user]);

    const isOpen =
        settingsChecked &&
        restrictionEnabled &&
        !dismissed &&
        user?.role === "customer" &&
        isMissingLicenseInfo(user);

    const toggleCode = (code) => {
        setLicenseCodes((previous) =>
            previous.includes(code)
                ? previous.filter((c) => c !== code)
                : [...previous, code]
        );
    };

    const handleSave = async () => {
        const nextErrors = {};

        if (licenseCodes.length === 0) {
            nextErrors.licenseCodes =
                "Please select at least one driving category.";
        }

        if (
            licenseCodes.includes("A") &&
            motorcycleTransmission.length === 0
        ) {
            nextErrors.motorcycleTransmission =
                "Please select your motorcycle transmission.";
        }

        if (
            licenseCodes.includes("B") &&
            carTransmission.length === 0
        ) {
            nextErrors.carTransmission =
                "Please select your car transmission.";
        }

        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        try {
            setSaving(true);

            const result = await saveProfile({
                licenseCodes,
                motorcycleTransmission: licenseCodes.includes("A")
                    ? motorcycleTransmission
                    : [],
                carTransmission: licenseCodes.includes("B")
                    ? carTransmission
                    : [],
            });

            if (result?.data) {
                updateUser(result.data);
            }

            toast.success(
                "Thanks! Your license information has been saved.",
                "Profile Updated"
            );
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    "Unable to save your license information.",
                "Error"
            );
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setDismissed(true)}
            title="Complete Your License Information"
            closeOnOverlayClick={false}
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDismissed(true)}
                        disabled={saving}
                    >
                        Remind Me Later
                    </Button>

                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={saving}
                    >
                        Save
                    </Button>
                </>
            }
        >
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                We now require this information before you can book a
                vehicle. Please let us know what you're licensed to drive.
            </p>

            <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    What are you licensed to drive?
                    <span className="ml-1 text-red-500">*</span>
                </h3>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <OptionButton
                        code="A"
                        label="Motorcycle"
                        selected={licenseCodes.includes("A")}
                        onClick={() => toggleCode("A")}
                    />

                    <OptionButton
                        code="B"
                        label="Passenger Car"
                        selected={licenseCodes.includes("B")}
                        onClick={() => toggleCode("B")}
                    />
                </div>

                {errors.licenseCodes && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {errors.licenseCodes}
                    </p>
                )}
            </div>

            {licenseCodes.includes("A") && (
                <div className="mt-6 space-y-1.5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Motorcycle Transmission
                        <span className="ml-1 text-red-500">*</span>
                    </h3>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <OptionButton
                            code="AT"
                            label="Automatic"
                            selected={motorcycleTransmission.includes(
                                "automatic"
                            )}
                            onClick={() =>
                                setMotorcycleTransmission((previous) =>
                                    toggleTransmissionValue(
                                        previous,
                                        "automatic"
                                    )
                                )
                            }
                        />

                        <OptionButton
                            code="MT"
                            label="Manual"
                            selected={motorcycleTransmission.includes(
                                "manual"
                            )}
                            onClick={() =>
                                setMotorcycleTransmission((previous) =>
                                    toggleTransmissionValue(
                                        previous,
                                        "manual"
                                    )
                                )
                            }
                        />
                    </div>

                    {errors.motorcycleTransmission && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                            {errors.motorcycleTransmission}
                        </p>
                    )}
                </div>
            )}

            {licenseCodes.includes("B") && (
                <div className="mt-6 space-y-1.5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Car Transmission
                        <span className="ml-1 text-red-500">*</span>
                    </h3>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <OptionButton
                            code="AT"
                            label="Automatic"
                            selected={carTransmission.includes("automatic")}
                            onClick={() =>
                                setCarTransmission((previous) =>
                                    toggleTransmissionValue(
                                        previous,
                                        "automatic"
                                    )
                                )
                            }
                        />

                        <OptionButton
                            code="MT"
                            label="Manual"
                            selected={carTransmission.includes("manual")}
                            onClick={() =>
                                setCarTransmission((previous) =>
                                    toggleTransmissionValue(
                                        previous,
                                        "manual"
                                    )
                                )
                            }
                        />
                    </div>

                    {errors.carTransmission && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                            {errors.carTransmission}
                        </p>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default LicenseInfoRequiredModal;
