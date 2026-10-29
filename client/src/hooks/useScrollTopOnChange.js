import { useLayoutEffect, useRef } from "react";

const SCROLLABLE = /(auto|scroll|overlay)/;

/*
 * Scrolls whatever actually scrolls `element` back to the top: the nearest
 * ancestor with overflow-y auto/scroll (a Modal body, a dialog panel, a
 * page's inner scroll area), or the window if there is none.
 *
 * The first overflow container found is always the one used — even when
 * its content is currently short — so a form inside a dialog never scrolls
 * the page behind the dialog.
 */
export const scrollContainerToTop = (element) => {
    // Not rendered (e.g. a closed dialog) → nothing to scroll. Never fall
    // back to the window here, or the page behind would jump.
    if (!element) {
        return;
    }

    let node = element;

    while (
        node &&
        node !== document.body &&
        node !== document.documentElement
    ) {
        if (SCROLLABLE.test(getComputedStyle(node).overflowY)) {
            node.scrollTop = 0;
            return;
        }

        node = node.parentElement;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

/*
 * Returns a ref for any element inside a multi-step form. Whenever `value`
 * (e.g. the current step) changes — and when the form first opens — its
 * scroll container is reset to the top, so the new step starts at its
 * beginning instead of wherever the previous step's "Next" button was.
 */
const useScrollTopOnChange = (value) => {
    const ref = useRef(null);

    useLayoutEffect(() => {
        scrollContainerToTop(ref.current);
    }, [value]);

    return ref;
};

export default useScrollTopOnChange;
