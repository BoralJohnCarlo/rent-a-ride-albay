const ReviewImageGallery = ({
    images = [],
}) => {
    if (images.length === 0) {
        return (
            <p className="text-sm text-gray-500 dark:text-gray-400">
                No images uploaded.
            </p>
        );
    }

    return (
        <div
            className="
                grid
                grid-cols-2
                gap-4
                md:grid-cols-3
                lg:grid-cols-4
            "
        >
            {images.map(
                (
                    image,
                    index
                ) => (
                    <div
                        key={
                            image.id ??
                            image.publicId ??
                            image.url ??
                            index
                        }
                        className="
                            overflow-hidden
                            rounded-xl
                            border
                            border-gray-200
                            bg-white
                            dark:border-gray-700
                            dark:bg-gray-900
                        "
                    >
                        <img
                            src={
                                image.url ??
                                image
                            }
                            alt={`Vehicle ${index + 1}`}
                            className="
                                aspect-square
                                w-full
                                object-cover
                            "
                        />
                    </div>
                )
            )}
        </div>
    );
};

export default ReviewImageGallery;