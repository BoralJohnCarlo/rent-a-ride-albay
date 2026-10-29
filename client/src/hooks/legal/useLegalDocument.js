import { useCallback, useEffect, useState } from "react";

import {
    getCurrentLegalDocument,
    getLegalDocumentVersion,
} from "../../api/legalDocumentApi";

/*
 * The version in force of a legal document (Settings → Terms & Policies).
 * A page can mount it more than once (a registration form and its Terms
 * pop-up); requests within a short window share one fetch, so both see the
 * same version — the one whose id gets sent back when it's accepted.
 */
const SHARED_FETCH_TTL_MS = 30 * 1000;

const sharedFetches = new Map();

const fetchCurrentShared = (type, { fresh = false } = {}) => {
    const cached = sharedFetches.get(type);
    const now = Date.now();

    if (!fresh && cached && now - cached.at <= SHARED_FETCH_TTL_MS) {
        return cached.promise;
    }

    const promise = getCurrentLegalDocument(type)
        .then((response) => response?.data ?? null)
        .catch((error) => {
            // Don't keep a failure around for the next caller.
            sharedFetches.delete(type);
            throw error;
        });

    sharedFetches.set(type, { promise, at: now });

    return promise;
};

const errorText = (error) =>
    error?.response?.data?.message ||
    "We couldn't load the terms. Check your connection and try again.";

/*
 * `reload()` fetches the newest version (e.g. after the server said the
 * one accepted is out of date).
 */
const useLegalDocument = (type, { enabled = true } = {}) => {
    const [state, setState] = useState({
        document: null,
        loading: Boolean(enabled && type),
        error: "",
    });
    const [request, setRequest] = useState({ fresh: false, n: 0 });

    useEffect(() => {
        if (!enabled || !type) {
            return undefined;
        }

        let active = true;

        setState((previous) => ({ ...previous, loading: true, error: "" }));

        fetchCurrentShared(type, { fresh: request.fresh })
            .then((document) => {
                if (active) {
                    setState({ document, loading: false, error: "" });
                }
            })
            .catch((error) => {
                if (active) {
                    setState((previous) => ({
                        ...previous,
                        loading: false,
                        error: errorText(error),
                    }));
                }
            });

        return () => {
            active = false;
        };
    }, [type, enabled, request]);

    const reload = useCallback(
        () => setRequest((previous) => ({ fresh: true, n: previous.n + 1 })),
        []
    );

    return { ...state, reload };
};

/* One published version by id, e.g. the one a booking accepted. */
export const useLegalDocumentVersion = (id) => {
    const [state, setState] = useState({
        document: null,
        loading: Boolean(id),
        error: "",
    });

    useEffect(() => {
        if (!id) {
            setState({ document: null, loading: false, error: "" });
            return undefined;
        }

        let active = true;

        setState({ document: null, loading: true, error: "" });

        getLegalDocumentVersion(id)
            .then((response) => {
                if (active) {
                    setState({
                        document: response?.data ?? null,
                        loading: false,
                        error: "",
                    });
                }
            })
            .catch((error) => {
                if (active) {
                    setState({
                        document: null,
                        loading: false,
                        error: errorText(error),
                    });
                }
            });

        return () => {
            active = false;
        };
    }, [id]);

    return state;
};

export default useLegalDocument;
