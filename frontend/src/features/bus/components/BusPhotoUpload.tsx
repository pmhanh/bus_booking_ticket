import { useToast } from '../../../shared/providers/ToastProvider';
import { useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { apiClient } from '../../../shared/api/api';

interface BusPhotoUploadProps {
  busId: number;
  photos: string[];
  onPhotoChange: () => void;
}

export function BusPhotoUpload({
  busId,
  photos,
  onPhotoChange,
}: BusPhotoUploadProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setUploading(true);

    try {
      await apiClient(`/admin/buses/${busId}/photos`, {
        method: 'POST',
        body: formData,
        timeout: 90000,
      });

      showSuccess('Tải ảnh lên thành công!');
      onPhotoChange();
    } catch (err) {
      showError((err as Error).message || 'Không thể tải ảnh lên');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!(await confirm({ message: 'Xóa ảnh này?', danger: true }))) return;

    try {
      await apiClient(`/admin/buses/${busId}/photos?url=${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
        timeout: 90000,
      });
      showSuccess('Xóa ảnh thành công!');
      onPhotoChange();
    } catch (err) {
      showError((err as Error).message || 'Không thể xóa ảnh');
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
          <span
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${uploading ? 'bg-white/5 text-gray-400 cursor-not-allowed' : 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'}`}
          >
            {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
          </span>
        </label>
        <span className="text-xs text-gray-400">
          JPG, PNG, GIF, WEBP (tối đa 5 MB)
        </span>
      </div>

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div
              key={photo}
              className="relative group rounded-lg overflow-hidden border border-white/10"
            >
              <img
                src={photo}
                alt="Xe khách"
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
