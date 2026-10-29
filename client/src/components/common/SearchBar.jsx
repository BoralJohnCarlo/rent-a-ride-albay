import { Search, X } from "lucide-react";

const SearchBar = ({
    value = "",
    onChange,
    onSearch,
    placeholder = "Search...",
    disabled = false,
    loading = false,
    className = "",
}) => {
    const handleClear = () => {
        if (disabled) {
            return;
        }

        onChange?.({
            target: {
                value: "",
            },
        });
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter") {
            onSearch?.(value);
        }
    };

    return (
        <div
            className={[
                "relative w-full",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Search
                size={18}
                className="
                    pointer-events-none
                    absolute
                    left-5
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                    dark:text-gray-500
                "
            />

            <input
                type="text"
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="
                    h-12
                    w-full
                    rounded-full
                    border
                    border-gray-200
                    bg-white
                    pl-12
                    pr-12
                    text-sm
                    text-gray-900
                    placeholder:text-gray-400
                    shadow-sm
                    outline-none
                    transition-all
                    duration-200
                    hover:border-gray-300
                    focus:border-blue-500
                    focus:outline-none
                    focus:ring-4
                    focus:ring-blue-100
                    disabled:cursor-not-allowed
                    disabled:bg-gray-100
                    disabled:text-gray-500
                    dark:border-gray-700
                    dark:bg-gray-900
                    dark:text-gray-100
                    dark:placeholder:text-gray-500
                    dark:shadow-none
                    dark:hover:border-gray-600
                    dark:focus:border-blue-400
                    dark:focus:ring-blue-900/40
                    dark:disabled:bg-gray-800
                    dark:disabled:text-gray-500
                "
            />

            {loading ? (
                <div
                    className="
                        absolute
                        right-3
                        top-1/2
                        -translate-y-1/2
                    "
                >
                    <div
                        className="
                            h-4
                            w-4
                            animate-spin
                            rounded-full
                            border-2
                            border-gray-300
                            border-t-blue-600
                            dark:border-gray-600
                            dark:border-t-blue-400
                        "
                    />
                </div>
            ) : (
                value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        aria-label="Clear search"
                        className="
                            absolute
                            right-2.5
                            top-1/2
                            flex
                            h-7
                            w-7
                            -translate-y-1/2
                            items-center
                            justify-center
                            rounded-full
                            text-gray-400
                            transition-all
                            duration-200
                            hover:bg-gray-100
                            hover:text-gray-700
                            dark:text-gray-500
                            dark:hover:bg-gray-800
                            dark:hover:text-gray-200
                        "
                    >
                        <X size={16} />
                    </button>
                )
            )}
        </div>
    );
};

export default SearchBar;