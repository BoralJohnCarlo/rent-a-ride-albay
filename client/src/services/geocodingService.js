const NOMINATIM_BASE_URL =
    "https://nominatim.openstreetmap.org";

const DEFAULT_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Rent-A-Ride-Albay/1.0 (admin@rentaride.example.com)",
};

const parseAddress = (address) => {
    if (!address || typeof address !== "object") {
        return {
            address: "",
            region: "",
            province: "",
            city: "",
            barangay: "",
            raw: {},
        };
    }

    const region = address.region || address.state || "";
    // Do NOT fall back to `state` here: for the Philippines Nominatim
    // returns the region in `state`, so using it as the province produces
    // a value that never matches the province list.
    const province =
        address.province ||
        address.county ||
        address.state_district ||
        "";
    const city =
        address.city ||
        address.town ||
        address.municipality ||
        "";
    const barangay =
        address.barrio ||
        address.village ||
        address.suburb ||
        address.neighbourhood ||
        address.city_district ||
        address.hamlet ||
        address.quarter ||
        "";

    const addressParts = [
        address.road,
        address.house_number,
        barangay,
        city,
        province,
        region,
    ].filter(Boolean);

    const formattedAddress =
        addressParts.join(", ") ||
        address.display_name ||
        "";

    return {
        address: formattedAddress,
        region,
        province,
        city,
        barangay,
        // Keep the raw provider payload so callers can do richer matching
        // (e.g. state / county / village / hamlet fields that get collapsed
        // into the fields above).
        raw: address,
    };
};

export const reverseGeocode = async (latitude, longitude) => {
    const maxRetries = 2;
    const retryDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const url = new URL(
                `${NOMINATIM_BASE_URL}/reverse`
            );

            url.searchParams.set("lat", String(latitude));
            url.searchParams.set("lon", String(longitude));
            url.searchParams.set("format", "json");
            url.searchParams.set("addressdetails", "1");
            url.searchParams.set("accept_language", "en");

            const response = await fetch(url.toString(), {
                method: "GET",
                mode: "cors",
                headers: DEFAULT_HEADERS,
            });

            if (!response.ok) {
                if (
                    response.status === 429 ||
                    response.status === 503
                ) {
                    if (attempt < maxRetries) {
                        await new Promise(
                            (resolve) =>
                                setTimeout(
                                    resolve,
                                    retryDelayMs
                                )
                        );

                        continue;
                    }

                    throw new Error(
                        "Geocoding service is busy. Please try again in a moment."
                    );
                }

                throw new Error(
                    `Geocoding request failed: ${response.status}`
                );
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(
                    data.error ||
                        "Unable to determine location."
                );
            }

            return parseAddress(data.address || {});
        } catch (error) {
            console.log('[GEOCODE ERROR]', error.message, 'attempt:', attempt);
            if (attempt < maxRetries && error.message.includes("busy")) {
                await new Promise(
                    (resolve) =>
                        setTimeout(resolve, retryDelayMs)
                );

                continue;
            }

            throw error;
        }
    }

    throw new Error(
        "Unable to fetch address details after multiple attempts. Please fill the address fields manually."
    );
};
