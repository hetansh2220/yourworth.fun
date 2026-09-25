import { Buffer } from "node:buffer";
import type { UploadApiResponse } from "cloudinary";

import { cloudinary } from "./cloudinary";

export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export function uploadAvatarBuffer(buffer: Buffer) {
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!uploadPreset) {
    throw new Error("Missing CLOUDINARY_UPLOAD_PRESET");
  }

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.unsigned_upload_stream(
      uploadPreset,
      (error: Error | undefined, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

export async function uploadAvatarFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Avatar must be an image");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Avatar must be smaller than 5MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadAvatarBuffer(buffer);
}
