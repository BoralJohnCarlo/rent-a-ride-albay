import {
    useEffect,
    useRef,
} from "react";

import { useLocation } from "react-router-dom";

const DashboardShell = ({
    navbar,
    topbar,
    breadcrumb,
    // Docked under the content (the phone page switcher).
    bottomBar,
    children,
}) => {
    const location = useLocation();

    const mainRef = useRef(null);

    useEffect(() => {
        requestAnimationFrame(() => {
            mainRef.current?.scrollTo({
                top: 0,
                left: 0,
                behavior: "auto",
            });
        });
    }, [location.pathname]);

    return (
        <div
            className="
                flex
                h-dvh
                min-h-0
                min-w-0
                flex-1
                flex-col
                bg-gray-50
                dark:bg-gray-950
            "
        >
            {navbar && <div>{navbar}</div>}

            {breadcrumb && <div>{breadcrumb}</div>}

            {/* dashboard-texture: the public/customer page texture
                (site-texture.css) — grain + faint grid in light mode, dot
                grid + glows in dark. It sits on this non-scrolling wrapper
                so it stays put behind scrolling content. */}
            <div
                className="
                    dashboard-texture
                    relative
                    flex
                    min-h-0
                    flex-1
                    overflow-hidden
                "
            >
                {topbar && (
                    <div
                        className="
                            pointer-events-none
                            fixed
                            top-5
                            right-6
                            z-40
                            flex
                            justify-end
                            px-6
                        "
                    >
                        <div className="pointer-events-auto">
                            {topbar}
                        </div>
                    </div>
                )}

                <main
                    ref={mainRef}
                    className="
                        min-h-0
                        min-w-0
                        flex-1
                        overflow-x-auto
                        overflow-y-auto
                        p-4
                        sm:p-6
                    "
                >
                    {children}
                </main>
            </div>

            {bottomBar}
        </div>
    );
};

export default DashboardShell;
