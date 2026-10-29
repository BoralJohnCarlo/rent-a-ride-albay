import {
    CalendarDays,
    Car,
    PhilippinePeso,
} from "lucide-react";

import {
    useEffect,
} from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import { useNavigate } from "react-router-dom";

import Button from "../../components/common/Button";
import PageHeader from "../../components/common/PageHeader";

import QuickStats from "../../components/dashboard/QuickStats";
import RevenueWidget from "../../components/dashboard/RevenueWidget";
import RecentPayments from "../../components/dashboard/RecentPayments";
import RecentBookings from "../../components/dashboard/RecentBookings";

import ConsignmentFleetSummary from "../../components/consignments/ConsignmentFleetSummary";
import ConsignmentQuickActions from "../../components/consignments/ConsignmentQuickActions";

import { getDashboardData } from "../../store/dashboard";

const Dashboard = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const {
        stats = [],
        revenue = {
            total: 0,
            growth: 0,
            period: "This Month",
        },
        fleetSummary = {
            available: 0,
            reserved: 0,
            rented: 0,
            maintenance: 0,
        },
        recentBookings = [],
        recentPayments = [],
        loading = false,
        error = null,
    } = useSelector((state) => state.dashboard);

    useEffect(() => {
        dispatch(getDashboardData());
    }, [dispatch]);

    const dashboardStats = stats.map((stat) => {
        let icon;

        switch (stat.key) {
            case "vehicles":
                icon = <Car size={24} />;
                break;

            case "bookings":
                icon = (
                    <CalendarDays size={24} />
                );
                break;

            case "revenue":
                icon = (
                    <PhilippinePeso size={24} />
                );
                break;

            default:
                icon = null;
        }

        return {
            ...stat,
            icon,
        };
    });

    const handleQuickAction = (
        action
    ) => {
        switch (action) {
            case "new-consignment":
                navigate(
                    "/operator/consignments"
                );
                break;

            case "view-consignments":
                navigate(
                    "/operator/consignments"
                );
                break;

            default:
                break;
        }
    };

    const handleRetry = () => {
        dispatch(getDashboardData());
    };

    const handleStatClick = (stat) => {
        switch (stat.key) {
            case "vehicles":
                navigate(
                    "/operator/consignments"
                );
                break;

            case "bookings":
                navigate(
                    "/operator/consignments"
                );
                break;

            case "revenue":
                navigate(
                    "/operator/statistics"
                );
                break;

            default:
                break;
        }
    };

    const handleViewAllBookings = () => {
        navigate("/operator/consignments");
    };

    const handleViewAllPayments = () => {
        navigate("/operator/statistics");
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Dashboard"
                description="Monitor your fleet, bookings, revenue, and recent activity."
            />

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                    <span>
                        {typeof error === "string"
                            ? error
                            : "Unable to load dashboard data."}
                    </span>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                    >
                        Retry
                    </Button>
                </div>
            )}

            <QuickStats
                stats={dashboardStats}
                loading={loading}
                onCardClick={handleStatClick}
            />

            <div className="grid gap-6 xl:grid-cols-2">
                <RevenueWidget
                    revenue={revenue.total}
                    growth={revenue.growth}
                    period={revenue.period}
                    loading={loading}
                />

                <ConsignmentFleetSummary
                    summary={fleetSummary}
                    loading={loading}
                />
            </div>

            <RecentBookings
                bookings={recentBookings}
                loading={loading}
                onViewAll={handleViewAllBookings}
            />

            <RecentPayments
                transactions={recentPayments}
                loading={loading}
                onViewAll={handleViewAllPayments}
            />

            <ConsignmentQuickActions
                onActionClick={
                    handleQuickAction
                }
            />
        </div>
    );
};

export default Dashboard;
