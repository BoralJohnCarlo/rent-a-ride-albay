import { Provider } from "react-redux";

import store from "../store";

import AuthProvider from "./AuthProvider";
import ToastProvider from "./ToastProvider";
import ThemeProvider from "./ThemeProvider";

const AppProvider = ({ children }) => {
    return (
        <Provider store={store}>
            <ThemeProvider>
                <AuthProvider>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </AuthProvider>
            </ThemeProvider>
        </Provider>
    );
};

export default AppProvider;