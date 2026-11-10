import { useEffect, useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import { getPublicDestinations } from "../../api/destinationApi";
import DestinationImage from "./DestinationImage";

// Mounted only while the mobile menu is open; use the same admin picks as the hero.
const AlbayMenuCard = ({ onNavigate }) => {
    const [picks, setPicks] = useState([]);

    useEffect(() => {
        let cancelled = false;
        getPublicDestinations()
            .then((response) => {
                const destinations = response?.data?.heroWidget;
                if (!cancelled && Array.isArray(destinations)) setPicks(destinations.slice(0, 3));
            })
            .catch(() => {
                // Keep the Explore link usable when thumbnails are unavailable.
            });
        return () => { cancelled = true; };
    }, []);

    return (
        <Link
            to="/explore"
            onClick={onNavigate}
            aria-label="Explore destinations in Albay"
            className="group block min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-yellow-400/60"
        >
            <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-gray-950">
                    <MapPin size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-extrabold text-gray-950 dark:text-white">Explore Albay</span>
                <ArrowRight size={18} className="shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5 dark:text-gray-400" aria-hidden="true" />
            </div>
            {picks.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {picks.map((destination) => (
                        <DestinationImage key={destination._id} destination={destination} iconSize={18} className="h-16 rounded-xl sm:h-20" />
                    ))}
                </div>
            )}
        </Link>
    );
};

export default AlbayMenuCard;
