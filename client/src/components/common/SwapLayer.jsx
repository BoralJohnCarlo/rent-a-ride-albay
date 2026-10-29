import { useLayoutEffect, useRef } from "react";
import { useAnimate } from "framer-motion";

/*
 * Plays a swap preset ({ out, in } — see constants/swapAnimations.js) when
 * `hidden` flips. `delay` is added on top of the preset's own, to stagger
 * siblings. Starting hidden snaps straight to the "out" pose, so a piece
 * that mounts off-screen enters properly the first time. Inert while hidden
 * so invisible controls can't be clicked or tabbed to.
 *
 * A plain element on purpose: put entrance/hover motion on a parent or a
 * child, never on this element, or the two fight over transform.
 */
const SwapLayer = ({
    as: Tag = "div",
    swap,
    hidden,
    delay = 0,
    className,
    children,
    ...rest
}) => {
    const [scope, animate] = useAnimate();
    const shownHidden = useRef(null);

    useLayoutEffect(() => {
        if (shownHidden.current === hidden) {
            return;
        }

        const first = shownHidden.current === null;
        shownHidden.current = hidden;

        // Visible on mount is the element's natural state — nothing to do.
        if (first && !hidden) {
            return;
        }

        const [keyframes, transition] = hidden ? swap.out : swap.in;

        animate(
            scope.current,
            keyframes,
            first
                ? { duration: 0 }
                : {
                      ...transition,
                      delay: (transition.delay ?? 0) + delay,
                  }
        );
    }, [hidden, delay, swap, animate, scope]);

    return (
        <Tag ref={scope} inert={hidden} className={className} {...rest}>
            {children}
        </Tag>
    );
};

export default SwapLayer;
