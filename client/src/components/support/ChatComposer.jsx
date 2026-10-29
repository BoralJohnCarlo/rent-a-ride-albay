import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { errorText } from "./chatUtils";

const MAX_LENGTH = 2000;
const MAX_HEIGHT_PX = 160;

// Re-announce "typing" at most this often while keys keep coming, and
// announce "stopped" after this long without a keystroke.
const TYPING_REFRESH_MS = 2500;
const TYPING_IDLE_MS = 3000;

/*
 * Unsent text survives switching conversations (an admin hopping between
 * chats mid-reply). Module-level so it outlives the composer's remounts;
 * cleared on send and lost on a full reload, like a chat app's draft.
 */
const drafts = new Map();

const TONES = {
    brand: {
        ring: "focus-within:border-yellow-400 focus-within:ring-4 focus-within:ring-yellow-400/15",
        send: "bg-yellow-400 text-gray-950 hover:bg-yellow-300 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-600",
        chip: "hover:border-yellow-400 hover:bg-yellow-50 hover:text-gray-900 dark:hover:border-yellow-500/60 dark:hover:bg-yellow-500/10 dark:hover:text-yellow-200",
    },
    blue: {
        ring: "focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/15",
        send: "dashboard-primary-button bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-600",
        chip: "hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10 dark:hover:text-blue-300",
    },
};

/*
 * Message box for both chat screens: grows with its text, Enter sends,
 * Shift+Enter adds a line, and typing is reported (throttled) through
 * onTypingChange so the other side sees the indicator.
 */
const ChatComposer = ({
    draftKey,
    onSend,
    onTypingChange,
    placeholder = "Type a message…",
    quickReplies = [],
    tone = "brand",
    autoFocus = false,
}) => {
    const palette = TONES[tone] ?? TONES.brand;

    const [text, setText] = useState(() => drafts.get(draftKey) || "");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const textareaRef = useRef(null);
    const typingActive = useRef(false);
    const lastTypingSent = useRef(0);
    const idleTimer = useRef(null);

    const stopTyping = () => {
        clearTimeout(idleTimer.current);

        if (typingActive.current) {
            typingActive.current = false;
            onTypingChange?.(false);
        }
    };

    useEffect(() => {
        if (autoFocus) {
            textareaRef.current?.focus();
        }
    }, [autoFocus]);

    // Leaving the conversation (or the page) ends this side's typing.
    useEffect(() => stopTyping, []); // eslint-disable-line react-hooks/exhaustive-deps

    useLayoutEffect(() => {
        const node = textareaRef.current;

        if (!node) {
            return;
        }

        node.style.height = "auto";
        node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT_PX)}px`;
    }, [text]);

    // `at` is the triggering event's timeStamp (ms since page load) - keeps
    // the typing throttle free of clock reads during render.
    const updateText = (value, at) => {
        setText(value);
        setError("");

        if (draftKey) {
            if (value) {
                drafts.set(draftKey, value);
            } else {
                drafts.delete(draftKey);
            }
        }

        if (!value.trim()) {
            stopTyping();
            return;
        }

        if (!typingActive.current || at - lastTypingSent.current > TYPING_REFRESH_MS) {
            typingActive.current = true;
            lastTypingSent.current = at;
            onTypingChange?.(true);
        }

        clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    };

    const send = async () => {
        const message = text.trim();

        if (!message || sending) {
            return;
        }

        setSending(true);
        stopTyping();

        try {
            await onSend(message);
            setText("");
            drafts.delete(draftKey);
            textareaRef.current?.focus();
        } catch (sendError) {
            setError(errorText(sendError, "Your message wasn't sent. Try again."));
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
        }
    };

    const insertQuickReply = (reply, at) => {
        updateText(text.trim() ? `${text.trimEnd()}\n${reply}` : reply, at);
        textareaRef.current?.focus();
    };

    const nearLimit = text.length > MAX_LENGTH - 200;

    return (
        <div className="border-t border-gray-200/80 bg-white/80 px-3 pb-3 pt-2.5 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/60 sm:px-4">
            {quickReplies.length > 0 && (
                <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {quickReplies.map((reply) => (
                        <button
                            key={reply.label}
                            type="button"
                            onClick={(event) => insertQuickReply(reply.text, event.timeStamp)}
                            title={reply.text}
                            className={`shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 ${palette.chip}`}
                        >
                            {reply.label}
                        </button>
                    ))}
                </div>
            )}

            <div
                className={`flex items-end gap-2 rounded-2xl border border-gray-200 bg-white py-1.5 pl-4 pr-1.5 transition dark:border-gray-700 dark:bg-gray-900 ${palette.ring}`}
            >
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => updateText(event.target.value, event.timeStamp)}
                    onKeyDown={handleKeyDown}
                    onBlur={stopTyping}
                    rows={1}
                    maxLength={MAX_LENGTH}
                    placeholder={placeholder}
                    aria-label="Message"
                    className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
                />

                <button
                    type="button"
                    onClick={send}
                    disabled={!text.trim() || sending}
                    aria-label="Send message"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${palette.send}`}
                >
                    {sending ? (
                        <Loader2 size={17} className="animate-spin" />
                    ) : (
                        <SendHorizontal size={17} />
                    )}
                </button>
            </div>

            <div className="mt-1.5 flex min-h-4 items-center justify-between gap-3 px-1 text-[11px]">
                <span className="text-red-600 dark:text-red-400">{error}</span>

                <span className="hidden text-gray-400 dark:text-gray-500 sm:inline">
                    {nearLimit
                        ? `${text.length}/${MAX_LENGTH}`
                        : "Enter to send · Shift + Enter for a new line"}
                </span>
            </div>
        </div>
    );
};

export default ChatComposer;
