import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Check, CheckCheck, Info } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { buildTimeline, formatClock } from "./chatUtils";

// Within this distance of the bottom counts as "reading the latest" - new
// messages then scroll into view instead of raising the "New messages" pill.
const NEAR_BOTTOM_PX = 120;

const TONES = {
    brand: {
        mine: "bg-yellow-400 text-gray-950 shadow-sm shadow-yellow-500/20",
        mineMeta: "text-gray-800/70",
        theirs: "border border-gray-200 bg-white text-gray-900 dark:border-gray-700/70 dark:bg-gray-800 dark:text-gray-100",
        dot: "bg-gray-400 dark:bg-gray-500",
        jump: "bg-yellow-400 text-gray-950 shadow-yellow-500/30",
    },
    blue: {
        mine: "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/25",
        mineMeta: "text-blue-100/80",
        theirs: "border border-gray-200 bg-white text-gray-900 dark:border-gray-700/70 dark:bg-gray-800 dark:text-gray-100",
        dot: "bg-gray-400 dark:bg-gray-500",
        jump: "bg-blue-600 text-white shadow-blue-600/30",
    },
};

export const TypingDots = ({ className = "bg-gray-400" }) => (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
            <motion.span
                key={dot}
                className={`h-1.5 w-1.5 rounded-full ${className}`}
                animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
                transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: dot * 0.15,
                    ease: "easeInOut",
                }}
            />
        ))}
    </span>
);

/*
 * The scrolling message thread shared by the customer chat and the admin
 * inbox. The caller decides which messages are "mine" (right-aligned), what
 * label/avatar the other side's groups get, and passes the other side's
 * last-read time for the Seen receipt.
 */
const ChatMessages = ({
    messages = [],
    isMine,
    otherReadAt,
    senderLabel,
    avatarFor,
    typingLabel,
    tone = "brand",
    empty,
}) => {
    const palette = TONES[tone] ?? TONES.brand;
    const scrollRef = useRef(null);
    const nearBottom = useRef(true);
    const [unseenBelow, setUnseenBelow] = useState(false);

    const timeline = useMemo(() => buildTimeline(messages), [messages]);

    // The receipt sits under my most recent message only.
    const lastMineId = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index].senderRole !== "system" && isMine(messages[index])) {
                return messages[index]._id;
            }
        }

        return null;
    }, [messages, isMine]);

    const lastMine = messages.find((entry) => entry._id === lastMineId);
    const seen =
        lastMine &&
        otherReadAt &&
        new Date(otherReadAt) >= new Date(lastMine.createdAt);

    const scrollToBottom = (behavior = "smooth") => {
        const node = scrollRef.current;

        if (node) {
            node.scrollTo({ top: node.scrollHeight, behavior });
        }

        setUnseenBelow(false);
    };

    // Jump straight to the latest message when a conversation opens.
    useLayoutEffect(() => {
        scrollToBottom("auto");
        nearBottom.current = true;
    }, [messages[0]?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const latest = messages[messages.length - 1];

        if (!latest) {
            return;
        }

        if (nearBottom.current || (latest.senderRole !== "system" && isMine(latest))) {
            scrollToBottom();
        } else {
            setUnseenBelow(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length]);

    useEffect(() => {
        if (typingLabel && nearBottom.current) {
            scrollToBottom();
        }
    }, [typingLabel]);

    const handleScroll = () => {
        const node = scrollRef.current;

        if (!node) {
            return;
        }

        nearBottom.current =
            node.scrollHeight - node.scrollTop - node.clientHeight <
            NEAR_BOTTOM_PX;

        if (nearBottom.current) {
            setUnseenBelow(false);
        }
    };

    return (
        <div className="relative min-h-0 flex-1">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto px-4 py-5 sm:px-6"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
            >
                {messages.length === 0 && empty}

                {/*
                    min-h-full + justify-end packs a short conversation
                    against the bottom (next to the composer) instead of
                    leaving it stranded at the top with a dead gap below.
                    Once messages overflow the scroll area this has no
                    effect — they stack top-down and scroll as usual.
                */}
                <div className="flex min-h-full flex-col justify-end">
                    {timeline.map((item) => {
                        if (item.type === "day") {
                            return (
                                <div
                                    key={item.key}
                                    className="my-4 flex items-center gap-3"
                                >
                                    <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        {item.label}
                                    </span>
                                    <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                </div>
                            );
                        }

                        if (item.type === "system") {
                            return (
                                <div
                                    key={item.key}
                                    className="my-3 flex justify-center"
                                >
                                    <span className="inline-flex max-w-[90%] items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                                        <Info size={12} className="shrink-0" />
                                        <span>{item.entry.message}</span>
                                        <span className="text-gray-400 dark:text-gray-600">
                                            · {formatClock(item.entry.createdAt)}
                                        </span>
                                    </span>
                                </div>
                            );
                        }

                        const { entry, firstInGroup, lastInGroup } = item;
                        const mine = isMine(entry);
                        const label = firstInGroup ? senderLabel?.(entry) : null;
                        const avatar = !mine ? avatarFor?.(entry) : null;

                        // Bubbles in a group "stack": a small corner where
                        // they touch the bubble above, and on the tail side.
                        const corner = mine
                            ? `rounded-br-md ${firstInGroup ? "" : "rounded-tr-md"}`
                            : `rounded-bl-md ${firstInGroup ? "" : "rounded-tl-md"}`;

                        return (
                            <motion.div
                                key={item.key}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                                className={`flex items-end gap-2 ${
                                    mine ? "justify-end" : "justify-start"
                                } ${firstInGroup ? "mt-3" : "mt-0.5"}`}
                            >
                                {avatar !== null && avatar !== undefined && (
                                    <div className="w-8 shrink-0">
                                        {lastInGroup ? avatar : null}
                                    </div>
                                )}

                                <div
                                    className={`flex max-w-[78%] flex-col ${
                                        mine ? "items-end" : "items-start"
                                    }`}
                                >
                                    {label && (
                                        <span className="mb-1 px-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                            {label}
                                        </span>
                                    )}

                                    <div
                                        className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${corner} ${
                                            mine ? palette.mine : palette.theirs
                                        }`}
                                        title={new Date(entry.createdAt).toLocaleString("en-PH")}
                                    >
                                        <p className="whitespace-pre-wrap wrap-break-word">
                                            {entry.message}
                                        </p>
                                    </div>

                                    {lastInGroup && (
                                        <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-gray-400 dark:text-gray-500">
                                            {formatClock(entry.createdAt)}
                                            {entry._id === lastMineId &&
                                                (seen ? (
                                                    <span className="inline-flex items-center gap-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                                                        <CheckCheck size={13} />
                                                        Seen
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-0.5">
                                                        <Check size={13} />
                                                        Sent
                                                    </span>
                                                ))}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}

                    <AnimatePresence>
                        {typingLabel && (
                            <motion.div
                                key="typing"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                className="mt-3 flex items-center gap-2"
                            >
                                <span className={`inline-flex items-center rounded-2xl rounded-bl-md px-3.5 py-3 ${palette.theirs}`}>
                                    <TypingDots className={palette.dot} />
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {typingLabel}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {unseenBelow && (
                    <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        onClick={() => scrollToBottom()}
                        className={`absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg ${palette.jump}`}
                    >
                        <ArrowDown size={14} />
                        New messages
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChatMessages;
