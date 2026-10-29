import api from "../lib/axios";

export const getPublicTestimonials = async () => {
    const { data } = await api.get("/testimonials/public");

    return data;
};

export const getAllTestimonials = async () => {
    const { data } = await api.get("/testimonials");

    return data;
};

export const createTestimonial = async (testimonialData) => {
    const { data } = await api.post(
        "/testimonials",
        testimonialData
    );

    return data;
};

export const createTestimonialFromReview = async (reviewId) => {
    const { data } = await api.post(
        `/testimonials/from-review/${reviewId}`
    );

    return data;
};

export const updateTestimonial = async (id, testimonialData) => {
    const { data } = await api.put(
        `/testimonials/${id}`,
        testimonialData
    );

    return data;
};

export const deleteTestimonial = async (id) => {
    const { data } = await api.delete(`/testimonials/${id}`);

    return data;
};

export const uploadTestimonialImage = async (file) => {
    const formData = new FormData();

    formData.append("image", file);

    const { data } = await api.post(
        "/testimonials/upload-image",
        formData,
        {
            headers: {
                "Content-Type": undefined,
            },
        }
    );

    return data;
};
