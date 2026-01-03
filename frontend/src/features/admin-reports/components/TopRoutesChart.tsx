import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Props = {
  data: {
    route: string;
    bookings: number;
    revenue: number;
    load: number;
  }[];
};

export const TopRoutesChart = ({ data }: Props) => {
  const formattedData = data.map((item) => ({
    route: item.route.length > 20 ? `${item.route.substring(0, 20)}...` : item.route,
    bookings: item.bookings,
    revenue: item.revenue,
    loadFactor: (item.load * 100).toFixed(1),
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
          <XAxis
            dataKey="route"
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1d2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value: number | undefined, name: string | undefined) => {
              if (value === undefined) return ['0', name || ''];
              if (name === 'revenue') {
                return [`${value.toLocaleString('vi-VN')}đ`, 'Doanh thu'];
              }
              if (name === 'loadFactor') {
                return [`${value}%`, 'Tỷ lệ lấp đầy'];
              }
              return [value, 'Bookings'];
            }}
          />
          <Legend />
          <Bar dataKey="bookings" fill="#3b82f6" name="Số booking" />
          <Bar dataKey="loadFactor" fill="#10b981" name="Tỷ lệ lấp đầy (%)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
