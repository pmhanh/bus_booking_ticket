import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';

type DashboardData = {
  summary: { label: string; value: string | number; trend: string }[];
  activity: { id: number; message: string; time: string }[];
  routes: { route: string; occupancy: number }[];
  user: { role: string };
};

export const DashboardPage = () => {
  const { user, accessToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiClient<DashboardData>('/dashboard', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(setData);
  }, [accessToken]);

  if (!data) return <div className="text-white">Loading dashboard...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Operations overview</h1>
        </div>
        <Button variant="secondary">Create ticket</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {data.summary.map((item) => (
          <Card key={item.label}>
            <div className="text-sm text-gray-400">{item.label}</div>
            <div className="text-3xl font-bold text-white mt-2">{item.value}</div>
            <div className="text-sm text-success mt-1">{item.trend}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Live routes">
          <div className="space-y-3">
            {data.routes.map((r) => (
              <div key={r.route} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-white">{r.route}</div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary"
                      style={{ width: `${r.occupancy * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-300">{Math.round(r.occupancy * 100)}%</div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Latest activity"
          actions={<span className="text-xs text-gray-400">{user?.role} visibility</span>}
        >
          <div className="space-y-3">
            {data.activity.map((item) => (
              <div key={item.id} className="flex items-start justify-between border-b border-white/5 pb-2">
                <div>
                  <div className="font-medium text-white">{item.message}</div>
                  <div className="text-xs text-gray-400">{item.time}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-secondary">New</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
