import {
    useEffect,
    useState,
} from "react";

import {
    Link,
    useLocation,
    useNavigate,
    useSearchParams,
} from "react-router-dom";

import {
    ArrowRight,
    Car,
    Lock,
    Mail,
} from "lucide-react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import useAuth from "../../hooks/auth/useAuth";

import image1 from "../../assets/images/slideshow/image1.webp";
import image2 from "../../assets/images/slideshow/image2.webp";
import image3 from "../../assets/images/slideshow/image3.png";
import image4 from "../../assets/images/slideshow/image4.jpg";
import image5 from "../../assets/images/slideshow/image5.png";

const LOGIN_IMAGES = [
    image1,
    image2,
    image3,
    image4,
    image5,
];

const Login = () => {
    const {
        login,
        loading,
        error,
        clearError,
        isAuthenticated,
    } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Arriving from a finished password reset (ForgotPassword.jsx).
    const justReset = Boolean(location.state?.passwordReset);

    const [formData, setFormData] = useState({
        email: location.state?.email || "",
        password: "",
    });

    const [validationError, setValidationError] =
        useState("");

    const [validationField, setValidationField] =
        useState("");

    const [currentImage, setCurrentImage] =
        useState(0);

    const [
        leavingForPartner,
        setLeavingForPartner,
    ] = useState(false);

    // In-app paths only (see GuestRoute) — never another site.
    const requestedRedirect = searchParams.get("redirect") || "";
    const redirectTo =
        requestedRedirect.startsWith("/") &&
        !requestedRedirect.startsWith("//") &&
        !requestedRedirect.startsWith("/\\")
            ? requestedRedirect
            : "/";

    const handleGoToPartner = (event) => {
        // Let modified clicks (new tab / window) behave normally.
        if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button === 1
        ) {
            return;
        }

        event.preventDefault();
        setLeavingForPartner(true);
    };

    useEffect(() => {
        clearError();
    }, [clearError]);

    useEffect(() => {
        if (isAuthenticated) {
            navigate(redirectTo, {
                replace: true,
            });
        }
    }, [isAuthenticated, navigate, redirectTo]);

    useEffect(() => {
        if (LOGIN_IMAGES.length <= 1) {
            return undefined;
        }

        LOGIN_IMAGES.forEach((src) => {
            const image = new Image();

            image.src = src;
        });

        const interval =
            window.setInterval(() => {
                setCurrentImage(
                    (previous) =>
                        (previous + 1) %
                        LOGIN_IMAGES.length
                );
            }, 5000);

        return () => {
            window.clearInterval(
                interval
            );
        };
    }, []);

    const handleChange = ({
        target,
    }) => {
        const {
            name,
            value,
        } = target;

        if (error) {
            clearError();
        }

        if (validationError) {
            setValidationError("");
            setValidationField("");
        }

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleSubmit = async (
        event
    ) => {
        event.preventDefault();

        if (loading) {
            return;
        }

        setValidationError("");
        setValidationField("");

        const email =
            formData.email.trim();
        const password =
            formData.password;

        if (!email) {
            setValidationError(
                "Please enter your email address."
            );
            setValidationField("email");

            return;
        }

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email
            )
        ) {
            setValidationError(
                "Please enter a valid email address."
            );
            setValidationField("email");

            return;
        }

        if (!password) {
            setValidationError(
                "Please enter your password."
            );
            setValidationField("password");

            return;
        }

        setValidationError("");
        setValidationField("");

        try {
            await login({
                email,
                password,
            });
        } catch {
            // Error is handled by Redux.
        }
    };


    return (
        <div
            className="
                relative
                flex
                min-h-screen
                w-full
                items-center
                justify-center
                overflow-hidden
                bg-gray-950
                px-4
                py-10
                sm:px-6
                sm:py-14
                lg:px-8
            "
        >
            <div
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    overflow-hidden
                "
            >
                <AnimatePresence initial={false}>
                    <motion.img
                        key={currentImage}
                        src={
                            LOGIN_IMAGES[
                                currentImage
                            ]
                        }
                        alt=""
                        initial={{
                            opacity: 0,
                            scale: 1.03,
                        }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            scale: 1.01,
                        }}
                        transition={{
                            opacity: {
                                duration: 1.4,
                                ease: "easeInOut",
                            },
                            scale: {
                                duration: 6,
                                ease: "linear",
                            },
                        }}
                        className="
                            absolute
                            inset-0
                            h-full
                            w-full
                            object-cover
                            object-center
                        "
                    />
                </AnimatePresence>

                <div
                    className="
                        absolute
                        inset-0
                        bg-gray-950/55
                    "
                />

                <div
                    className="
                        absolute
                        inset-0
                        bg-yellow-500/15
                        mix-blend-color
                    "
                />

                <div
                    className="
                        absolute
                        inset-0
                        bg-gradient-to-br
                        from-gray-950/70
                        via-gray-950/45
                        to-yellow-950/20
                    "
                />

                <div
                    className="
                        absolute
                        inset-0
                        bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.20)_100%)]
                    "
                />
            </div>

            <motion.div
                initial={{
                    opacity: 0,
                    y: 20,
                }}
                animate={{
                    opacity: 1,
                    y: 0,
                }}
                transition={{
                    duration: 0.55,
                    ease: "easeOut",
                }}
                className="
                    relative
                    z-10
                    mx-auto
                    w-full
                    max-w-md
                "
            >
                <div
                    className="
                        w-full
                    "
                >
                    <motion.div
                        initial={{
                            opacity: 0,
                            x: -40,
                            scale: 0.97,
                        }}
                        animate={
                            leavingForPartner
                                ? {
                                      opacity: 0,
                                      x: 60,
                                      scale: 0.96,
                                  }
                                : {
                                      opacity: 1,
                                      x: 0,
                                      scale: 1,
                                  }
                        }
                        transition={
                            leavingForPartner
                                ? {
                                      duration: 0.32,
                                      ease: [0.4, 0, 1, 1],
                                  }
                                : {
                                      type: "spring",
                                      stiffness: 190,
                                      damping: 21,
                                      mass: 0.9,
                                      delay: 0.18,
                                  }
                        }
                        onAnimationComplete={() => {
                            if (leavingForPartner) {
                                navigate(
                                    "/register-operator"
                                );
                            }
                        }}
                        className="
                            w-full
                        "
                    >
                        <div
                            className="
                                relative
                                overflow-hidden
                                rounded-2xl
                                border
                                border-white/80
                                bg-white
                                p-5
                                shadow-2xl
                                shadow-black/30
                                sm:p-6
                                dark:border-gray-700
                                dark:bg-gray-900
                            "
                        >
                            <motion.div
                                initial={{
                                    opacity: 0,
                                    y: 12,
                                }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                }}
                                transition={{
                                    duration: 0.4,
                                    delay: 0.35,
                                }}
                            >
                                <h1
                                    className="
                                        mb-1
                                        text-center
                                        text-xl
                                        font-bold
                                        tracking-tight
                                        text-gray-950
                                        dark:text-white
                                    "
                                >
                                    Welcome Back
                                </h1>

                                <p
                                    className="
                                        mb-5
                                        text-center
                                        text-xs
                                        text-gray-500
                                        dark:text-gray-400
                                    "
                                >
                                    Sign in to your
                                    Rent-A-Ride Albay
                                    account
                                </p>
                            </motion.div>

                            {justReset && !error && !validationError && (
                                <Alert
                                    variant="success"
                                    message="Password updated. Sign in with your new password."
                                    className="mb-5"
                                />
                            )}

                            {error && (
                                <Alert
                                    variant="error"
                                    message={error}
                                    className="mb-5"
                                />
                            )}

                            {validationError && (
                                <Alert
                                    variant="error"
                                    message={validationError}
                                    className="mb-5"
                                />
                            )}

                            <form
                                onSubmit={
                                    handleSubmit
                                }
                                className="space-y-3.5"
                            >
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    label="Email"
                                    placeholder="Enter your email"
                                    value={
                                        formData.email
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    autoComplete="email"
                                    className="!py-2.5 text-sm"
                                    leftIcon={
                                        <Mail
                                            size={
                                                16
                                            }
                                        />
                                    }
                                    error={
                                        validationField ===
                                            "email"
                                            ? validationError
                                            : ""
                                    }
                                    required
                                />

                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    label="Password"
                                    placeholder="Enter your password"
                                    value={
                                        formData.password
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    autoComplete="current-password"
                                    className="!py-2.5 text-sm"
                                    leftIcon={
                                        <Lock
                                            size={
                                                16
                                            }
                                        />
                                    }
                                    error={
                                        validationField ===
                                            "password"
                                            ? validationError
                                            : ""
                                    }
                                    required
                                />

                                <div className="pt-1">
                                    <Button
                                        type="submit"
                                        size="sm"
                                        fullWidth
                                        loading={
                                            loading
                                        }
                                        className="
                                            !border-yellow-400
                                            !bg-yellow-400
                                            !text-gray-950
                                            hover:!bg-yellow-300
                                        "
                                    >
                                        Sign In
                                    </Button>
                                </div>
                            </form>

                            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-center text-xs dark:border-yellow-500/20 dark:bg-yellow-500/10">
                                <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                    <Car
                                        size={13}
                                        className="text-yellow-500 dark:text-yellow-400"
                                    />
                                    Have a Vehicle you want to consign?
                                </span>

                                <Link
                                    to="/register-operator"
                                    onClick={handleGoToPartner}
                                    className="inline-flex items-center gap-1 font-semibold text-yellow-600 transition-colors hover:text-yellow-700 hover:underline dark:text-yellow-400 dark:hover:text-yellow-300"
                                >
                                    Apply as partner instead
                                    <ArrowRight
                                        size={12}
                                        className={
                                            leavingForPartner
                                                ? "animate-pulse"
                                                : ""
                                        }
                                    />
                                </Link>
                            </div>

                            <div
                                className="
                                    mt-3
                                    flex
                                    items-center
                                    justify-between
                                    gap-4
                                    text-xs
                                "
                            >
                                <Link
                                    to="/forgot-password"
                                    className="
                                        text-gray-600
                                        transition-colors
                                        hover:text-gray-950
                                        hover:underline
                                        dark:text-gray-400
                                        dark:hover:text-white
                                    "
                                >
                                    Forgot Password?
                                </Link>

                                <Link
                                    to="/register"
                                    className="
                                        font-medium
                                        text-gray-600
                                        transition-colors
                                        hover:text-gray-950
                                        hover:underline
                                        dark:text-gray-400
                                        dark:hover:text-white
                                    "
                                >
                                    Create Account
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                    </div>
            </motion.div>
        </div>
    );
};

export default Login;