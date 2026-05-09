declare module "multer-storage-cloudinary" {
  import type { StorageEngine } from "multer";
  import type { v2 as CloudinaryType } from "cloudinary";

  export interface CloudinaryStorageOptions {
    cloudinary: typeof CloudinaryType;
    filename?: (req: any, file: any, cb: (error: any, filename: string) => void) => void;
    folder?: string | ((req: any, file: any, cb: (error: any, folder: string) => void) => void);
    transformation?: any[] | ((req: any, file: any, cb: (error: any, transformation: any[]) => void) => void);
    type?: string | ((req: any, file: any, cb: (error: any, type: string) => void) => void);
    format?: string | ((req: any, file: any, cb: (error: any, format: string) => void) => void);
    allowedFormats?: string[] | ((req: any, file: any, cb: (error: any, allowedFormats: string[]) => void) => void);
    params?: any | ((req: any, file: any, cb: (error: any, params: any) => void) => void);
  }

  declare function cloudinaryStorage(options: CloudinaryStorageOptions): StorageEngine;

  export default cloudinaryStorage;
}
