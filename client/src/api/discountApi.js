import api from "../lib/axios";

/*
 * Admin management of vehicle discounts (Promotions → Discounts). Customers
 * never call these: a running discount arrives on the vehicle itself as
 * `activeDiscount`.
 */
export const getDiscounts = async (params = {}) => {
    const { data } = await api.get("/discounts", { params });

    return data;
};

export const createDiscount = async (discountData) => {
    const { data } = await api.post("/discounts", discountData);

    return data;
};

export const updateDiscount = async (discountId, discountData) => {
    const { data } = await api.patch(
        `/discounts/${discountId}`,
        discountData
    );

    return data;
};

export const deleteDiscount = async (discountId) => {
    const { data } = await api.delete(`/discounts/${discountId}`);

    return data;
};
