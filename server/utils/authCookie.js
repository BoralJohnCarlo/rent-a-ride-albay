const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const authCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
});

export const setAuthCookie = (res, token) =>
    res.cookie("token", token, {
        ...authCookieOptions(),
        maxAge: AUTH_COOKIE_MAX_AGE,
    });

export const clearAuthCookie = (res) =>
    res.clearCookie("token", authCookieOptions());
