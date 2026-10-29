import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import useToast from "../hooks/toast/useToast";
import useAuth from "../hooks/auth/useAuth";
import AuthContext from "../context/AuthContext";
import { SESSION_ENDED_EVENT } from "../lib/axios";
import { sessionEnded } from "../store/auth";
import { setSoundPreferences } from "../utils/notificationSound";

const AuthProvider = ({ children }) => {
  const auth = useAuth();
  const toast = useToast();
  const dispatch = useDispatch();
  const welcomeAttemptedRef = useRef(false);

  const {
    initialized,
    refreshUser,
    user,
    isAuthenticated,
  } = auth;

  useEffect(() => {
    if (!initialized) {
      refreshUser();
    }
  }, [initialized, refreshUser]);

  // App-wide sounds follow the signed-in account's preferences.
  useEffect(() => {
    setSoundPreferences(user?.notificationPreferences);
  }, [user?.notificationPreferences]);

  useEffect(() => {
    const handleSessionEnded = () => {
      dispatch(sessionEnded());
      toast.warning(
        "Your password was changed, so this device was signed out. Please log in again.",
        "Signed out",
        6000
      );
    };

    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded);

    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded);
  }, [dispatch, toast]);

  useEffect(() => {
    if (isAuthenticated && user && !welcomeAttemptedRef.current) {
      welcomeAttemptedRef.current = true;
      // Check if welcome has been shown for this user session
      const welcomeId = user?._id || user?.email || 'anonymous';
      const welcomeShownKey = `welcomeShown_${welcomeId}`;
      const welcomeShown = localStorage.getItem(welcomeShownKey);

      if (!welcomeShown) {
        // Show welcome toast
        toast.showToast({
            variant: "welcome",
            title: `Hi, ${user.firstName}!`,
            message: "Welcome to Rent-A-Ride Albay",
            duration: 5000,
        });

        // Mark welcome as shown for this user
        localStorage.setItem(welcomeShownKey, "true");
      }
    }
  }, [isAuthenticated, user, toast, welcomeAttemptedRef]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
