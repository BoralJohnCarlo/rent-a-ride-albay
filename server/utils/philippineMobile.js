export const isPhilippineMobile = (value) =>
    typeof value === "string" && value.length === 13 && /^\+639[0-9]{9}$/.test(value);

export const PH_MOBILE_MESSAGE = "Enter a Philippine mobile number in +639XXXXXXXXX format (e.g. +639369875311).";
export const ALTERNATIVE_CONTACT_MESSAGE = "Alternative contact must use +639XXXXXXXXX format (e.g. +639369875311), or be left blank.";
