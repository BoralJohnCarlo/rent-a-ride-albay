import { useEffect, useState } from "react";

const readIsDark = () =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark";

/*
 * Whether the *resolved* theme is dark right now. ThemeProvider writes the
 * resolved value (system preference already applied) to <html data-theme>,
 * so this watches that attribute. For places Tailwind's `dark:` can't reach,
 * e.g. colours passed as props to chart libraries.
 */
const useIsDarkTheme = () => {
    const [isDark, setIsDark] = useState(readIsDark);

    useEffect(() => {
        const observer = new MutationObserver(() =>
            setIsDark(readIsDark())
        );

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => observer.disconnect();
    }, []);

    return isDark;
};

export default useIsDarkTheme;
