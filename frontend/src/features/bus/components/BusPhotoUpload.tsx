import { useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { apiClient } from '../../../shared/api/api';

interface BusPhotoUploadProps {
  busId: number;
  photos: string[];
  accessToken: string;
  onPhotoChange: () => void;
}

export function BusPhotoUpload({ busId, photos, accessToken, onPhotoChange }: BusPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setUploading(true);
    setMessage('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/admin/buses/${busId}/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      setMessage('Tải ảnh lên thành công!');
      onPhotoChange();
    } catch (err) {
      setMessage((err as Error).message || 'Không thể tải ảnh lên');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!window.confirm('Xóa ảnh này?')) return;

    try {
      await apiClient(`/admin/buses/${busId}/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setMessage('Xóa ảnh thành công!');
      onPhotoChange();
    } catch (err) {
      setMessage((err as Error).message || 'Không thể xóa ảnh');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
          <Button
            as="span"
            variant="secondary"
            disabled={uploading}
          >
            {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
          </Button>
        </label>
        <span className="text-xs text-gray-400">
          JPG, PNG, GIF, WEBP (max 5MB)
        </span>
      </div>

      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-lg ${
            message.includes('thành công')
              ? 'text-green-300 bg-green-600/20 border border-green-600/30'
              : 'text-red-300 bg-red-600/20 border border-red-600/30'
          }`}
        >
          {message}
        </div>
      )}

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo} className="relative group rounded-lg overflow-hidden border border-white/10">
              <img
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/../uploads/buses/${photo}`}
                alt="Bus"
                className="w-full h-32 object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(photo)}
                  className="text-red-400 hover:text-red-300"
                >
                  Xóa
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic">Chưa có ảnh nào</div>
      )}
    </div>
  );
}
