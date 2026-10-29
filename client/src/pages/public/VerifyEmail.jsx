import {
    useEffect,
    useState,
} from "react";

import {
    Link,
    useSearchParams,
} from "react-router-dom";

import {
    CheckCircle,
    Mail,
    ShieldCheck,
    XCircle,
} from "lucide-react";

import {
    motion,
} from "framer-motion";

import Button from "../../components/common/Button";
import {
    verifyUserEmail,
} from "../../services/authService";

const VerifyEmail = () => {
    const [
        searchParams,
    ] = useSearchParams();

    const token =
        searchParams.get("token");

    const [
        status,
        setStatus,
    ] = useState("loading");

    const [
        message,
        setMessage,
    ] = useState(
        "Verifying your email address..."
    );

    useEffect(() => {
        let cancelled = false;

        const verify = async () => {
            if (!token) {
                setStatus("error");
                setMessage(
                    "The email verification link is invalid or missing."
                );

                return;
            }

            try {
                const response =
                    await verifyUserEmail(
                        token
                    );

                if (cancelled) {
                    return;
                }

                setStatus("success");
                setMessage(
                    response?.message ||
                        "Your email address has been verified successfully."
                );
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setStatus("error");

                setMessage(
                    error?.response?.data
                        ?.message ||
                        "The verification link is invalid or has expired."
                );
            }
        };

        verify();

        return () => {
            cancelled = true;
        };
    }, [token]);

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
            "
        >
            <div
                className="
                    absolute
                    inset-0
                    bg-gradient-to-br
                    from-gray-950
                    via-gray-900
                    to-yellow-950/30
                "
            />

            <motion.div
                initial={{
                    opacity: 0,
                    y: 20,
                    scale: 0.97,
                }}
                animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                }}
                transition={{
                    duration: 0.45,
                    ease: "easeOut",
                }}
                className="
                    relative
                    z-10
                    w-full
                    max-w-md
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
                        p-8
                        text-center
                        shadow-2xl
                        shadow-black/30
                    "
                >
                    <div
                        className="
                            absolute
                            left-0
                            right-0
                            top-0
                            h-1
                            bg-yellow-400
                        "
                    />

                    <div
                        className="
                            mx-auto
                            mb-6
                            flex
                            h-16
                            w-16
                            items-center
                            justify-center
                            rounded-full
                        "
                    >
                        {status ===
                            "loading" && (
                            <Mail
                                size={42}
                                className="
                                    text-yellow-500
                                "
                            />
                        )}

                        {status ===
                            "success" && (
                            <CheckCircle
                                size={48}
                                className="
                                    text-green-500
                                "
                            />
                        )}

                        {status ===
                            "error" && (
                            <XCircle
                                size={48}
                                className="
                                    text-red-500
                                "
                            />
                        )}
                    </div>

                    <h1
                        className="
                            text-2xl
                            font-bold
                            tracking-tight
                            text-gray-950
                        "
                    >
                        {status ===
                            "loading" &&
                            "Verifying Your Email"}

                        {status ===
                            "success" &&
                            "Email Verified!"}

                        {status ===
                            "error" &&
                            "Verification Failed"}
                    </h1>

                    <p
                        className="
                            mx-auto
                            mt-3
                            max-w-sm
                            text-sm
                            leading-6
                            text-gray-500
                        "
                    >
                        {message}
                    </p>

                    {status ===
                        "loading" && (
                        <div
                            className="
                                mt-7
                                flex
                                justify-center
                            "
                        >
                            <div
                                className="
                                    h-8
                                    w-8
                                    animate-spin
                                    rounded-full
                                    border-4
                                    border-gray-200
                                    border-t-yellow-400
                                "
                            />
                        </div>
                    )}

                    {status ===
                        "success" && (
                        <div
                            className="
                                mt-7
                            "
                        >
                            <div
                                className="
                                    mb-5
                                    flex
                                    items-center
                                    justify-center
                                    gap-2
                                    text-xs
                                    text-gray-500
                                "
                            >
                                <ShieldCheck
                                    size={15}
                                    className="
                                        text-green-500
                                    "
                                />

                                <span>
                                    Your account is now
                                    ready for login.
                                </span>
                            </div>

                            <Link
                                to="/login"
                            >
                                <Button
                                    type="button"
                                    fullWidth
                                    className="
                                        !border-yellow-400
                                        !bg-yellow-400
                                        !text-gray-950
                                        hover:!bg-yellow-300
                                    "
                                >
                                    Continue to Login
                                </Button>
                            </Link>
                        </div>
                    )}

                    {status ===
                        "error" && (
                        <div
                            className="
                                mt-7
                                space-y-3
                            "
                        >
                            <Link
                                to="/register"
                            >
                                <Button
                                    type="button"
                                    fullWidth
                                    className="
                                        !border-yellow-400
                                        !bg-yellow-400
                                        !text-gray-950
                                        hover:!bg-yellow-300
                                    "
                                >
                                    Create New Account
                                </Button>
                            </Link>

                            <Link
                                to="/login"
                                className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-600
                                    transition-colors
                                    hover:text-gray-950
                                    hover:underline
                                "
                            >
                                Back to Login
                            </Link>
                        </div>
                    )}

                    <div
                        className="
                            mt-7
                            border-t
                            border-gray-100
                            pt-5
                            text-xs
                            text-gray-400
                        "
                    >
                        Rent-A-Ride Albay
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;