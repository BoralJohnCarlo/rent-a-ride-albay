import multer from "multer";

import {
    uploadImage,
    uploadVideo,
} from "../utils/cloudinary.js";

const MAX_FILE_SIZE =
    5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

const storage =
    multer.memoryStorage();

const fileFilter = (
    req,
    file,
    cb
) => {
    if (
        !ALLOWED_MIME_TYPES.includes(
            file.mimetype
        )
    ) {
        return cb(
            new Error(
                "Only JPG, PNG, and WEBP images are allowed."
            ),
            false
        );
    }

    cb(null, true);
};

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
    fileFilter,
});

export const uploadPaymentProof =
    [
        upload.single("proof"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Payment proof image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/payments",
                        }
                    );

                req.paymentProof = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];

export const uploadVehicleImage =
    [
        upload.single("image"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Vehicle image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/vehicles",
                        }
                    );

                req.vehicleImage = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];

export const uploadValidIdImage =
    [
        upload.single("validIdImage"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Valid ID image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/valid-ids",
                        }
                    );

                req.validIdImage = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];

/* Proof of billing address — at registration and from the profile page. */
export const uploadProofOfBillingImage =
    [
        upload.single("proofOfBillingImage"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Proof of billing address image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/proof-of-billing",
                        }
                    );

                req.proofOfBillingImage = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];

export const uploadProfileImage =
    [
        upload.single("profileImage"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Profile image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/profiles",
                        }
                    );

                req.profileImage = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];

export const uploadTestimonialImage =
    [
        upload.single("image"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Testimonial image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/testimonials",
                        }
                    );

                req.testimonialImage = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];

export const uploadReviewImage =
    [
        upload.single("image"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Review image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/reviews",
                        }
                    );

                req.reviewImage = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];
/*
 * Hero background video (admin → Settings → Themes & Display). Kept separate
 * from the image uploader above: its own size limit and types, and its own
 * error messages (the shared multer error handler reports the 5MB image cap).
 */
export const HERO_VIDEO_MAX_SIZE_MB = 50;

const HERO_VIDEO_MIME_TYPES = [
    "video/mp4",
    "video/webm",
];

const heroVideoUpload = multer({
    storage,
    limits: {
        fileSize: HERO_VIDEO_MAX_SIZE_MB * 1024 * 1024,
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        if (!HERO_VIDEO_MIME_TYPES.includes(file.mimetype)) {
            return cb(
                new Error(
                    "Only MP4 and WebM videos are allowed."
                ),
                false
            );
        }

        cb(null, true);
    },
}).single("video");

export const uploadHeroVideo = [
    (req, res, next) => {
        heroVideoUpload(req, res, (error) => {
            if (!error) {
                return next();
            }

            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? `Video is too large. Maximum size is ${HERO_VIDEO_MAX_SIZE_MB}MB.`
                    : error.message || "Video upload failed.";

            return res.status(400).json({
                success: false,
                message,
            });
        });
    },

    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Hero video file is required.",
                });
            }

            const result = await uploadVideo(req.file.buffer, {
                folder: "rent-a-ride-albay/hero",
            });

            req.heroVideo = {
                url: result.secure_url,
                publicId: result.public_id,
                originalName: req.file.originalname,
            };

            next();
        } catch (error) {
            next(error);
        }
    },
];

export const uploadDestinationImage =
    [
        upload.single("image"),

        async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Destination image is required.",
                    });
                }

                const result =
                    await uploadImage(
                        req.file.buffer,
                        {
                            folder:
                                "rent-a-ride-albay/destinations",
                        }
                    );

                req.destinationImage = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    originalName:
                        req.file.originalname,
                };

                next();
            } catch (error) {
                next(error);
            }
        },
    ];

/*
 * Hero background still image (admin → Settings → Themes & Display). Larger
 * limit than the general 5MB image uploader: it's a full-width photo.
 */
export const HERO_IMAGE_MAX_SIZE_MB = 10;

const heroImageUpload = multer({
    storage,
    limits: {
        fileSize: HERO_IMAGE_MAX_SIZE_MB * 1024 * 1024,
        files: 1,
    },
    fileFilter,
}).single("image");

export const uploadHeroImage = [
    (req, res, next) => {
        heroImageUpload(req, res, (error) => {
            if (!error) {
                return next();
            }

            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? `Image is too large. Maximum size is ${HERO_IMAGE_MAX_SIZE_MB}MB.`
                    : error.message || "Image upload failed.";

            return res.status(400).json({
                success: false,
                message,
            });
        });
    },

    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Hero image file is required.",
                });
            }

            const result = await uploadImage(req.file.buffer, {
                folder: "rent-a-ride-albay/hero",
            });

            req.heroImage = {
                url: result.secure_url,
                publicId: result.public_id,
                originalName: req.file.originalname,
            };

            next();
        } catch (error) {
            next(error);
        }
    },
];
