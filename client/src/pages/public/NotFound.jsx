import { Link } from "react-router-dom";

const NotFound = () => {
    return (
        <main
            className="
                flex
                min-h-screen
                items-center
                justify-center
                bg-gray-50
                px-6
                transition-colors
                duration-300
                dark:bg-gray-950
            "
        >
            <div
                className="
                    w-full
                    max-w-lg
                    text-center
                "
            >
                <p
                    className="
                        text-8xl
                        font-black
                        tracking-tight
                        text-yellow-500
                        sm:text-9xl
                    "
                >
                    404
                </p>

                <h1
                    className="
                        mb-3
                        text-2xl
                        font-bold
                        tracking-tight
                        text-gray-900
                        dark:text-white
                        sm:text-3xl
                    "
                >
                    Page Not Found
                </h1>

                <p
                    className="
                        mx-auto
                        mb-6
                        max-w-md
                        text-sm
                        leading-6
                        text-gray-600
                        dark:text-gray-400
                        sm:text-base
                    "
                >
                    The page you are looking for does not
                    exist or may have been moved.
                </p>

                <Link
                    to="/"
                    className="
                        inline-flex
                        items-center
                        justify-center
                        rounded-xl
                        bg-yellow-500
                        px-6
                        py-3
                        text-sm
                        font-bold
                        text-gray-950
                        transition-all
                        duration-200
                        hover:bg-yellow-400
                        hover:shadow-lg
                        focus:outline-none
                        focus:ring-2
                        focus:ring-yellow-500
                        focus:ring-offset-2
                        dark:focus:ring-offset-gray-950
                    "
                >
                    Return Home
                </Link>
            </div>
        </main>
    );
};

export default NotFound;