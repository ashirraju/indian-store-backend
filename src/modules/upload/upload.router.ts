import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';

export const uploadRouter: Router = Router();

// Resolve uploads directory from environment or fallback to local ./uploads
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_PATH || './uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer memory storage configuration (10MB maximum file size)
const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
) => {
  if (allowedMimeTypes.has(file.mimetype.toLowerCase())) {
    callback(null, true);
  } else {
    callback(
      new Error(
        `Invalid file format: ${file.mimetype}. Only JPEG, PNG, WEBP, AVIF, and GIF images are allowed.`
      )
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

// Helper to determine the public asset base URL
function getBaseUrl(req: Request): string {
  if (process.env.PUBLIC_ASSET_URL) {
    return process.env.PUBLIC_ASSET_URL.replace(/\/+$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5001';
  return `${protocol}://${host}`;
}

// Process buffer with sharp into optimized webp
async function processImageToWebP(buffer: Buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const pipeline = image
    .rotate() // Auto-orient using EXIF orientation if present
    .resize({
      width: 1200,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80, effort: 4 });

  const processedBuffer = await pipeline.toBuffer();
  const processedMeta = await sharp(processedBuffer).metadata();

  const randomHash = crypto.randomBytes(8).toString('hex');
  const filename = `img_${Date.now()}_${randomHash}.webp`;
  const destinationPath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(destinationPath, processedBuffer);

  return {
    filename,
    size: processedBuffer.length,
    originalSize: buffer.length,
    width: processedMeta.width,
    height: processedMeta.height,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    format: 'webp',
  };
}

// Multer error handling wrapper
function handleUploadMiddleware(uploadMiddleware: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'FILE_TOO_LARGE',
            message: 'Image size exceeds maximum allowed limit of 10MB.',
          });
        }
        return res.status(400).json({
          success: false,
          error: 'UPLOAD_ERROR',
          message: err.message,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FILE',
          message: err.message || 'Error processing uploaded file.',
        });
      }
      next();
    });
  };
}

/**
 * POST /api/v1/upload
 * Single image upload (accepts field 'image' or 'file')
 */
uploadRouter.post(
  '/',
  authGuard,
  roleGuard('Manager', 'Admin'),
  handleUploadMiddleware((req: Request, res: Response, next: NextFunction) => {
    // Flexible handling for either 'image' or 'file' form field
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'file', maxCount: 1 },
    ])(req, res, next);
  }),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFile = files?.image?.[0] || files?.file?.[0];

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILE',
          message: "Please attach an image file using form field 'image' or 'file'.",
        });
      }

      const result = await processImageToWebP(uploadedFile.buffer);
      const baseUrl = getBaseUrl(req);
      const publicUrl = `${baseUrl}/uploads/${result.filename}`;

      return res.status(201).json({
        success: true,
        message: 'Image uploaded and optimized to WebP successfully.',
        data: {
          url: publicUrl,
          imageUrl: publicUrl,
          filename: result.filename,
          format: result.format,
          size: result.size,
          originalSize: result.originalSize,
          savingsPercent: Math.round(
            ((result.originalSize - result.size) / result.originalSize) * 100
          ),
          width: result.width,
          height: result.height,
        },
      });
    } catch (error: any) {
      console.error('Failed to process image upload:', error);
      return res.status(500).json({
        success: false,
        error: 'PROCESSING_FAILED',
        message: error.message || 'Failed to process and compress uploaded image.',
      });
    }
  }
);

/**
 * POST /api/v1/upload/multiple
 * Upload up to 10 images at once
 */
uploadRouter.post(
  '/multiple',
  authGuard,
  roleGuard('Manager', 'Admin'),
  handleUploadMiddleware(upload.array('images', 10)),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILES',
          message: "Please attach image files using form field 'images'.",
        });
      }

      const baseUrl = getBaseUrl(req);
      const results = await Promise.all(
        files.map(async (f) => {
          const processed = await processImageToWebP(f.buffer);
          return {
            url: `${baseUrl}/uploads/${processed.filename}`,
            imageUrl: `${baseUrl}/uploads/${processed.filename}`,
            filename: processed.filename,
            size: processed.size,
            format: processed.format,
          };
        })
      );

      return res.status(201).json({
        success: true,
        message: `Successfully uploaded and optimized ${results.length} images.`,
        data: results,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'PROCESSING_FAILED',
        message: error.message || 'Failed to process multiple uploaded images.',
      });
    }
  }
);

/**
 * DELETE /api/v1/upload/:filename
 * Delete an uploaded image file
 */
uploadRouter.delete(
  '/:filename',
  authGuard,
  roleGuard('Manager', 'Admin'),
  async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      // Prevent directory traversal attacks
      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(UPLOADS_DIR, sanitizedFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'FILE_NOT_FOUND',
          message: `File '${sanitizedFilename}' not found in uploads directory.`,
        });
      }

      await fs.promises.unlink(filePath);

      return res.json({
        success: true,
        message: `File '${sanitizedFilename}' deleted successfully.`,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'DELETE_FAILED',
        message: error.message || 'Failed to delete file.',
      });
    }
  }
);
