const DEFAULT_PADDING = 6;

const escapeRegExp = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatBusinessCode = (
    prefix,
    number,
    padding
) => {
    return `${prefix}-${String(number).padStart(
        padding,
        "0"
    )}`;
};

const generateBusinessCode = async ({
    model,
    field,
    prefix,
    padding = DEFAULT_PADDING,
}) => {
    if (!model) {
        throw new Error("Model is required.");
    }

    if (!field) {
        throw new Error("Field is required.");
    }

    if (
        typeof prefix !== "string" ||
        !prefix.trim()
    ) {
        throw new Error("Prefix is required.");
    }

    if (
        !Number.isInteger(padding) ||
        padding <= 0
    ) {
        throw new Error(
            "Padding must be a positive integer."
        );
    }

    const normalizedPrefix = prefix.trim();

    const pattern = new RegExp(
        `^${escapeRegExp(normalizedPrefix)}-\\d+$`
    );

    const latestDocument = await model
        .findOne({
            [field]: {
                $regex: pattern,
            },
        })
        .sort({
            createdAt: -1,
        })
        .select(field)
        .lean();

    let nextNumber = 1;

    if (latestDocument?.[field]) {
        const [, numericPart = "0"] =
            latestDocument[field].split("-");

        const parsedNumber = Number.parseInt(
            numericPart,
            10
        );

        if (
            Number.isInteger(parsedNumber) &&
            parsedNumber >= 1
        ) {
            nextNumber = parsedNumber + 1;
        }
    }

    while (true) {
        const businessCode = formatBusinessCode(
            normalizedPrefix,
            nextNumber,
            padding
        );

        const exists = await model.exists({
            [field]: businessCode,
        });

        if (!exists) {
            return businessCode;
        }

        nextNumber++;
    }
};

export default generateBusinessCode;