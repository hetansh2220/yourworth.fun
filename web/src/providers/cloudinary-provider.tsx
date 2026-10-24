"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from "react";

type CloudinaryContextType = {
    uploadImage: (file: File) => Promise<string>;
    isUploading: boolean;
};

const CloudinaryContext = createContext<CloudinaryContextType | null>(null);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function CloudinaryProvider({ children }: { children: ReactNode }) {
    const [isUploading, setIsUploading] = useState(false);
    const activeUploads = useRef(0);

    const uploadImage = useCallback(async (file: File): Promise<string> => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error("Only JPG, PNG, and WebP images are allowed");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("Image must be smaller than 5MB");
        }

        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
            throw new Error("Cloudinary configuration is missing");
        }

        activeUploads.current += 1;
        setIsUploading(true);

        try {
            const formData = new FormData();

            formData.append("file", file);
            formData.append("upload_preset", uploadPreset);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                {
                    method: "POST",
                    body: formData,
                },
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Image upload failed");
            }

            if (typeof data.secure_url !== "string") {
                throw new Error("Invalid upload response");
            }

            return data.secure_url;
        } finally {
            activeUploads.current -= 1;

            if (activeUploads.current === 0) {
                setIsUploading(false);
            }
        }
    }, []);

    return (
        <CloudinaryContext.Provider value={{ uploadImage, isUploading }}>
            {children}
        </CloudinaryContext.Provider>
    );
}

export function useCloudinary() {
    const context = useContext(CloudinaryContext);

    if (!context) {
        throw new Error("useCloudinary must be used within CloudinaryProvider");
    }

    return context;
}
