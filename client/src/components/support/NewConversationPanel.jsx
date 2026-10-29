import { motion } from "framer-motion";
import { ArrowLeft, Loader2, SendHorizontal } from "lucide-react";
import { useState } from "react";

import { SUPPORT_CATEGORIES } from "./supportCategoryMeta";
import { errorText } from "./chatUtils";

/*
 * Customer side: starting a conversation. Picking a topic first keeps it
 * one tap; subject + first message then open the chat straight away.
 */
const NewConversationPanel = ({
    firstName,
    initialCategory = "",
    onSubmit,
    onBack,
    showBack = false,
}) => {
    const [category, setCategory] = useState(initialCategory);
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const ready = category && subject.trim() && message.trim();

    const submit = async (event) => {
        event.preventDefault();

        if (!ready) {
            setError("Pick a topic, add a subject and write your message.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await onSubmit({
                category,
                subject: subject.trim(),
                message: message.trim(),
            });
        } catch (submitError) {
            setError(errorText(submitError, "We couldn't start the chat. Please try again."));
            setSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={submit}
            className="flex h-full min-h-0 flex-col"
        >
            <div className="flex items-center gap-3 border-b border-gray-200/80 px-4 py-3.5 dark:border-gray-800 sm:px-6">
                {showBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back to conversations"
                        className="-ml-1 rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    >
                        <ArrowLeft size={18} />
                    </button>
                )}

                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        New conversation
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Our team replies here — you'll get a notification too.
                    </p>
                </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
                <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Hi{firstName ? ` ${firstName}` : ""}, what can we help with?
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {SUPPORT_CATEGORIES.map((option) => {
                            const Icon = option.icon;
                            const active = category === option.value;

                            return (
                                <motion.button
                                    key={option.value}
                                    type="button"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => {
                                        setCategory(option.value);
                                        setError("");
                                    }}
                                    aria-pressed={active}
                                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                                        active
                                            ? "border-yellow-400 bg-yellow-50 ring-2 ring-yellow-400/30 dark:border-yellow-500/70 dark:bg-yellow-500/10"
                                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800/60"
                                    }`}
                                >
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${option.tint}`}>
                                        <Icon size={17} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {option.value}
                                        </span>
                                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                            {option.hint}
                                        </span>
                                    </span>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Subject
                        </span>
                        <input
                            type="text"
                            value={subject}
                            maxLength={200}
                            onChange={(event) => {
                                setSubject(event.target.value);
                                setError("");
                            }}
                            placeholder="e.g. Changing my pickup time"
                            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Message
                        </span>
                        <textarea
                            value={message}
                            maxLength={2000}
                            rows={4}
                            onChange={(event) => {
                                setMessage(event.target.value);
                                setError("");
                            }}
                            placeholder="Tell us what's going on…"
                            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/15 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                    </label>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-200/80 px-4 py-3 dark:border-gray-800 sm:px-6">
                <p className="min-w-0 text-xs font-medium text-red-600 dark:text-red-400">
                    {error}
                </p>

                <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-yellow-400 px-5 text-sm font-semibold text-gray-950 shadow-sm shadow-yellow-500/25 transition hover:bg-yellow-300 disabled:opacity-60"
                >
                    {submitting ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <SendHorizontal size={16} />
                    )}
                    Start chat
                </button>
            </div>
        </form>
    );
};

export default NewConversationPanel;
