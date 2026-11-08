export const getDatePickerPosition = (rect, viewport, contentHeight) => {
    const paddingX = Math.min(12, viewport.width / 2);
    const paddingY = Math.min(12, viewport.height / 2);
    const leftEdge = (viewport.offsetLeft ?? 0) + paddingX;
    const topEdge = (viewport.offsetTop ?? 0) + paddingY;
    const rightEdge = (viewport.offsetLeft ?? 0) + viewport.width - paddingX;
    const bottomEdge = (viewport.offsetTop ?? 0) + viewport.height - paddingY;
    const width = Math.min(304, Math.max(0, rightEdge - leftEdge));
    const height = Math.min(contentHeight, Math.max(0, bottomEdge - topEdge));
    const spaceBelow = bottomEdge - rect.bottom - 8;
    const spaceAbove = rect.top - topEdge - 8;
    const placeAbove = spaceBelow < height && spaceAbove > spaceBelow;
    const desiredTop = placeAbove ? rect.top - height - 8 : rect.bottom + 8;
    const top = Math.max(topEdge, Math.min(desiredTop, bottomEdge - height));

    return {
        top,
        left: Math.max(leftEdge, Math.min(rect.left, rightEdge - width)),
        width,
        // Also bound future content growth before a resize is measured.
        maxHeight: Math.max(0, bottomEdge - top),
        placeAbove,
    };
};

export const keepPopoverFocusVisible = (panel, target) => {
    if (!panel || !target?.getBoundingClientRect || !panel.contains(target)) return;
    const maxScroll = panel.scrollHeight - panel.clientHeight;
    if (maxScroll <= 0) return;
    const bounds = target.getBoundingClientRect();
    const top = panel.getBoundingClientRect().top + panel.clientTop + 4;
    const bottom = top + panel.clientHeight - 8;
    const delta = bounds.top < top ? bounds.top - top
        : bounds.bottom > bottom ? bounds.bottom - bottom : 0;
    panel.scrollTop = Math.max(0, Math.min(maxScroll, panel.scrollTop + delta));
};
