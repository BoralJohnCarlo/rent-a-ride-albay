import { useEffect } from "react";

import { motion } from "framer-motion";

import FeaturedVehicleCard from "../../components/vehicle/FeaturedVehicleCard";

import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

import useFavorite from "../../hooks/useFavorite";

const Favorites = () => {
    const {
        favorites,
        loading,
        fetchUserFavorites,
    } = useFavorite();

    useEffect(() => {
        void fetchUserFavorites();
    }, [fetchUserFavorites]);

    if (loading) {
        return (
            <PageContainer>
                <div className="flex min-h-[400px] items-center justify-center">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <Section>
                <div className="mb-7">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                        Account
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                        My Favorites
                    </h1>

                    <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                        Vehicles you have saved for later.
                    </p>
                </div>

                {favorites.length === 0 ? (
                    <EmptyState
                        title="No favorites yet"
                        description="Browse our fleet and tap the heart icon on any vehicle to save it here."
                    />
                ) : (
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 20,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.45,
                        }}
                        className="
                            mt-8
                            grid
                            grid-cols-1
                            gap-6
                            sm:grid-cols-2
                            lg:grid-cols-3
                        "
                    >
                        {favorites.map(
                            (vehicle) => (
                                <FeaturedVehicleCard
                                    key={
                                        vehicle._id ??
                                        vehicle.id
                                    }
                                    vehicle={
                                        vehicle
                                    }
                                    publicView={
                                        true
                                    }
                                />
                            )
                        )}
                    </motion.div>
                )}
            </Section>
        </PageContainer>
    );
};

export default Favorites;
