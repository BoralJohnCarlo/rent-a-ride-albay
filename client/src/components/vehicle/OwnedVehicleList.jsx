import DataList from "../lists/DataList";
import VehicleCard from "./VehicleCard";

const OwnedVehicleList = ({
    vehicles = [],
    loading = false,
    onSelect,
}) => {
    return (
        <DataList
            data={vehicles}
            loading={loading}
            emptyTitle="No vehicles found."
            emptyDescription="This owner currently has no registered vehicles."
            renderItem={(vehicle) => (
                <VehicleCard
                    vehicle={vehicle}
                    onSelect={onSelect}
                />
            )}
        />
    );
};

export default OwnedVehicleList;