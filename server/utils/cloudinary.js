import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadImage = async (
    fileBuffer,
    options = {}
) => {
    if (!fileBuffer) {
        throw new Error(
            "Image file is required."
        );
    }

    return new Promise(
        (resolve, reject) => {
            const uploadStream =
                cloudinary.uploader.upload_stream(
                    {
                        resource_type: "image",
                        folder:
                            options.folder ||
                            "rent-a-ride-albay",
                        public_id:
                            options.publicId,
                        transformation:
                            options.transformation,
                    },
                    (error, result) => {
                        if (error) {
                            return reject(
                                error
                            );
                        }

                        resolve(result);
                    }
                );

            uploadStream.end(
                fileBuffer
            );
        }
    );
};

export const deleteImage = async (
    publicId
) => {
    if (!publicId) {
        return null;
    }

    return cloudinary.uploader.destroy(
        publicId,
        {
            resource_type: "image",
        }
    );
};

/*
 * Videos go through Cloudinary's chunked upload stream so larger files
 * don't have to fit a single request (Cloudinary caps single-request video
 * uploads at 100MB).
 */
export const uploadVideo = async (
    fileBuffer,
    options = {}
) => {
    if (!fileBuffer) {
        throw new Error(
            "Video file is required."
        );
    }

    return new Promise(
        (resolve, reject) => {
            const uploadStream =
                cloudinary.uploader.upload_chunked_stream(
                    {
                        resource_type: "video",
                        folder:
                            options.folder ||
                            "rent-a-ride-albay",
                        chunk_size: 6 * 1024 * 1024,
                    },
                    (error, result) => {
                        if (error) {
                            return reject(
                                error
                            );
                        }

                        resolve(result);
                    }
                );

            uploadStream.end(
                fileBuffer
            );
        }
    );
};

export const deleteVideo = async (
    publicId
) => {
    if (!publicId) {
        return null;
    }

    return cloudinary.uploader.destroy(
        publicId,
        {
            resource_type: "video",
        }
    );
};

export default cloudinary;