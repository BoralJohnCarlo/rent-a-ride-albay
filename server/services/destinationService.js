import Destination from "../models/Destination.js";
import Settings from "../models/Settings.js";

import DEFAULT_DESTINATIONS from "../data/defaultDestinations.js";
import { HERO_WIDGET_DESTINATION_LIMIT } from "../constants/destinationConstants.js";

const httpError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const EDITABLE_FIELDS = [
    "name",
    "town",
    "category",
    "blurb",
    "driveTime",
    "road",
    "bestTime",
    "rideType",
    "rideNote",
    "image",
    "featuredInHero",
    "isActive",
    "displayOrder",
];

const pickEditable = (data = {}) =>
    Object.fromEntries(
        EDITABLE_FIELDS.filter((field) => data[field] !== undefined).map(
            (field) => [field, data[field]]
        )
    );

const SORT = { displayOrder: 1, createdAt: 1 };

const PUBLIC_FIELDS =
    "name town category blurb driveTime road bestTime rideType rideNote image featuredInHero";

/*
 * Insert the starter destinations the first time the list is read. The
 * Settings flag is claimed with a conditional update, so two simultaneous
 * first requests can't both seed.
 */
let seeding = null;

const ensureDefaultDestinations = async () => {
    if (!seeding) {
        seeding = (async () => {
            // Creates the Settings document only if there isn't one yet.
            const settings = await Settings.findOneAndUpdate(
                {},
                {
                    $setOnInsert: {
                        "seededContent.destinations": false,
                    },
                },
                { returnDocument: "after", upsert: true }
            )
                .select("_id seededContent")
                .lean();

            if (settings?.seededContent?.destinations) {
                return;
            }

            const claimed = await Settings.updateOne(
                {
                    _id: settings._id,
                    "seededContent.destinations": { $ne: true },
                },
                { $set: { "seededContent.destinations": true } }
            );

            if (claimed.modifiedCount === 1) {
                await Destination.insertMany(DEFAULT_DESTINATIONS);
            }
        })().catch((error) => {
            // Let a later request retry instead of caching the failure.
            seeding = null;
            throw error;
        });
    }

    return seeding;
};

/*
 * At most HERO_WIDGET_DESTINATION_LIMIT destinations can be featured in the
 * hero widget. Checked when a destination is being switched on.
 */
const assertFeaturedSlotFree = async (excludeId = null) => {
    const featuredCount = await Destination.countDocuments({
        featuredInHero: true,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });

    if (featuredCount >= HERO_WIDGET_DESTINATION_LIMIT) {
        throw httpError(
            `Only ${HERO_WIDGET_DESTINATION_LIMIT} destinations can be shown in the home page widget. Remove one first.`,
            409
        );
    }
};

/*
 * Public list for /explore, plus the hero widget's picks: the featured ones
 * first, topped up from the rest so the widget always has up to three.
 */
export const getPublicDestinations = async () => {
    await ensureDefaultDestinations();

    const destinations = await Destination.find({ isActive: true })
        .select(PUBLIC_FIELDS)
        .sort(SORT)
        .lean();

    const featured = destinations.filter((d) => d.featuredInHero);
    const heroWidget = [
        ...featured,
        ...destinations.filter((d) => !d.featuredInHero),
    ].slice(0, HERO_WIDGET_DESTINATION_LIMIT);

    return { destinations, heroWidget };
};

export const getAllDestinations = async () => {
    await ensureDefaultDestinations();

    return Destination.find().sort(SORT).lean();
};

export const createDestination = async (data) => {
    if (data.featuredInHero === true) {
        await assertFeaturedSlotFree();
    }

    const last = await Destination.findOne()
        .sort({ displayOrder: -1 })
        .select("displayOrder")
        .lean();

    return Destination.create({
        displayOrder: (last?.displayOrder ?? -1) + 1,
        ...pickEditable(data),
    });
};

export const updateDestination = async (id, data) => {
    if (data.featuredInHero === true) {
        await assertFeaturedSlotFree(id);
    }

    const destination = await Destination.findByIdAndUpdate(
        id,
        { $set: pickEditable(data) },
        { returnDocument: "after", runValidators: true }
    );

    if (!destination) {
        throw httpError("Destination not found.", 404);
    }

    return destination;
};

/* Persist a new order: `ids` in display order. */
export const reorderDestinations = async (ids) => {
    await Destination.bulkWrite(
        ids.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { $set: { displayOrder: index } },
            },
        }))
    );

    return Destination.find().sort(SORT).lean();
};

export const deleteDestination = async (id) => {
    const destination = await Destination.findByIdAndDelete(id);

    if (!destination) {
        throw httpError("Destination not found.", 404);
    }

    return destination;
};
