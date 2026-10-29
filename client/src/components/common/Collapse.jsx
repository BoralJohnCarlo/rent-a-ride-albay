import {
    AnimatePresence,
    motion,
    useReducedMotion,
} from "framer-motion";

/*
 * Buttery, slightly jelly expand / collapse for accordion content (FAQ
 * answers etc.).
 *
 * Opening uses a spring with a little bounce, so the panel overshoots its
 * natural height a touch and settles back — the "jelly" feel. The content
 * inside drops in from slightly above and un-squishes as it lands. Closing
 * has no bounce (an undershoot below 0 height would flash) and folds shut on
 * an even ease-in-out, content lifting away as it goes. Keep padding on the children (not on this
 * wrapper) so the height animation has nothing to jump over.
 */
const EXPAND = {
    height: { type: "spring", visualDuration: 0.5, bounce: 0.28 },
    opacity: { duration: 0.25, delay: 0.05, ease: "easeOut" },
};

/*
 * Closing is a tween, not a spring: a no-bounce spring front-loads almost all
 * of its motion into the first few frames, which reads as a snap. An
 * ease-in-out over ~0.5s folds the panel away evenly, and the content stays
 * visible for most of that instead of vanishing first.
 */
const COLLAPSE = {
    height: { duration: 0.5, ease: [0.65, 0, 0.35, 1] },
    opacity: { duration: 0.3, delay: 0.15, ease: "easeIn" },
};

const CONTENT_IN = {
    type: "spring",
    visualDuration: 0.55,
    bounce: 0.4,
};

const CONTENT_OUT = { duration: 0.45, ease: [0.65, 0, 0.35, 1] };

const INSTANT = { duration: 0 };

const Collapse = ({ open, children, className = "" }) => {
    const reduceMotion = useReducedMotion();

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    key="collapse"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                        height: "auto",
                        opacity: 1,
                        transition: reduceMotion ? INSTANT : EXPAND,
                    }}
                    exit={{
                        height: 0,
                        opacity: 0,
                        transition: reduceMotion ? INSTANT : COLLAPSE,
                    }}
                    style={{ overflow: "hidden", willChange: "height" }}
                    className={className}
                >
                    <motion.div
                        initial={{ y: -10, scaleY: 0.96 }}
                        animate={{
                            y: 0,
                            scaleY: 1,
                            transition: reduceMotion ? INSTANT : CONTENT_IN,
                        }}
                        exit={{
                            y: -12,
                            scaleY: 0.95,
                            transition: reduceMotion ? INSTANT : CONTENT_OUT,
                        }}
                        style={{ transformOrigin: "top" }}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Collapse;
