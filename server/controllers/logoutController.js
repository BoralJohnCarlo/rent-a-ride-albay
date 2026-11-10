import PushSubscription from "../models/PushSubscription.js";
import { sessionHash } from "../services/webPushService.js";
import { clearAuthCookie } from "../utils/authCookie.js";
import { successResponse } from "../utils/response.js";

export const logout = async (req, res) => {
    clearAuthCookie(res);
    let timer;
    try {
        if (req.cookies?.token) {
            await Promise.race([
                PushSubscription.deleteMany({ sessionHash: sessionHash(req.cookies.token) }).maxTimeMS(1500),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error("Cleanup timeout")), 2000);
                    timer.unref?.();
                }),
            ]);
        }
    } catch {
        // The client also unsubscribes this browser. Cleanup cannot block logout.
        console.warn("Signed out; browser notification cleanup will expire automatically");
    } finally { clearTimeout(timer); }
    return successResponse(res, "Logout successful.");
};
