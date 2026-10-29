import Select from "../common/Select";
import Button from "../common/Button";

const vehicleTypeOptions = [
    {
        label: "All Types",
        value: "",
    },
    {
        label: "Car",
        value: "Car",
    },
    {
        label: "Motorcycle",
        value: "Motorcycle",
    },
];

const statusOptions = [
    {
        label: "All Status",
        value: "",
    },
    {
        label: "Active",
        value: "Active",
    },
    {
        label: "Inactive",
        value: "Inactive",
    },
];

const VehicleCategoryFilters = ({
    filters,
    onChange,
    onReset,
}) => {

    const handleChange = (event) => {
        const {
            name,
            value,
        } = event.target;

        onChange?.({
            ...filters,
            [name]: value,
        });
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                <Select
                    label="Vehicle Type"
                    name="vehicleType"
                    value={filters.vehicleType}
                    options={vehicleTypeOptions}
                    onChange={handleChange}
                />

                <Select
                    label="Status"
                    name="status"
                    value={filters.status}
                    options={statusOptions}
                    onChange={handleChange}
                />

            </div>

            <div className="mt-6 flex justify-end">

                <Button
                    variant="outline"
                    onClick={onReset}
                >
                    Reset Filters
                </Button>

            </div>

        </div>
    );
};

export default VehicleCategoryFilters;