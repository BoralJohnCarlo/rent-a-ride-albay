import logo from "../../assets/logos/logo.png";

/* Logo + name in the header of the dashboards' phone account drawer. */
const DashboardDrawerBrand = () => (
    <>
        <img
            src={logo}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-contain"
        />

        <span className="truncate text-base font-extrabold tracking-tight text-gray-950 dark:text-white">
            Rent-A-Ride Albay
        </span>
    </>
);

export default DashboardDrawerBrand;
