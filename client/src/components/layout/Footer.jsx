import { Link } from "react-router-dom";
import {
    Mail,
    MapPin,
    Phone,
} from "lucide-react";

import PublicLogo from "./PublicLogo";

const Footer = () => {
    return (
        <footer className="bg-gray-950 text-white">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="grid gap-12 md:grid-cols-3">
                    <div>
                        <PublicLogo
                            variant="DARK"
                            showSubtitle={false}
                        />

                        <p className="mt-5 max-w-md text-sm leading-6 text-gray-400">
                            Your trusted vehicle rental platform in
                            Albay. Find a dependable ride for your
                            next trip with Rent-A-Ride Albay.
                        </p>

                        <div className="mt-6 flex items-center gap-3">
                            <a
                                href="#"
                                aria-label="Facebook"
                                className="
                                    flex
                                    h-10
                                    w-10
                                    items-center
                                    justify-center
                                    rounded-full
                                    border
                                    border-gray-700
                                    text-gray-400
                                    transition-colors
                                    duration-200
                                    hover:border-yellow-500
                                    hover:bg-yellow-500
                                    hover:text-gray-950
                                "
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="18"
                                    height="18"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path d="M14 8h3V4h-3c-3.31 0-5 1.69-5 5v3H6v4h3v8h4v-8h3l1-4h-4V9c0-.66.34-1 1-1Z" />
                                </svg>
                            </a>

                            <a
                                href="#"
                                aria-label="Instagram"
                                className="
                                    flex
                                    h-10
                                    w-10
                                    items-center
                                    justify-center
                                    rounded-full
                                    border
                                    border-gray-700
                                    text-gray-400
                                    transition-colors
                                    duration-200
                                    hover:border-yellow-500
                                    hover:bg-yellow-500
                                    hover:text-gray-950
                                "
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="18"
                                    height="18"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <rect
                                        x="3"
                                        y="3"
                                        width="18"
                                        height="18"
                                        rx="5"
                                    />

                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="4"
                                    />

                                    <circle
                                        cx="17.5"
                                        cy="6.5"
                                        r="0.75"
                                        fill="currentColor"
                                        stroke="none"
                                    />
                                </svg>
                            </a>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                            Quick Links
                        </h3>

                        <nav className="mt-5 flex flex-col gap-3">
                            <Link
                                to="/"
                                className="text-sm text-gray-400 transition-colors hover:text-yellow-400"
                            >
                                Home
                            </Link>

                            <Link
                                to="/vehicles"
                                className="text-sm text-gray-400 transition-colors hover:text-yellow-400"
                            >
                                Vehicles
                            </Link>

                            <Link
                                to="/about"
                                className="text-sm text-gray-400 transition-colors hover:text-yellow-400"
                            >
                                About
                            </Link>

                            <Link
                                to="/faq"
                                className="text-sm text-gray-400 transition-colors hover:text-yellow-400"
                            >
                                FAQ
                            </Link>

                            <Link
                                to="/contact"
                                className="text-sm text-gray-400 transition-colors hover:text-yellow-400"
                            >
                                Contact
                            </Link>
                        </nav>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                            Contact
                        </h3>

                        <div className="mt-5 flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <MapPin
                                    size={18}
                                    className="mt-0.5 shrink-0 text-yellow-500"
                                />

                                <span className="text-sm leading-5 text-gray-400">
                                    Albay, Philippines
                                </span>
                            </div>

                            <div className="flex items-start gap-3">
                                <Phone
                                    size={18}
                                    className="mt-0.5 shrink-0 text-yellow-500"
                                />

                                <span className="text-sm leading-5 text-gray-400">
                                    Contact us for rental
                                    inquiries
                                </span>
                            </div>

                            <div className="flex items-start gap-3">
                                <Mail
                                    size={18}
                                    className="mt-0.5 shrink-0 text-yellow-500"
                                />

                                <span className="text-sm leading-5 text-gray-400">
                                    Customer support
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-10 border-t border-gray-800 pt-6">
                    <div className="flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            © {new Date().getFullYear()} Rent-A-Ride
                            Albay. All rights reserved.
                        </p>

                        <p>
                            Your trusted vehicle rental platform in
                            Albay.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;