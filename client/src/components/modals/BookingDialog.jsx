import { useEffect } from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    X,
} from "lucide-react";

import BookingForm from "../forms/BookingForm";
import BookingReminders from "../booking/BookingReminders";

const SPRING = {
    type: "spring",
    stiffness: 260,
    damping: 24,
};

const BookingDialog = ({
    open = false,
    vehicle = null,
    drivers = [],
    loading = false,
    errors = {},
    errorMessage = "",
    forceWithDriver = false,
    onSubmit,
    onClose,
}) => {
    // The dialog body has its own scroll area; lock the page behind it
    // so only one scrollbar shows.
    useEffect(() => {
        if (!open) {
            return;
        }

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    const handleBackdropClick = (
        event
    ) => {
        if (
            event.target ===
            event.currentTarget
        ) {
            onClose?.();
        }
    };

    const vehicleName = [
        vehicle?.brand,
        vehicle?.model,
        vehicle?.variant,
    ]
        .filter(Boolean)
        .join(" ");

    const resolvedErrorMessage =
        errorMessage ||
        (typeof errors === "string"
            ? errors
            : "") ||
        (Array.isArray(errors?.errors)
            ? errors.errors.join(
                  " "
              )
            : "") ||
        (typeof errors?.message ===
            "string"
            ? errors.message
            : "");

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{
                        opacity: 0,
                    }}
                    animate={{
                        opacity: 1,
                    }}
                    exit={{
                        opacity: 0,
                    }}
                    transition={{
                        duration: 0.2,
                    }}
                    className="
                        fixed
                        inset-0
                        z-50
                        flex
                        items-center
                        justify-center
                        bg-black/50
                        backdrop-blur-sm
                    "
                    onMouseDown={
                        handleBackdropClick
                    }
                >
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 24,
                            scale: 0.97,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            y: 16,
                            scale: 0.98,
                        }}
                        transition={SPRING}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="booking-dialog-title"
                        className="
                            flex
                            h-full
                            w-full
                            flex-col
                            overflow-hidden
                            bg-white
                            dark:bg-gray-900
                        "
                    >
                        <div
                            className="
                                flex
                                shrink-0
                                items-center
                                justify-between
                                border-b
                                border-gray-200
                                px-6
                                py-5
                                dark:border-gray-700
                            "
                        >
                            <div className="min-w-0">
                                <h2
                                    id="booking-dialog-title"
                                    className="
                                        truncate
                                        text-xl
                                        font-bold
                                        tracking-tight
                                        text-gray-900
                                        dark:text-white
                                    "
                                >
                                    Book Your Vehicle
                                </h2>

                                {vehicle && (
                                    <p
                                        className="
                                            mt-1
                                            truncate
                                            text-sm
                                            text-gray-500
                                            dark:text-gray-400
                                        "
                                    >
                                        {vehicleName}
                                    </p>
                                )}
                            </div>

                            <motion.button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                whileHover={
                                    loading
                                        ? undefined
                                        : {
                                              rotate: 90,
                                          }
                                }
                                whileTap={
                                    loading
                                        ? undefined
                                        : {
                                              scale: 0.92,
                                          }
                                }
                                transition={SPRING}
                                className="
                                    ml-4
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    text-gray-500
                                    transition-colors
                                    hover:bg-gray-100
                                    hover:text-gray-900
                                    disabled:cursor-not-allowed
                                    disabled:opacity-50
                                    dark:text-gray-400
                                    dark:hover:bg-gray-800
                                    dark:hover:text-white
                                "
                                aria-label="Close booking dialog"
                            >
                                <X size={20} />
                            </motion.button>
                        </div>

                        <div
                            className="
                                form-texture
                                min-h-0
                                flex-1
                                overflow-y-auto
                                px-6
                                py-6
                            "
                        >
                            {/* Fullscreen is the surrounding chrome
                                (backdrop/header now fill the viewport) —
                                the form keeps a comfortable reading width,
                                with the reminders card pinned on its left
                                (below it on small screens). */}
                            <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[27rem_minmax(0,42rem)] xl:justify-center">
                                <BookingReminders vehicle={vehicle} className="order-last lg:order-first lg:sticky lg:top-0 lg:max-h-[calc(100vh-9.5rem)] lg:self-start" />

                                <div className="min-w-0">
                                <BookingForm
                                    vehicle={vehicle}
                                    drivers={drivers}
                                    loading={loading}
                                    errors={errors}
                                    errorMessage={
                                        resolvedErrorMessage
                                    }
                                    forceWithDriver={
                                        forceWithDriver
                                    }
                                    onSubmit={onSubmit}
                                    onCancel={onClose}
                                />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BookingDialog;