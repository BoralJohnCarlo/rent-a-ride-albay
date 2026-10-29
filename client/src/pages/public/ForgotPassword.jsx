import { useState } from "react";

import { motion } from "framer-motion";

import {
    ArrowLeft,
    KeyRound,
    Mail,
    Send,
} from "lucide-react";

import { Link } from "react-router-dom";

import Button from "../../components/common/Button";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] =
        useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();

        if (!email.trim()) {
            return;
        }

        setSubmitted(true);
    };

    return (
        <Section
            spacing="XL"
            className="
                flex
                min-h-[calc(100vh-5rem)]
                items-center
                bg-gray-50
                dark:bg-gray-950
            "
        >
            <PageContainer>
                <motion.div
                    initial={{
                        opacity: 0,
                        y: 24,
                    }}
                    animate={{
                        opacity: 1,
                        y: 0,
                    }}
                    transition={{
                        duration: 0.5,
                    }}
                    className="
                        mx-auto
                        w-full
                        max-w-md
                    "
                >
                    <div
                        className="
                            rounded-3xl
                            border
                            border-gray-200
                            bg-white
                            p-7
                            shadow-sm
                            dark:border-gray-800
                            dark:bg-gray-900
                            dark:shadow-black/20
                            sm:p-9
                        "
                    >
                        <div className="text-center">
                            <motion.div
                                initial={{
                                    scale: 0.85,
                                    opacity: 0,
                                }}
                                animate={{
                                    scale: 1,
                                    opacity: 1,
                                }}
                                transition={{
                                    duration: 0.45,
                                    delay: 0.1,
                                }}
                                className="
                                    mx-auto
                                    flex
                                    h-14
                                    w-14
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    bg-yellow-100
                                    text-yellow-600
                                    shadow-sm
                                    dark:bg-yellow-500/15
                                    dark:text-yellow-400
                                "
                            >
                                <KeyRound
                                    size={27}
                                    strokeWidth={1.8}
                                />
                            </motion.div>

                            <h1
                                className="
                                    mt-6
                                    text-2xl
                                    font-black
                                    tracking-tight
                                    text-gray-900
                                    dark:text-white
                                    sm:text-3xl
                                "
                            >
                                Forgot Your Password?
                            </h1>

                            <p
                                className="
                                    mt-3
                                    text-sm
                                    leading-6
                                    text-gray-500
                                    dark:text-gray-400
                                "
                            >
                                Enter the email address
                                associated with your account
                                and we'll help you reset your
                                password.
                            </p>
                        </div>

                        {submitted ? (
                            <motion.div
                                initial={{
                                    opacity: 0,
                                    y: 8,
                                }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                }}
                                transition={{
                                    duration: 0.3,
                                }}
                                className="
                                    mt-7
                                    rounded-2xl
                                    border
                                    border-green-200
                                    bg-green-50
                                    p-5
                                    text-center
                                    dark:border-green-500/20
                                    dark:bg-green-500/10
                                "
                            >
                                <p
                                    className="
                                        text-sm
                                        font-semibold
                                        text-green-800
                                        dark:text-green-300
                                    "
                                >
                                    Password reset request
                                    received.
                                </p>

                                <p
                                    className="
                                        mt-2
                                        text-sm
                                        leading-6
                                        text-green-700
                                        dark:text-green-400
                                    "
                                >
                                    If an account exists for
                                    this email address, reset
                                    instructions will be
                                    provided when the password
                                    recovery service is
                                    available.
                                </p>
                            </motion.div>
                        ) : (
                            <form
                                onSubmit={
                                    handleSubmit
                                }
                                className="mt-7"
                            >
                                <label
                                    htmlFor="email"
                                    className="
                                        block
                                        text-sm
                                        font-semibold
                                        text-gray-700
                                        dark:text-gray-200
                                    "
                                >
                                    Email Address
                                </label>

                                <div
                                    className="
                                        relative
                                        mt-2
                                    "
                                >
                                    <Mail
                                        size={18}
                                        className="
                                            pointer-events-none
                                            absolute
                                            left-4
                                            top-1/2
                                            -translate-y-1/2
                                            text-gray-400
                                            dark:text-gray-500
                                        "
                                    />

                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        onChange={(
                                            event
                                        ) =>
                                            setEmail(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        required
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-gray-300
                                            bg-white
                                            py-3
                                            pl-11
                                            pr-4
                                            text-sm
                                            text-gray-900
                                            placeholder:text-gray-400
                                            outline-none
                                            transition
                                            focus:border-yellow-500
                                            focus:ring-2
                                            focus:ring-yellow-100
                                            dark:border-gray-700
                                            dark:bg-gray-950
                                            dark:text-white
                                            dark:placeholder:text-gray-600
                                            dark:focus:border-yellow-400
                                            dark:focus:ring-yellow-500/15
                                        "
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="
                                        mt-5
                                        w-full
                                    "
                                    rightIcon={
                                        <Send
                                            size={17}
                                        />
                                    }
                                >
                                    Continue
                                </Button>
                            </form>
                        )}

                        <div
                            className="
                                mt-7
                                flex
                                justify-center
                            "
                        >
                            <Link
                                to="/login"
                                className="
                                    inline-flex
                                    items-center
                                    gap-2
                                    text-sm
                                    font-semibold
                                    text-gray-500
                                    transition-colors
                                    hover:text-gray-900
                                    dark:text-gray-400
                                    dark:hover:text-white
                                "
                            >
                                <ArrowLeft
                                    size={16}
                                />

                                Back to Login
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </PageContainer>
        </Section>
    );
};

export default ForgotPassword;