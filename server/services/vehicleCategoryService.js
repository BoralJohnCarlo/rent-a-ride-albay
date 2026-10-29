
import Vehicle from "../models/Vehicle.js";
import VehicleCategory from "../models/VehicleCategory.js";

const generateSlug = (name) => {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
};

const ensureCategoryNameAvailable = async (
    name,
    excludeCategoryId = null
) => {
    const query = {
        name,
    };

    if (excludeCategoryId) {
        query._id = {
            $ne: excludeCategoryId,
        };
    }

    const existingCategory =
        await VehicleCategory.findOne(query);

    if (existingCategory) {
        throw new Error(
            "Vehicle category name already exists."
        );
    }
};

const ensureCategorySlugAvailable = async (
    slug,
    excludeCategoryId = null
) => {
    const query = {
        slug,
    };

    if (excludeCategoryId) {
        query._id = {
            $ne: excludeCategoryId,
        };
    }

    const existingCategory =
        await VehicleCategory.findOne(query);

    if (existingCategory) {
        throw new Error(
            "Vehicle category slug already exists."
        );
    }
};

const findVehicleCategoryById = async (
    categoryId
) => {
    const category =
        await VehicleCategory.findById(categoryId);

    if (!category) {
        throw new Error(
            "Vehicle category not found."
        );
    }

    return category;
};

const saveVehicleCategory = async (
    category
) => {
    await category.save();

    return await VehicleCategory.findById(
        category._id
    );
};

const buildVehicleCategoryFilters = (
    filters = {}
) => {
    const query = {};

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.vehicleType) {
        query.vehicleType = filters.vehicleType;
    }

    return query;
};

const createVehicleCategory = async (
    categoryData
) => {
    const slug = generateSlug(categoryData.name);

    await ensureCategoryNameAvailable(
        categoryData.name
    );

    await ensureCategorySlugAvailable(slug);

    const category =
        await VehicleCategory.create({
            ...categoryData,
            slug,
        });

    return await VehicleCategory.findById(
        category._id
    );
};

const getVehicleCategories = async (
    filters = {},
    sort = {
        displayOrder: 1,
        name: 1,
    }
) => {
    const query =
        buildVehicleCategoryFilters(filters);

    const categories =
        await VehicleCategory.find(query).sort(sort);

    const vehicles =
        await Vehicle.find({
            category: {
                $in: categories.map(
                    (category) => category._id
                ),
            },
        })
            .select(
                [
                    "vehicleCode",
                    "brand",
                    "model",
                    "plateNumber",
                    "status",
                    "condition",
                    "category",
                ].join(" ")
            )
            .lean();

    const vehiclesByCategory =
        new Map();

    for (const vehicle of vehicles) {
        const categoryId = String(
            vehicle.category
        );

        if (
            !vehiclesByCategory.has(
                categoryId
            )
        ) {
            vehiclesByCategory.set(
                categoryId,
                []
            );
        }

        vehiclesByCategory
            .get(categoryId)
            .push(vehicle);
    }

    return categories.map((category) => {
        const categoryVehicles =
            vehiclesByCategory.get(
                String(category._id)
            ) ?? [];

        return {
            ...category.toObject(),
            vehicleCount:
                categoryVehicles.length,
            vehicles:
                categoryVehicles,
        };
    });
};

const getVehicleCategoryById = async (
    categoryId
) => {
    return await findVehicleCategoryById(
        categoryId
    );
};

const updateVehicleCategory = async (
    categoryId,
    updateData
) => {
    const category =
        await findVehicleCategoryById(categoryId);

    if (
        updateData.name &&
        updateData.name !== category.name
    ) {
        const slug = generateSlug(
            updateData.name
        );

        await ensureCategoryNameAvailable(
            updateData.name,
            category._id
        );

        await ensureCategorySlugAvailable(
            slug,
            category._id
        );

        category.slug = slug;
    }

    if (updateData.presentation) {
        category.presentation = {
            ...category.presentation.toObject(),
            ...updateData.presentation,
        };
    }

    if (updateData.audit) {
        category.audit = {
            ...category.audit.toObject(),
            ...updateData.audit,
        };
    }

    const nestedFields = [
        "presentation",
        "audit",
    ];

    for (const [key, value] of Object.entries(
        updateData
    )) {
        if (!nestedFields.includes(key)) {
            category[key] = value;
        }
    }

    return await saveVehicleCategory(category);
};

const deleteVehicleCategory = async (
    categoryId
) => {
    const category =
        await findVehicleCategoryById(categoryId);

    const assignedVehicles =
        await Vehicle.countDocuments({
            category: categoryId,
        });

    if (assignedVehicles > 0) {
        throw new Error(
            "Cannot delete a vehicle category that is assigned to one or more vehicles."
        );
    }

    await category.deleteOne();
};

const updateVehicleCategoryStatus = async (
    categoryId,
    status
) => {
    const category =
        await findVehicleCategoryById(categoryId);

    category.status = status;

    return await saveVehicleCategory(category);
};

export {
    createVehicleCategory,
    getVehicleCategories,
    getVehicleCategoryById,
    updateVehicleCategory,
    deleteVehicleCategory,
    updateVehicleCategoryStatus,
};

