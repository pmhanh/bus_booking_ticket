const statusLabels: Record<string, string> = {
  INIT: 'Khởi tạo',
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
  SCHEDULED: 'Đã lên lịch',
  DELAYED: 'Bị hoãn',
  IN_PROGRESS: 'Đang chạy',
  COMPLETED: 'Hoàn thành',
  DEPARTED: 'Đã khởi hành',
  ARRIVED: 'Đã đến nơi',
};

export const statusLabel = (value?: string) =>
  statusLabels[value?.toUpperCase() ?? ''] ?? 'Chưa xác định';

const busTypeLabels: Record<string, string> = {
  SEATER: 'Ghế ngồi',
  SLEEPER: 'Giường nằm',
  LIMOUSINE: 'Limousine',
  VIP: 'Xe VIP',
};

export const busTypeLabel = (value?: string) =>
  busTypeLabels[value?.toUpperCase() ?? ''] ?? 'Tiêu chuẩn';

export const busTypeOptions = Object.entries(busTypeLabels).map(
  ([value, label]) => ({ value, label }),
);

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên',
  agent: 'Nhân viên',
  user: 'Người dùng',
};

export const roleLabel = (value: string) =>
  roleLabels[value] ?? 'Chưa xác định';

const refundMethodLabels: Record<string, string> = {
  MANUAL: 'Thủ công (chuyển khoản trực tiếp)',
  GATEWAY: 'Qua cổng thanh toán',
};

export const refundMethodLabel = (value?: string) =>
  refundMethodLabels[value ?? ''] ?? 'Chưa có';

const amenityLabels: Record<string, string> = {
  FOOD: 'Thức ăn',
  POWER_OUTLET: 'Ổ điện',
  WIFI: 'Wi-Fi',
  AC: 'Điều hòa',
  AIR_CONDITIONING: 'Điều hòa',
  WATER: 'Nước uống',
  DRINKING_WATER: 'Nước uống',
  BLANKET: 'Chăn',
  BLANKETS: 'Chăn',
  USB: 'Cổng sạc USB',
  USB_CHARGING: 'Cổng sạc USB',
  CHARGING_PORT: 'Cổng sạc',
  TOILET: 'Nhà vệ sinh',
  WC: 'Nhà vệ sinh',
  TV: 'Ti vi',
};

export const amenityLabel = (value: string) =>
  amenityLabels[value.trim().toUpperCase().replace(/[ -]+/g, '_')] ?? value;

export const amenityOptions = [
  'FOOD',
  'WATER',
  'WIFI',
  'POWER_OUTLET',
  'AC',
  'BLANKET',
  'USB',
  'TOILET',
  'TV',
].map((value) => ({ value, label: amenityLabel(value) }));
