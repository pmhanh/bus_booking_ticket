import { useEffect, useState } from "react";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { FormField } from "../../../shared/components/ui/FormField";
import { apiClient } from "../../../shared/api/api";
import { useAuth } from "../../auth/context/AuthContext";
import type { User } from "../../auth/types/user";

export const AdminUsersPage = () => {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");

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
    const nextStatus = user.status === "banned" ? "active" : "banned";
    await apiClient<User>(`/admin/users/${user.id}/status`, {
      method: "PATCH",
      body: { status: nextStatus },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setFilters({ ...filters });
  };

  const startEditRole = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
  };

  const cancelEditRole = () => {
    setEditingUser(null);
    setSelectedRole("");
  };

  const confirmEditRole = async () => {
    if (!editingUser || !selectedRole) return;

    await apiClient<User>(`/admin/users/${editingUser.id}/role`, {
      method: "PATCH",
      body: { role: selectedRole },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    setEditingUser(null);
    setSelectedRole("");
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
            placeholder="pending/active/banned"
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
                    u.status === "active"
                      ? "bg-green-600/30 text-green-300"
                      : u.status === "pending"
                        ? "bg-yellow-600/30 text-yellow-200"
                        : "bg-error/30 text-error"
                  }`}
                >
                  {u.status === "active" ? "Active" : u.status === "pending" ? "Pending" : "Banned"}
                </span>
              </div>
              <div className="text-right space-x-2">
                <Button variant="secondary" onClick={() => startEditRole(u)}>
                  Edit Role
                </Button>
                <Button variant="ghost" onClick={() => toggleStatus(u)}>
                  {u.status === "banned" ? "Activate" : "Ban"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-white">Edit User Role</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Changing role for: <span className="text-white font-semibold">{editingUser.email}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                >
                  <option value="user" style={{ color: '#111' }}>User</option>
                  <option value="agent" style={{ color: '#111' }}>Agent</option>
                  <option value="admin" style={{ color: '#111' }}>Admin</option>
                </select>
              </div>

              {selectedRole === 'admin' && (
                <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-3">
                  <p className="text-sm text-yellow-200">
                    ⚠️ Warning: Granting admin role gives full system access.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={cancelEditRole}>
                  Cancel
                </Button>
                <Button onClick={confirmEditRole} disabled={!selectedRole || selectedRole === editingUser.role}>
                  Confirm Change
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
