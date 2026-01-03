import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Props = {
  bookingsData: { date: string; value: number }[];
  revenueData: { date: string; value: number }[];
};

export const BookingTrendsChart = ({ bookingsData, revenueData }: Props) => {
  const combinedData = bookingsData.map((item, index) => ({
    date: new Date(item.date).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
    bookings: item.value,
    revenue: revenueData[index]?.value || 0,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1d2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'revenue') {
                return [`${value.toLocaleString('vi-VN')}đ`, 'Doanh thu'];
              }
              return [value, 'Bookings'];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="bookings"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
            name="Số booking"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 3 }}
            name="Doanh thu"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
