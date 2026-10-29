import { useEffect, useState } from "react";

import { fetchPublicSettings } from "../../services/settingsService";

/*
 * Whether the admin has the proof of billing address turned on (Settings →
 * Registration). `enabled` stays false until the real value arrives - and
 * if the request fails - so nothing about the field shows unless it's
 * confirmed on. Registration copes with a wrong guess on its own: the server
 * names the missing field and the form switches it on (see Register.jsx).
 */
const useProofOfBillingEnabled = () => {
    const [state, setState] = useState({
        enabled: false,
        ready: false,
    });

    useEffect(() => {
        let active = true;

        fetchPublicSettings()
            .then((response) => {
                if (!active) {
                    return;
                }

                setState({
                    enabled: response?.data?.proofOfBillingEnabled === true,
                    ready: true,
                });
            })
            .catch(() => {
                /* keep it hidden */
            });

        return () => {
            active = false;
        };
    }, []);

    return state;
};

export default useProofOfBillingEnabled;
