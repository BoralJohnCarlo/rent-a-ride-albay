import { Search, SlidersHorizontal, X } from "lucide-react";

import Select from "./Select";

/*
 * Wide rounded search bar for the centred page controls. Optional `filters`
 * ({ value, onChange, options, label }[]) render as compact dropdowns inside
 * the right end of the pill, the first one marked with a filter icon. On
 * phones they drop to their own row below so the search box keeps its room.
 */
const FilterSelect = ({ filter, withIcon, className }) => (
    <div className="relative flex items-center">
        {withIcon && (
            <SlidersHorizontal
                size={14}
                className="pointer-events-none absolute left-3.5 text-gray-400"
            />
        )}
        <Select
            bare
            value={filter.value}
            onChange={(event) =>
                filter.onChange(event.target.value)
            }
            options={filter.options}
            aria-label={filter.label}
            className={`cursor-pointer rounded-full pr-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-400/30 dark:text-gray-200 dark:hover:bg-gray-800 ${
                withIcon ? "pl-9" : "pl-3"
            } ${className}`}
        />
    </div>
);

const PillSearch = ({
    value,
    onChange,
    placeholder,
    label,
    filters = [],
    className = "",
}) => (
    <div className={`w-full max-w-3xl ${className}`}>
        <div className="flex h-11 w-full items-center rounded-full border border-gray-200/80 bg-white/80 shadow-sm backdrop-blur-xl transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 dark:border-gray-800 dark:bg-gray-900/80 dark:focus-within:border-blue-600 dark:focus-within:ring-blue-600/20">
            <Search
                size={17}
                className="pointer-events-none ml-5 shrink-0 text-gray-400"
            />
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={label}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="Clear search"
                    className="mr-1 shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                    <X size={15} />
                </button>
            )}
            {filters.length > 0 ? (
                <div className="mr-1 hidden h-9 shrink-0 items-center gap-0.5 border-l border-gray-200 pl-1 dark:border-gray-700 sm:flex">
                    {filters.map((filter, index) => (
                        <FilterSelect
                            key={filter.label}
                            filter={filter}
                            withIcon={index === 0}
                            className="h-9 bg-transparent"
                        />
                    ))}
                </div>
            ) : (
                <span className="w-3 shrink-0" />
            )}
        </div>

        {filters.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:hidden">
                {filters.map((filter, index) => (
                    <FilterSelect
                        key={filter.label}
                        filter={filter}
                        withIcon={index === 0}
                        className="h-9 border border-gray-200/80 bg-white/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80"
                    />
                ))}
            </div>
        )}
    </div>
);

export default PillSearch;
