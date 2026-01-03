import type { Passenger } from '../types/passenger';
import { CheckInButton } from './CheckInButton';
import { Card } from '../../../shared/components/ui/Card';

interface PassengerListProps {
  tripId: number;
  passengers: Passenger[];
  onRefresh: () => void;
}

export function PassengerList({ tripId, passengers, onRefresh }: PassengerListProps) {
  const checkedInCount = passengers.filter((p) => p.isCheckedIn).length;
  const totalCount = passengers.length;

  if (passengers.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-400">Không có hành khách nào cho chuyến đi này.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">
            Danh sách hành khách
          </h3>
          <div className="text-sm text-gray-400">
            Đã check-in: <span className="font-semibold text-primary">{checkedInCount}</span> / {totalCount}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#1a1d2e] border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Ghế
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Họ tên
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Số điện thoại
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                CMND/CCCD
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Mã booking
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Trạng thái booking
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Check-in
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {passengers.map((passenger) => (
              <tr
                key={passenger.bookingDetailId}
                className={passenger.isCheckedIn ? 'bg-green-500/10' : ''}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                  {passenger.seatCode}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                  {passenger.passengerName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                  {passenger.passengerPhone || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                  {passenger.passengerIdNumber || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                  {passenger.bookingReference}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      passenger.bookingStatus === 'CONFIRMED'
                        ? 'bg-green-600/30 text-green-300'
                        : passenger.bookingStatus === 'PENDING'
                        ? 'bg-yellow-600/30 text-yellow-300'
                        : 'bg-gray-600/30 text-gray-400'
                    }`}
                  >
                    {passenger.bookingStatus}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <CheckInButton
                    tripId={tripId}
                    bookingDetailId={passenger.bookingDetailId}
                    isCheckedIn={passenger.isCheckedIn}
                    onCheckInSuccess={onRefresh}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
