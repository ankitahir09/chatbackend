import multer from "multer";
import CloudinaryStorage from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new (CloudinaryStorage as any)({
  cloudinary,
  folder: "chat-images",
  allowedFormats: ["jpg", "jpeg", "png", "webp", "gif"],
  transformation: [
    { width: 500, height: 500, crop: "limit" },
    { quality: "auto" },  
  ],
});

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});
