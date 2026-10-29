const mapConsignmentToPayload = (form) => ({
    ownershipType: form.ownershipType,

    snapshots: {
        applicant: {
            identity: {},
            organization: {},
            contact: {},
            address: {},
            emergencyContacts: [],
            verification: {},
        },

        vehicle: {
            brand: form.vehicle.brand,
            model: form.vehicle.model,
            variant: form.vehicle.variant,
            year: Number(form.vehicle.year),
            vehicleType: form.vehicle.vehicleType,
            category: form.vehicle.category,
            plateNumber: form.vehicle.plateNumber,
            registrationNumber:
                form.vehicle.registrationNumber,

            specifications: {
                transmission:
                    form.vehicle.transmission,
                fuelType:
                    form.vehicle.fuelType,
                seatingCapacity: Number(
                    form.vehicle
                        .seatingCapacity
                ),
                color: form.vehicle.color,
            },

            pricing: {
                dailyRate: Number(
                    form.pricing.dailyRate
                ),
                reservationFee: Number(
                    form.pricing
                        .reservationFee
                ),
            },

            description: {
                description:
                    form.description
                        .description,
                features:
                    form.description.features,
            },

            images: form.images,
        },
    },
});

export default mapConsignmentToPayload;