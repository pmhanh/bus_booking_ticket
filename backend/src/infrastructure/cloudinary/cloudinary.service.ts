import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadedImage {
  url: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {}

  private options() {
    const cloud_name = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const api_key = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const api_secret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    if (!cloud_name || !api_key || !api_secret) {
      throw new ServiceUnavailableException('Image storage is not configured');
    }
    return { cloud_name, api_key, api_secret, secure: true, timeout: 60000 };
  }

  private uploadError(error?: { http_code?: number; code?: string }) {
    // Do not log provider messages: they may contain signatures or credentials.
    const status = error?.http_code;
    if (status === 401 || status === 403) {
      this.logger.error(
        'Cloudinary rejected upload authentication or permissions',
      );
      return new ServiceUnavailableException(
        'Cloudinary authentication failed. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, then restart the backend',
      );
    }
    if (status === 400)
      return new BadRequestException('Invalid or unsupported image');
    this.logger.error(
      `Cloudinary upload failed (HTTP ${status ?? 'unavailable'})`,
    );
    return new BadGatewayException('Image upload failed. Please try again');
  }

  async uploadImage(
    file: Express.Multer.File | undefined,
    folder: 'avatars' | 'buses',
  ): Promise<UploadedImage> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No image uploaded');
    }
    const maxSize = (folder === 'avatars' ? 3 : 5) * 1024 * 1024;
    if (file.buffer.length > maxSize) {
      throw new BadRequestException('Image exceeds the upload size limit');
    }
    const options = this.options();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          ...options,
          folder: `bus-booking/${folder}`,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        },
        (error, result) => {
          if (error || !result) {
            reject(this.uploadError(error));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.on('error', () => {
        reject(this.uploadError());
      });
      stream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    const options = this.options();
    try {
      const result = (await cloudinary.uploader.destroy(publicId, {
        ...options,
        resource_type: 'image',
        invalidate: true,
      })) as { result: string };
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error('Unexpected image deletion result');
      }
    } catch {
      throw new BadGatewayException('Image deletion failed. Please try again');
    }
  }

  // Cleanup after a committed DB change must not report the successful save as failed.
  async cleanupImage(publicId?: string | null): Promise<void> {
    if (!publicId) return;
    try {
      await this.deleteImage(publicId);
    } catch {
      this.logger.error(
        `Cloudinary cleanup failed for public_id=${publicId}; retry deletion in Cloudinary`,
      );
    }
  }
}
