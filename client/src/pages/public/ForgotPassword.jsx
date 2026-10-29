import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";

import {
    ArrowLeft,
    ArrowRight,
    Check,
    KeyRound,
    LockKeyhole,
    Mail,
    MailCheck,
    RotateCcw,
    Send,
    ShieldCheck,
    TimerReset,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import PasswordChecklist from "../../components/forms/PasswordChecklist";
import PasswordStrengthMeter from "../../components/forms/PasswordStrengthMeter";
import PlateCodeInput from "../../components/auth/PlateCodeInput";
import RecoveryRoad from "../../components/auth/RecoveryRoad";

import useCountdown, { formatCountdown } from "../../hooks/useCountdown";

import {
    requestPasswordReset,
    resetPassword,
    verifyPasswordResetCode,
} from "../../api/authApi";
import { getPasswordRules } from "../../utils/passwordRules";

import backdrop from "../../assets/images/slideshow/image3.png";

const STEPS = [
    { label: "Your email", hint: "Where we send the code" },
    { label: "Verify code", hint: "6 digits from your inbox" },
    { label: "New password", hint: "Something only you know" },
];

const STEP = { EMAIL: 0, CODE: 1, PASSWORD: 2, DONE: 3 };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const slide = {
    enter: (direction) => ({ opacity: 0, x: direction * 48 }),
    center: { opacity: 1, x: 0 },
    exit: (direction) => ({ opacity: 0, x: direction * -48 }),
};

// "juan.delacruz@gmail.com" → "j•••••••••z@gmail.com"
const maskEmail = (email) => {
    const [name, domain] = email.split("@");

    if (!domain || name.length < 3) {
        return email;
    }

    return `${name[0]}${"•".repeat(Math.min(name.length - 2, 8))}${name.at(-1)}@${domain}`;
};

const messageOf = (error, fallback) =>
    error.response?.data?.message || fallback;

const StepHeading = ({ eyebrow, title, children }) => (
    <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
            {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950 dark:text-white sm:text-[1.7rem]">
            {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {children}
        </p>
    </div>
);

// The "ignition" moment: the key turns, then the check lights up.
const Ignition = () => (
    <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
        <motion.span
            className="absolute inset-0 rounded-full border-2 border-yellow-400"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1.55], opacity: [0.9, 0] }}
            transition={{ duration: 1.3, delay: 0.85, repeat: 2, ease: "easeOut" }}
        />

        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg shadow-yellow-500/30" />

        <motion.span
            className="relative text-gray-950"
            initial={{ rotate: -90, opacity: 1 }}
            animate={{ rotate: [-90, -90, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 0.9, times: [0, 0.35, 1], ease: "easeInOut" }}
        >
            <KeyRound size={38} strokeWidth={2.2} />
        </motion.span>

        <motion.span
            className="absolute text-gray-950"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.85 }}
        >
            <Check size={44} strokeWidth={3} />
        </motion.span>
    </div>
);

const ForgotPassword = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState(STEP.EMAIL);
    const [direction, setDirection] = useState(1);

    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });

    const [resendAt, setResendAt] = useState(null);
    const [codeExpiresAt, setCodeExpiresAt] = useState(null);
    const [sessionExpiresAt, setSessionExpiresAt] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [fieldError, setFieldError] = useState("");
    const [shakeKey, setShakeKey] = useState(0);
    const [codeInvalid, setCodeInvalid] = useState(false);

    const resendIn = useCountdown(resendAt);
    const codeLeft = useCountdown(codeExpiresAt);
    const sessionLeft = useCountdown(sessionExpiresAt);

    const rules = getPasswordRules(form);
    const allRulesMet = rules.every((rule) => rule.met);
    const sessionExpired = step === STEP.PASSWORD && sessionExpiresAt && sessionLeft === 0;

    const goTo = (next) => {
        setDirection(next > step ? 1 : -1);
        setError("");
        setNotice("");
        setFieldError("");
        setStep(next);
    };

    const sendCode = async ({ resend = false } = {}) => {
        const trimmed = email.trim();

        if (!EMAIL_PATTERN.test(trimmed)) {
            setFieldError("Please enter a valid email address.");
            return;
        }

        setLoading(true);
        setError("");
        setFieldError("");

        try {
            const { data } = await requestPasswordReset(trimmed);
            const now = Date.now();

            setEmail(trimmed);
            setCode("");
            setCodeInvalid(false);
            setResendAt(now + data.resendAvailableIn * 1000);
            setCodeExpiresAt(now + data.codeExpiresIn * 1000);

            if (resend) {
                setNotice("A new code is on its way. Earlier codes no longer work.");
            } else {
                goTo(STEP.CODE);
            }
        } catch (requestError) {
            setError(messageOf(requestError, "We couldn't send a code right now. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async (fullCode = code) => {
        if (loading || fullCode.length !== 6) {
            return;
        }

        setLoading(true);
        setError("");
        setNotice("");

        try {
            const { data } = await verifyPasswordResetCode(email, fullCode);

            setResetToken(data.resetToken);
            setSessionExpiresAt(Date.now() + data.expiresIn * 1000);
            goTo(STEP.PASSWORD);
        } catch (requestError) {
            setError(messageOf(requestError, "We couldn't check that code. Please try again."));
            setCode("");
            setCodeInvalid(true);
            setShakeKey((key) => key + 1);
        } finally {
            setLoading(false);
        }
    };

    const submitPassword = async (event) => {
        event.preventDefault();

        if (!allRulesMet || loading || sessionExpired) {
            return;
        }

        setLoading(true);
        setError("");
        setFieldError("");

        try {
            await resetPassword({ email, resetToken, ...form });

            setResetToken("");
            setSessionExpiresAt(null);
            goTo(STEP.DONE);
        } catch (requestError) {
            const message = messageOf(requestError, "We couldn't reset your password. Please try again.");

            if (/different from your old one/.test(message)) {
                setFieldError(message);
            } else {
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const startOver = () => {
        setCode("");
        setResetToken("");
        setSessionExpiresAt(null);
        setForm({ newPassword: "", confirmPassword: "" });
        goTo(STEP.EMAIL);
    };

    const renderStep = () => {
        if (step === STEP.EMAIL) {
            return (
                <form
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        sendCode();
                    }}
                    className="space-y-6"
                >
                    <StepHeading eyebrow="Account recovery" title="Lost your keys?">
                        It happens. Enter the email on your account and we'll
                        send a 6-digit code to get you back behind the wheel.
                    </StepHeading>

                    <Input
                        id="email"
                        name="email"
                        type="email"
                        label="Email address"
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(event) => {
                            setEmail(event.target.value);
                            setFieldError("");
                            setError("");
                        }}
                        error={fieldError}
                        leftIcon={<Mail size={18} />}
                    />

                    <Button
                        type="submit"
                        variant="brand"
                        fullWidth
                        loading={loading}
                        rightIcon={<Send size={17} />}
                    >
                        Send reset code
                    </Button>
                </form>
            );
        }

        if (step === STEP.CODE) {
            return (
                <div className="space-y-6">
                    <StepHeading eyebrow="Step 2 of 3" title="Check your inbox">
                        Enter the 6-digit code we sent to{" "}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {maskEmail(email)}
                        </span>
                        . If an account uses this email, it'll arrive in a
                        minute — check spam too.
                    </StepHeading>

                    <PlateCodeInput
                        value={code}
                        onChange={(next) => {
                            setCode(next);
                            setCodeInvalid(false);
                        }}
                        onComplete={verifyCode}
                        disabled={loading}
                        invalid={codeInvalid}
                        shakeKey={shakeKey}
                    />

                    <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <TimerReset size={14} />
                        {codeLeft > 0 ? (
                            <>
                                Code expires in{" "}
                                <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">
                                    {formatCountdown(codeLeft)}
                                </span>
                            </>
                        ) : (
                            "This code has expired — send a new one below."
                        )}
                    </p>

                    <Button
                        variant="brand"
                        fullWidth
                        loading={loading}
                        disabled={code.length !== 6}
                        onClick={() => verifyCode()}
                        rightIcon={<ArrowRight size={17} />}
                    >
                        Verify code
                    </Button>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <button
                            type="button"
                            onClick={() => goTo(STEP.EMAIL)}
                            className="font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        >
                            Wrong email? Change it
                        </button>

                        <button
                            type="button"
                            onClick={() => sendCode({ resend: true })}
                            disabled={resendIn > 0 || loading}
                            className="inline-flex items-center gap-1.5 font-semibold text-yellow-600 transition-colors hover:text-yellow-700 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-yellow-400 dark:hover:text-yellow-300 dark:disabled:text-gray-600"
                        >
                            <RotateCcw size={14} />
                            {resendIn > 0
                                ? `Resend in ${formatCountdown(resendIn)}`
                                : "Resend code"}
                        </button>
                    </div>
                </div>
            );
        }

        if (step === STEP.PASSWORD) {
            return (
                <form noValidate onSubmit={submitPassword} className="space-y-5">
                    <StepHeading eyebrow="Step 3 of 3" title="Cut a new key">
                        Choose a new password for{" "}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {email}
                        </span>
                        . You'll use it the next time you sign in.
                    </StepHeading>

                    {sessionExpired ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                This reset session timed out.
                            </p>
                            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                                For your security it only lasts 10 minutes.
                                Request a fresh code to continue.
                            </p>
                            <Button
                                variant="dark"
                                size="sm"
                                className="mt-4"
                                onClick={startOver}
                                leftIcon={<RotateCcw size={15} />}
                            >
                                Start over
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Input
                                    label="New password"
                                    name="newPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    autoFocus
                                    placeholder="Enter a new password"
                                    value={form.newPassword}
                                    onChange={(event) => {
                                        setForm((previous) => ({ ...previous, newPassword: event.target.value }));
                                        setFieldError("");
                                    }}
                                    error={fieldError}
                                    leftIcon={<LockKeyhole size={18} />}
                                />
                                <PasswordStrengthMeter password={form.newPassword} />
                            </div>

                            <Input
                                label="Confirm new password"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                placeholder="Re-enter the new password"
                                value={form.confirmPassword}
                                onChange={(event) =>
                                    setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))
                                }
                                leftIcon={<LockKeyhole size={18} />}
                            />

                            <PasswordChecklist
                                rules={rules}
                                columns
                                className="[&>li]:text-[13px]"
                            />

                            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                                <span className="inline-flex items-center gap-1.5 self-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:self-auto">
                                    <ShieldCheck size={14} className="text-green-600 dark:text-green-400" />
                                    Secure session ·{" "}
                                    <span className="tabular-nums">{formatCountdown(sessionLeft)}</span> left
                                </span>

                                <Button
                                    type="submit"
                                    variant="brand"
                                    loading={loading}
                                    disabled={!allRulesMet}
                                    rightIcon={<KeyRound size={17} />}
                                >
                                    Reset password
                                </Button>
                            </div>
                        </>
                    )}
                </form>
            );
        }

        return (
            <div className="space-y-6 text-center">
                <Ignition />

                <div>
                    <h1 className="text-2xl font-black tracking-tight text-gray-950 dark:text-white sm:text-[1.7rem]">
                        You're back on the road
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                        Your password has been reset. Sign in with your new
                        password to pick up where you left off.
                    </p>
                </div>

                <ul className="space-y-2.5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                    <li className="flex items-start gap-2.5">
                        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                        Every device that was signed in to your account has been
                        signed out.
                    </li>
                    <li className="flex items-start gap-2.5">
                        <MailCheck size={18} className="mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                        We've emailed {maskEmail(email)} a confirmation. Didn't
                        do this? Contact support right away.
                    </li>
                </ul>

                <Button
                    variant="brand"
                    fullWidth
                    onClick={() =>
                        navigate("/login", {
                            replace: true,
                            state: { email, passwordReset: true },
                        })
                    }
                    rightIcon={<ArrowRight size={17} />}
                >
                    Sign in now
                </Button>
            </div>
        );
    };

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-y-auto bg-gray-950 px-4 py-10 sm:px-6 sm:py-16 lg:py-24">
            {/* Backdrop - same treatment as the login page */}
            <div className="pointer-events-none absolute inset-0">
                <img
                    src={backdrop}
                    alt=""
                    className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px]"
                />
                <div className="absolute inset-0 bg-gray-950/70" />
                <div className="absolute inset-0 bg-yellow-500/15 mix-blend-color" />
                <div className="absolute inset-0 bg-gradient-to-br from-gray-950/80 via-gray-950/50 to-yellow-950/30" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 20 }}
                className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/50 md:grid md:grid-cols-[17rem_minmax(0,1fr)]"
            >
                {/* Journey panel */}
                <aside className="relative bg-gray-950/85 p-5 backdrop-blur-xl md:flex md:flex-col md:p-7">
                    <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-400/10 blur-3xl" />

                    <div className="relative flex items-center gap-2 text-sm font-bold text-white">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400 text-gray-950">
                            <KeyRound size={17} strokeWidth={2.4} />
                        </span>
                        Rent-A-Ride Albay
                    </div>

                    <p className="relative mt-6 hidden text-lg font-black leading-snug text-white md:block">
                        Get back behind the wheel in three stops.
                    </p>

                    <div className="relative mt-5 md:hidden">
                        <RecoveryRoad steps={STEPS} current={step} orientation="horizontal" />
                    </div>

                    <div className="relative mt-8 hidden md:block">
                        <RecoveryRoad steps={STEPS} current={step} orientation="vertical" />
                    </div>

                    <p className="relative mt-auto hidden pt-10 text-xs leading-5 text-white/45 md:block">
                        Codes expire after 15 minutes. Our team will never ask
                        you for your code.
                    </p>
                </aside>

                {/* Form panel */}
                <section className="flex min-h-[30rem] flex-col bg-white p-6 dark:bg-gray-900 sm:p-9">
                    <div className="relative flex-1">
                        <AnimatePresence mode="wait" custom={direction} initial={false}>
                            <motion.div
                                key={step}
                                custom={direction}
                                variants={slide}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.28, ease: "easeOut" }}
                            >
                                {(error || notice) && (
                                    <Alert
                                        variant={error ? "error" : "success"}
                                        message={error || notice}
                                        dismissible
                                        onDismiss={() => {
                                            setError("");
                                            setNotice("");
                                        }}
                                        className="mb-5"
                                    />
                                )}

                                {renderStep()}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {step !== STEP.DONE && (
                        <div className="mt-8 flex justify-center border-t border-gray-100 pt-5 dark:border-gray-800">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                            >
                                <ArrowLeft size={16} />
                                Back to sign in
                            </Link>
                        </div>
                    )}
                </section>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;
