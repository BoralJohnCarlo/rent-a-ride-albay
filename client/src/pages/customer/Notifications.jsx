import LightTexture from "../../components/sections/LightTexture";
import NotificationPage from "../shared/NotificationsPage";

/*
 * The grid/grain (light) and dot (dark) texture comes from the layout's
 * `.site-texture` rule on this <main>; LightTexture only adds the light-mode
 * rings and striped corner, same as My Bookings.
 */
const CustomerNotifications = () => (
    <main className="relative isolate min-h-screen bg-gray-50 px-4 pb-16 pt-24 dark:bg-gray-950 sm:px-6 sm:pt-28 lg:px-8">
        <LightTexture
            accent="yellow"
            decorOnly
            className="inset-x-0 top-0 -z-10 h-[48rem]"
        />

        <NotificationPage role="customer" />
    </main>
);

export default CustomerNotifications;
