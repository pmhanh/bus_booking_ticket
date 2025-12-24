import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { apiClient } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { User } from "../types/user";

export const AdminUsersPage = () => {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });

  useEffect(() => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    if (filters.role) params.append("role", filters.role);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    apiClient<User[]>(`/admin/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(setUsers);
  }, [accessToken, filters]);

  const toggleStatus = async (user: User) => {
    const nextStatus = user.status === "active" ? "suspended" : "active";
    await apiClient<User>(`/admin/users/${user.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setFilters({ ...filters });
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-400">Admin only</p>
          <h2 className="text-2xl font-bold text-white">Manage users</h2>
        </div>
        <div className="flex gap-2">
          <FormField
            label="Search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <FormField
            label="Role"
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            placeholder="admin/user"
          />
          <FormField
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            placeholder="active/suspended"
          />
        </div>
      </div>
      <Card>
        <div className="grid grid-cols-4 gap-3 text-xs uppercase text-gray-400 border-b border-white/5 pb-3">
          <div>Email</div>
          <div>Full name</div>
          <div>Role / Status</div>
          <div className="text-right">Action</div>
        </div>
        <div className="divide-y divide-white/5">
          {users.map((u) => (
            <div key={u.id} className="grid grid-cols-4 gap-3 py-3 items-center text-sm">
              <div className="font-medium text-white">{u.email}</div>
              <div>{u.fullName || "-"}</div>
              <div>
                <span className="px-2 py-1 rounded-full bg-white/10 text-xs mr-2">{u.role}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    u.status === "active" ? "bg-green-600/30 text-green-300" : "bg-error/30 text-error"
                  }`}
                >
                  {u.status === "active" ? "Active" : "Suspended"}
                </span>
              </div>
              <div className="text-right">
                <Button variant="secondary" onClick={() => toggleStatus(u)}>
                  {u.status === "active" ? "Suspend" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};