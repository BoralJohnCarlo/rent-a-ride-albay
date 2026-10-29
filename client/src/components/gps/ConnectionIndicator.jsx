import { AnimatePresence, motion } from "framer-motion";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

import useSocket from "../../hooks/shared/useSocket";

const CONNECTION_STATE_CONFIG = {
    connected: {
        icon: Wifi,
        label: "Live",
        className: "text-green-600 dark:text-green-400",
    },
    reconnecting: {
        icon: Loader2,
        label: "Reconnecting...",
        className: "text-amber-600 dark:text-amber-400",
        spin: true,
    },
    error: {
        icon: WifiOff,
        label: "Disconnected",
        className: "text-red-600 dark:text-red-400",
    },
    connecting: {
        icon: Loader2,
        label: "Connecting...",
        className: "text-gray-500 dark:text-gray-400",
        spin: true,
    },
};

// Realtime (Socket.IO) connection state for the GPS pages.
const ConnectionIndicator = () => {
    const { connected, error, reconnecting } = useSocket();

    const state = connected
        ? "connected"
        : reconnecting
          ? "reconnecting"
          : error
            ? "error"
            : "connecting";

    const { icon: Icon, label, className, spin } =
        CONNECTION_STATE_CONFIG[state];

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={state}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${className}`}
            >
                <Icon size={16} className={spin ? "animate-spin" : ""} />
                {label}
            </motion.span>
        </AnimatePresence>
    );
};

export default ConnectionIndicator;
