import { useEffect, useRef } from "react";

import { motion } from "framer-motion";

const LENGTH = 6;

/*
 * A 6-digit one-time code entry dressed as a Philippine license plate.
 * Type, paste a whole code, or use backspace/arrow keys to move between
 * slots. `onComplete` fires once all six digits are in. Bump `shakeKey`
 * to shake the plate (e.g. after a wrong code).
 */
const PlateCodeInput = ({
    value,
    onChange,
    onComplete,
    disabled = false,
    invalid = false,
    shakeKey = 0,
    autoFocus = true,
}) => {
    const inputsRef = useRef([]);
    const digits = Array.from({ length: LENGTH }, (_, index) => value[index] || "");

    useEffect(() => {
        if (autoFocus && !disabled) {
            inputsRef.current[0]?.focus();
        }
    }, [autoFocus, disabled]);

    // After a wrong code, start again from the first slot.
    useEffect(() => {
        if (shakeKey > 0) {
            inputsRef.current[0]?.focus();
        }
    }, [shakeKey]);

    const focusSlot = (index) => {
        const target = inputsRef.current[Math.max(0, Math.min(LENGTH - 1, index))];
        target?.focus();
        target?.select();
    };

    const commit = (nextDigits) => {
        const next = nextDigits.join("").slice(0, LENGTH);
        onChange(next);

        if (next.length === LENGTH && /^\d{6}$/.test(next)) {
            onComplete?.(next);
        }
    };

    const handleInput = (index, event) => {
        const typed = event.target.value.replace(/\D/g, "");

        if (!typed) {
            return;
        }

        // Several digits at once (autofill / typing fast) spill forward.
        const next = [...digits];
        typed
            .slice(0, LENGTH - index)
            .split("")
            .forEach((digit, offset) => {
                next[index + offset] = digit;
            });

        commit(next);
        focusSlot(index + typed.length);
    };

    const handleKeyDown = (index, event) => {
        if (event.key === "Backspace") {
            event.preventDefault();
            const next = [...digits];

            if (next[index]) {
                next[index] = "";
                commit(next);
            } else if (index > 0) {
                next[index - 1] = "";
                commit(next);
                focusSlot(index - 1);
            }
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            focusSlot(index - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            focusSlot(index + 1);
        }
    };

    const handlePaste = (event) => {
        const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);

        if (!pasted) {
            return;
        }

        event.preventDefault();
        commit(pasted.split(""));
        focusSlot(pasted.length);
    };

    return (
        <motion.div
            key={shakeKey}
            animate={shakeKey > 0 ? { x: [0, -10, 10, -7, 7, -3, 0] } : undefined}
            transition={{ duration: 0.45 }}
            className={`
                relative mx-auto w-full max-w-sm rounded-2xl border-[3px] bg-white px-3 pb-3 pt-2
                shadow-[inset_0_0_0_2px_#fff,inset_0_0_0_3px_rgba(17,24,39,0.12)] transition-colors
                dark:bg-gray-50
                ${invalid ? "border-red-500" : "border-gray-900 dark:border-gray-200"}
            `}
        >
            {/* Bolt holes */}
            <span className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-gray-300" />
            <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-gray-300" />

            <p className="text-center text-[10px] font-black uppercase tracking-[0.35em] text-blue-700">
                Pilipinas
            </p>

            <div
                className="mt-1 flex items-center justify-center gap-1 sm:gap-2"
                role="group"
                aria-label="6-digit code"
            >
                {digits.map((digit, index) => (
                    <div key={index} className="flex items-center">
                        {/* The space a real plate leaves between its groups. */}
                        {index === 3 && (
                            <span className="mx-0.5 h-1 w-2.5 rounded-full bg-gray-900/70 sm:mx-1.5" />
                        )}

                        <input
                            ref={(element) => {
                                inputsRef.current[index] = element;
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete={index === 0 ? "one-time-code" : "off"}
                            maxLength={LENGTH}
                            value={digit}
                            disabled={disabled}
                            aria-label={`Digit ${index + 1}`}
                            onChange={(event) => handleInput(index, event)}
                            onKeyDown={(event) => handleKeyDown(index, event)}
                            onPaste={handlePaste}
                            onFocus={(event) => event.target.select()}
                            className={`
                                h-12 w-7 rounded-lg border-b-[3px] bg-transparent text-center font-mono text-xl font-black
                                text-gray-900 caret-yellow-500 outline-none transition-colors sm:h-14 sm:w-11 sm:text-3xl
                                focus:bg-yellow-100/70 disabled:opacity-60
                                ${
                                    invalid
                                        ? "border-red-400"
                                        : digit
                                          ? "border-gray-900"
                                          : "border-gray-300 focus:border-yellow-500"
                                }
                            `}
                        />
                    </div>
                ))}
            </div>

            <p className="mt-1.5 text-center text-[9px] font-bold uppercase tracking-[0.4em] text-gray-500">
                Albay · Bicol
            </p>
        </motion.div>
    );
};

export default PlateCodeInput;
