import { useState } from "react";

import {
    Clock3,
    Info,
    LockKeyhole,
} from "lucide-react";

import Alert from "../common/Alert";
import Button from "../common/Button";
import Input from "../common/Input";
import PasswordChecklist from "./PasswordChecklist";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

import useAuth from "../../hooks/auth/useAuth";
import useSocket from "../../hooks/shared/useSocket";
import useToast from "../../hooks/toast/useToast";

import { changePassword } from "../../api/userApi";
import { getPasswordRules } from "../../utils/passwordRules";
import { formatRelative } from "../../utils/relativeTime";

const EMPTY_FORM = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
};

const formatDateTime = (date) =>
    new Date(date).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
    });

const firstFieldErrors = (errors) => {
    if (!Array.isArray(errors)) return {};

    return errors.reduce((byField, entry) => {
        const field = entry?.path || entry?.param;

        if (field && entry?.msg && !byField[field]) {
            byField[field] = entry.msg;
        }

        return byField;
    }, {});
};

const ChangePasswordForm = () => {
    const { user, updateUser } = useAuth();
    const { socket } = useSocket();
    const toast = useToast();

    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    const rules = getPasswordRules(form);
    const allRulesMet = rules.every((rule) => rule.met);
    const passwordChangedAt = user?.passwordChangedAt;

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({ ...previous, [name]: value }));
        setFieldErrors((previous) => ({ ...previous, [name]: "" }));
        setError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.currentPassword) {
            setFieldErrors({ currentPassword: "Enter your current password." });
            return;
        }

        if (!allRulesMet || submitting) {
            return;
        }

        setSubmitting(true);
        setError("");
        setFieldErrors({});

        try {
            const response = await changePassword(form);

            setForm(EMPTY_FORM);
            updateUser({
                passwordChangedAt:
                    response.data?.passwordChangedAt ||
                    new Date().toISOString(),
            });

            // The server dropped every live socket for this account; come
            // back with the fresh cookie it just set.
            socket.disconnect();
            socket.connect();

            toast.success(
                "Your other devices were signed out. We've emailed you a confirmation.",
                "Password changed",
                5000
            );
        } catch (requestError) {
            const data = requestError.response?.data;
            const byField = firstFieldErrors(data?.errors);

            if (data?.message === "Current password is incorrect.") {
                byField.currentPassword = data.message;
            } else if (data?.message?.startsWith("Your new password must be different")) {
                byField.newPassword = data.message;
            }

            setFieldErrors(byField);

            if (Object.keys(byField).length === 0) {
                setError(
                    data?.message ||
                        "Couldn't change your password. Please try again."
                );
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                    Security
                </p>

                <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                    Change Password
                </h2>

                <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Clock3 size={15} className="shrink-0" />
                    {passwordChangedAt ? (
                        <span>
                            Last changed{" "}
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                                {formatRelative(passwordChangedAt)}
                            </span>{" "}
                            ({formatDateTime(passwordChangedAt)})
                        </span>
                    ) : (
                        <span>
                            You haven't changed your password since you
                            created your account.
                        </span>
                    )}
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                noValidate
                className="grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]"
            >
                <div className="space-y-5">
                    {error && (
                        <Alert
                            variant="error"
                            message={error}
                            dismissible
                            onDismiss={() => setError("")}
                        />
                    )}

                    <Input
                        label="Current Password"
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your current password"
                        value={form.currentPassword}
                        onChange={handleChange}
                        error={fieldErrors.currentPassword}
                        leftIcon={<LockKeyhole size={18} />}
                    />

                    <div className="space-y-2">
                        <Input
                            label="New Password"
                            name="newPassword"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Enter a new password"
                            value={form.newPassword}
                            onChange={handleChange}
                            error={fieldErrors.newPassword}
                            leftIcon={<LockKeyhole size={18} />}
                        />

                        <PasswordStrengthMeter password={form.newPassword} />
                    </div>

                    <Input
                        label="Confirm New Password"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Re-enter the new password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        error={fieldErrors.confirmPassword}
                        leftIcon={<LockKeyhole size={18} />}
                    />

                    <div className="flex justify-end pt-1">
                        <Button
                            type="submit"
                            variant="brand"
                            loading={submitting}
                            disabled={!allRulesMet || !form.currentPassword}
                        >
                            Change Password
                        </Button>
                    </div>
                </div>

                <aside className="space-y-5">
                    <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Your new password needs
                        </p>

                        <PasswordChecklist rules={rules} className="mt-3" />
                    </div>

                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-gray-700 dark:border-yellow-500/20 dark:bg-yellow-500/10 dark:text-gray-300">
                        <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                            <Info size={16} className="text-yellow-600 dark:text-yellow-400" />
                            Good to know
                        </p>

                        <ul className="mt-2 list-disc space-y-1.5 pl-5">
                            <li>
                                Don't reuse a password from another site or
                                app.
                            </li>
                            <li>
                                You'll stay signed in here, but every other
                                device will be signed out.
                            </li>
                            <li>
                                We'll email you and send an in-app notice so
                                you know it happened.
                            </li>
                        </ul>
                    </div>
                </aside>
            </form>
        </section>
    );
};

export default ChangePasswordForm;
