// Keep the API's international format while editing only the national number.
export const toPhilippinePhone = (raw = "") => {
    let digits = raw.replace(/[\s()-]/g, "");
    if (!/^\+?\d*$/.test(digits)) return null;
    if (digits.startsWith("+63")) digits = digits.slice(3);
    else if (digits.startsWith("63")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = digits.slice(1);
    if (!/^\d{0,10}$/.test(digits)) return null;
    return digits ? `+63${digits}` : "";
};

export const nationalPhoneDigits = (value = "") =>
    value.startsWith("+63") ? value.slice(3) : value;
