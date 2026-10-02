import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export function imageUploadOptions(maxBytes: number): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
        return callback(
          new BadRequestException(
            'Only JPEG, PNG, GIF and WebP images are allowed',
          ),
          false,
        );
      }
      callback(null, true);
    },
  };
}
