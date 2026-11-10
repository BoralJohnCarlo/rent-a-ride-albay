import Input from "./Input";
import { nationalPhoneDigits, toPhilippinePhone } from "../../utils/philippinePhone";

const PhilippinePhoneInput = ({ name, value = "", onChange, error, required = false, ...props }) => (
    <Input
        {...props}
        name={name}
        type="tel"
        inputMode="numeric"
        pattern="9[0-9]{9}"
        placeholder="9171234567"
        required={required}
        value={nationalPhoneDigits(value)}
        onChange={(event) => {
            const canonical = toPhilippinePhone(event.target.value);
            if (canonical === null) return;
            onChange({ target: { name, value: canonical } });
        }}
        leftIcon={<span aria-hidden="true" className="border-r border-gray-300 pr-2 text-sm font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300">+63</span>}
        style={{ paddingLeft: "3.5rem" }}
        aria-label={`${props.label || "Phone number"}, Philippines, country code +63`}
        error={error?.includes("+639XXXXXXXXX")
            ? required ? "Enter a 10-digit mobile number starting with 9." : "Enter a 10-digit mobile number starting with 9, or leave this blank."
            : error}
        helperText={required ? "Enter 10 digits starting with 9. You can also paste an 09 or +63 number." : "Optional. Enter another mobile number, or leave blank."}
    />
);

export default PhilippinePhoneInput;
