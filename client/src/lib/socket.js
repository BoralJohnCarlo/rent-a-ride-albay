import { io } from "socket.io-client";
import { createSocketSession } from "../utils/socketSession.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
let sharedSocket = null;
export const getSocket = () => {
    if (!sharedSocket) sharedSocket = io(SOCKET_URL, { withCredentials: true, autoConnect: false });
    return sharedSocket;
};
const session = createSocketSession(getSocket);
export const setSocketAuthenticated = session.setAuthenticated;
export const refreshSocketCredentials = session.refreshCredentials;
