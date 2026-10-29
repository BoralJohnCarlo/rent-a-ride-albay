import {
    Car,
    CalendarCheck,
    PhilippinePeso,
    Users,
} from "lucide-react";

import StatCard from "./StatCard";

const defaultStats = [
    {
        key: "users",
        title: "Total Users",
        value: 0,
        subtitle: "Registered users",
        icon: <Users size={24} />,
        color: "blue",
    },
    {
        key: "vehicles",
        title: "Vehicles",
        value: 0,
        subtitle: "Fleet inventory",
        icon: <Car size={24} />,
        color: "green",
    },
    {
        key: "bookings",
        title: "Active Bookings",
        value: 0,
        subtitle: "Currently rented",
        icon: <CalendarCheck size={24} />,
        color: "yellow",
    },
    {
        key: "revenue",
        title: "Revenue",
        value: "₱0",
        subtitle: "This month",
        icon: <PhilippinePeso size={24} />,
        color: "purple",
    },
];

const QuickStats = ({
    stats = defaultStats,
    loading = false,
    onCardClick,
}) => {
    return (
        <section>
            <div
                className="
                    grid
                    grid-cols-1
                    gap-4
                    sm:grid-cols-2
                    xl:grid-cols-4
                "
            >
                {stats.map((stat) => (
                    <StatCard
                        key={stat.key}
                        title={stat.title}
                        value={stat.value}
                        subtitle={stat.subtitle}
                        icon={stat.icon}
                        color={stat.color}
                        trend={stat.trend}
                        loading={loading}
                        onClick={() =>
                            onCardClick?.(stat)
                        }
                    />
                ))}
            </div>
        </section>
    );
};

export default QuickStats;