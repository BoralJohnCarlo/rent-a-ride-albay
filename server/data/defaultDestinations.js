/*
 * Starting content for Explore Albay (Settings → Destinations), inserted once
 * the first time the destinations are read (see destinationService
 * ensureDefaultDestinations). After that the admin owns the list — deleting
 * every destination does not bring these back.
 *
 * Drive times are approximate, from Legazpi City proper. No photos: admins
 * upload their own (or licensed) images.
 */
const DEFAULT_DESTINATIONS = [
    {
        name: "Mayon Volcano",
        town: "Daraga · Camalig · Tabaco",
        category: "nature",
        blurb: "The famously near-perfect cone that anchors every view in Albay. Join a lava-trail ATV ride around its foothills or catch it from the Mayon Skyline viewpoint.",
        driveTime: "30–60 min",
        road: "Paved, rough near trailheads",
        bestTime: "Early morning, clear skies",
        rideType: "Car",
        rideNote: "An SUV or crossover handles the rough roads to the ATV hubs best.",
        image: "",
        featuredInHero: true,
        isActive: true,
        displayOrder: 0
    },
    {
        name: "Cagsawa Ruins",
        town: "Daraga",
        category: "heritage",
        blurb: "The bell tower of a church buried by Mayon's 1814 eruption, now a park with the volcano rising right behind it.",
        driveTime: "20 min",
        road: "Paved",
        bestTime: "Morning, before the clouds roll in",
        rideType: "Motorcycle",
        rideNote: "A short hop — a motorcycle is the easiest to park here.",
        image: "",
        featuredInHero: false,
        isActive: true,
        displayOrder: 1
    },
    {
        name: "Daraga Church",
        town: "Daraga",
        category: "heritage",
        blurb: "Our Lady of the Gate Parish, an 18th-century baroque church of carved volcanic stone on a hilltop facing Mayon.",
        driveTime: "15 min",
        road: "Paved, short uphill",
        bestTime: "Late afternoon light",
        rideType: "Motorcycle",
        rideNote: "Pairs well with Cagsawa Ruins on the same trip.",
        image: "",
        featuredInHero: true,
        isActive: true,
        displayOrder: 2
    },
    {
        name: "Lignon Hill Nature Park",
        town: "Legazpi City",
        category: "viewpoints",
        blurb: "A hilltop park with a 360° view of Legazpi, Albay Gulf and Mayon — plus a zipline and a Japanese-era tunnel.",
        driveTime: "10 min",
        road: "Paved, steep",
        bestTime: "Sunset",
        rideType: "Motorcycle",
        rideNote: "The steep, winding climb is quick and easy on two wheels.",
        image: "",
        featuredInHero: false,
        isActive: true,
        displayOrder: 3
    },
    {
        name: "Embarcadero de Legazpi",
        town: "Legazpi City",
        category: "viewpoints",
        blurb: "A seaside boulevard and shopping strip on Legazpi's waterfront — an easy evening stroll with Mayon on the horizon.",
        driveTime: "10 min",
        road: "Paved, city streets",
        bestTime: "Evening",
        rideType: "Car",
        rideNote: "A comfortable city car for a night out in Legazpi.",
        image: "",
        featuredInHero: false,
        isActive: true,
        displayOrder: 4
    },
    {
        name: "Sumlang Lake",
        town: "Camalig",
        category: "nature",
        blurb: "A calm lake where bamboo rafts drift out for one of the clearest reflections of Mayon you'll find.",
        driveTime: "30–40 min",
        road: "Paved",
        bestTime: "Early morning",
        rideType: "Car",
        rideNote: "Easy paved roads — any car will do.",
        image: "",
        featuredInHero: false,
        isActive: true,
        displayOrder: 5
    },
    {
        name: "Quitinday Green Hills",
        town: "Camalig",
        category: "viewpoints",
        blurb: "Rolling, grass-covered hills often compared to Bohol's Chocolate Hills, with a viewing deck over the countryside.",
        driveTime: "45–60 min",
        road: "Narrow rural roads",
        bestTime: "Morning",
        rideType: "Motorcycle",
        rideNote: "The narrow barangay roads are easiest on a motorcycle.",
        image: "",
        featuredInHero: false,
        isActive: true,
        displayOrder: 6
    },
    {
        name: "Hoyop-Hoyopan Cave",
        town: "Camalig",
        category: "nature",
        blurb: "A limestone cave with guided tours through its chambers, named for the whistling sound of wind through its openings.",
        driveTime: "45 min",
        road: "Paved, rural stretch",
        bestTime: "Any time — cool inside",
        rideType: "Car",
        rideNote: "Combine it with Sumlang Lake for a Camalig day trip.",
        image: "",
        featuredInHero: false,
        isActive: true,
        displayOrder: 7
    },
    {
        name: "Cagraray Island",
        town: "Bacacay",
        category: "beaches",
        blurb: "White-sand coves and resorts reached by bridge from the mainland — a full beach day away from the city.",
        driveTime: "1 hr 15 min",
        road: "Paved, some winding coastal roads",
        bestTime: "Dry season, March to May",
        rideType: "Car",
        rideNote: "Going as a group? Pick a 7-seater so everyone rides together.",
        image: "",
        featuredInHero: true,
        isActive: true,
        displayOrder: 8
    }
];

export default DEFAULT_DESTINATIONS;
