import { useEffect, useMemo, useState } from "react";

import { getVehicles } from "../../api/vehicleApi";
import { BOOKABLE_VEHICLE_STATUS_FILTER } from "../../constants/vehicleConstants";
import getSimilarVehicles from "../../utils/getSimilarVehicles";

import FeaturedVehicleCard from "./FeaturedVehicleCard";

/*
 * "Similar vehicles" under a vehicle's details: same vehicle type, ranked
 * by getSimilarVehicles. Fetched here rather than through the vehicles
 * store so it doesn't replace the list other pages keep there. Renders
 * nothing until there is at least one match.
 */
const SimilarVehicles = ({ vehicle, limit = 3 }) => {
    const [candidates, setCandidates] = useState([]);

    const vehicleType = vehicle?.vehicleType;

    useEffect(() => {
        if (!vehicleType) {
            return;
        }

        let isMounted = true;

        getVehicles({
            publicListing: true,
            status: BOOKABLE_VEHICLE_STATUS_FILTER,
            vehicleType,
            includeRatings: true,
        })
            .then((result) => {
                if (isMounted) {
                    setCandidates(result?.data ?? []);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setCandidates([]);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [vehicleType]);

    const similarVehicles = useMemo(
        () => getSimilarVehicles(vehicle, candidates, limit),
        [vehicle, candidates, limit]
    );

    if (similarVehicles.length === 0) {
        return null;
    }

    /*
     * A div, not a <section>: site-texture paints the innermost unrounded
     * main/section, so a section here would take the page's texture.
     */
    return (
        <div className="mt-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                You might also like
            </p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-gray-950 dark:text-white sm:text-3xl">
                Similar {vehicleType === "Motorcycle" ? "Motorcycles" : "Cars"}
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {similarVehicles.map((similarVehicle) => (
                    <FeaturedVehicleCard
                        key={similarVehicle._id ?? similarVehicle.id}
                        vehicle={similarVehicle}
                        publicView
                    />
                ))}
            </div>
        </div>
    );
};

export default SimilarVehicles;
