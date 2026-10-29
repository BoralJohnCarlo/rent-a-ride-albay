import { useEffect, useState } from "react";

import {
    motion,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import DestinationImage from "./DestinationImage";
import { getPublicDestinations } from "../../api/destinationApi";

/* Scroll distance over which the widget slides out to the right. */
const EXIT_SCROLL = 320;
const EXIT_OFFSET = 380;
/* It fades over the first part of the slide, so the fade is actually seen
   before the card has left the screen edge. */
const FADE_SCROLL = EXIT_SCROLL * 0.7;

/* The glass card is the faded element: opacity on a wrapper would make
   that wrapper the backdrop root and switch the card's blur off. */
const MotionLink = motion.create(Link);

/*
 * Glass card on the home hero (right side, large screens) that opens the
 * Explore Albay destinations page. Its thumbnails are the destinations the
 * admin marked "Show in home page widget" (Settings → Destinations). Hidden
 * until they load, and when there are no active destinations at all.
 */
const AlbayHeroWidget = ({ className = "" }) => {
    const [picks, setPicks] = useState([]);

    /* Scroll-linked exit: slides right while fading out as the page scrolls
       down, and slides back fading in on the way up. Springed so it glides
       rather than tracking every wheel tick. Off for reduced motion. */
    const reduceMotion = useReducedMotion();
    const { scrollY } = useScroll();
    const rawX = useTransform(scrollY, [0, EXIT_SCROLL], [0, EXIT_OFFSET]);
    const rawOpacity = useTransform(scrollY, [0, FADE_SCROLL], [1, 0]);
    const x = useSpring(rawX, { stiffness: 260, damping: 32, mass: 0.6 });
    const opacity = useSpring(rawOpacity, {
        stiffness: 260,
        damping: 32,
        mass: 0.6,
    });

    useEffect(() => {
        let cancelled = false;

        getPublicDestinations()
            .then((response) => {
                if (!cancelled) {
                    setPicks(response?.data?.heroWidget ?? []);
                }
            })
            .catch(() => {
                // Decorative — the hero works fine without it.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (picks.length === 0) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className={className}
        >
            <motion.div style={reduceMotion ? undefined : { x }}>
            {/* No transition on opacity: CSS would lag behind the scroll. */}
            <MotionLink
                to="/explore"
                aria-label="Explore destinations in Albay"
                style={reduceMotion ? undefined : { opacity }}
                className="group block w-72 rounded-3xl border border-white/15 bg-gray-950/30 p-3.5 shadow-2xl shadow-black/30 backdrop-blur-xl transition-[translate,border-color,background-color] duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-gray-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            >
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-gray-950 shadow-md shadow-yellow-500/20">
                        <MapPin size={18} strokeWidth={2.4} />
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="text-base font-extrabold leading-tight text-white">
                            Albay
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-white/75">
                            Stunning Views.
                            <br />
                            Endless Adventures.
                        </p>
                    </div>

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors duration-300 group-hover:border-yellow-400 group-hover:bg-yellow-400 group-hover:text-gray-950">
                        <ArrowRight
                            size={16}
                            className="transition-transform duration-300 group-hover:translate-x-0.5"
                        />
                    </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                    {picks.map((destination) => (
                        <div
                            key={destination._id}
                            className="overflow-hidden rounded-xl ring-1 ring-white/10"
                            title={destination.name}
                        >
                            <DestinationImage
                                destination={destination}
                                iconSize={18}
                                className="aspect-square transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    ))}
                </div>
            </MotionLink>
            </motion.div>
        </motion.div>
    );
};

export default AlbayHeroWidget;
