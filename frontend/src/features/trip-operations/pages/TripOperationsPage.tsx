import { useToast } from '../../../shared/providers/ToastProvider';
import { statusLabel } from '../../../shared/utils/displayLabels';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../shared/api/api';
import type { PassengerListResponse } from '../types/passenger';
import { PassengerList } from '../components/PassengerList';
import { Card } from '../../../shared/components/ui/Card';
import { getTripDisplayStatus, type Trip } from '../../trip/types/trip';

export function TripOperationsPage() {
  const { showError, showSuccess } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [passengerData, setPassengerData] =
    useState<PassengerListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [operationalStatusLoading, setOperationalStatusLoading] =
    useState(false);

  // Include every trip so completed and cancelled trips remain available for review.
  useEffect(() => {
    const fetchTrips = async () => {
      setLoadingTrips(true);
      try {
        const data = await apiClient<Trip[]>('/admin/trips');
        setTrips(data);
      } catch (error) {
        console.error('Error fetching trips:', error);
      } finally {
        setLoadingTrips(false);
      }
    };

    fetchTrips();
  }, []);

  const fetchPassengers = useCallback(
    async (tripId: number) => {
      setLoading(true);
      try {
        const data = await apiClient<PassengerListResponse>(
          `/admin/trips/${tripId}/passengers`,
        );
        setPassengerData(data);
      } catch (error) {
        console.error('Error fetching passengers:', error);
        showError('Không thể tải danh sách hành khách');
      } finally {
        setLoading(false);
      }
    },
    [showError],
  );

  const handleTripSelect = (tripId: number) => {
    setSelectedTripId(tripId);
    fetchPassengers(tripId);
  };

  const handleRefresh = () => {
    if (selectedTripId) {
      fetchPassengers(selectedTripId);
    }
  };

  const handleUpdateOperationalStatus = async (
    status: 'DEPARTED' | 'ARRIVED',
  ) => {
    if (!selectedTripId) return;

    setOperationalStatusLoading(true);
    try {
      await apiClient(`/admin/trips/${selectedTripId}/operational-status`, {
        method: 'PATCH',
        body: { status },
      });

      showSuccess(
        status === 'DEPARTED'
          ? 'Đã đánh dấu chuyến xe đã khởi hành'
          : 'Đã đánh dấu chuyến xe đã đến nơi',
      );
      handleRefresh();
    } catch (error) {
      console.error('Error updating operational status:', error);
      showError(
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật trạng thái',
      );
    } finally {
      setOperationalStatusLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-white">Vận hành chuyến đi</h1>
          <p className="text-gray-400 mt-2">
            Quản lý hành khách và trạng thái vận hành của chuyến đi
          </p>
        </div>

        {/* Trip Selector */}
        <Card className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Chọn chuyến đi
          </label>
          {loadingTrips ? (
            <p className="text-gray-400">Đang tải danh sách chuyến đi...</p>
          ) : (
            <select
              value={selectedTripId || ''}
              onChange={(e) => handleTripSelect(Number(e.target.value))}
              className="w-full px-4 py-2 bg-[#1a1d2e] border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">-- Chọn chuyến đi --</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  #{trip.id} - {trip.route.originCity.name} →{' '}
                  {trip.route.destinationCity.name} -{' '}
                  {formatDateTime(trip.departureTime)} (
                  {statusLabel(getTripDisplayStatus(trip))})
                </option>
              ))}
            </select>
          )}
        </Card>

        {/* Trip Info and Actions */}
        {passengerData && (
          <Card className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {passengerData.trip.route.originCity.name} →{' '}
                  {passengerData.trip.route.destinationCity.name}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Khởi hành: {formatDateTime(passengerData.trip.departureTime)}
                </p>
                <p className="text-sm text-gray-400">
                  Trạng thái:{' '}
                  <span
                    className={`font-semibold ${
                      getTripDisplayStatus(passengerData.trip) === 'SCHEDULED'
                        ? 'text-blue-400'
                        : getTripDisplayStatus(passengerData.trip) === 'DELAYED'
                          ? 'text-amber-400'
                          : getTripDisplayStatus(passengerData.trip) === 'IN_PROGRESS'
                            ? 'text-yellow-400'
                            : getTripDisplayStatus(passengerData.trip) === 'COMPLETED'
                              ? 'text-green-400'
                              : 'text-gray-400'
                    }`}
                  >
                    {statusLabel(getTripDisplayStatus(passengerData.trip))}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateOperationalStatus('DEPARTED')}
                  disabled={
                    operationalStatusLoading ||
                    getTripDisplayStatus(passengerData.trip) !== 'SCHEDULED'
                  }
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Đánh dấu Đã khởi hành
                </button>
                <button
                  onClick={() => handleUpdateOperationalStatus('ARRIVED')}
                  disabled={
                    operationalStatusLoading ||
                    getTripDisplayStatus(passengerData.trip) !== 'IN_PROGRESS'
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Đánh dấu Đã đến nơi
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Passenger List */}
        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-gray-400">Đang tải danh sách hành khách...</p>
          </Card>
        ) : passengerData ? (
          <PassengerList
            tripId={passengerData.trip.id}
            blockedReason={passengerData.trip.checkInBlockedReason}
            passengers={passengerData.passengers}
            onRefresh={handleRefresh}
          />
        ) : selectedTripId ? (
          <Card className="p-8 text-center">
            <p className="text-gray-400">Không thể tải danh sách hành khách</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
