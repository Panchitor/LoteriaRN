"use client";

import { useState } from "react";
import { createUser, deleteUser, changePassword } from "./actions";
import { Trash2, Key, Shield, ShieldAlert, Plus, Loader2 } from "lucide-react";

type User = {
  id: string;
  username: string;
  role: string;
  created_at: Date;
};

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    
    const res = await createUser(formData);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Usuario creado exitosamente. Recarga la página para verlo.' });
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    setLoading(true);
    const res = await deleteUser(id);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setUsers(users.filter(u => u.id !== id));
      setMessage({ type: 'success', text: 'Usuario eliminado.' });
    }
    setLoading(false);
  };

  const handleChangePassword = async (id: string) => {
    const newPass = prompt("Ingresa la nueva contraseña para este usuario:");
    if (!newPass) return;
    setLoading(true);
    const res = await changePassword(id, newPass);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setMessage({ type: 'success', text: 'Contraseña actualizada.' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      {message && (
        <div className={`p-4 rounded-lg border font-medium ${message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-danger/10 border-danger/20 text-danger'}`}>
          {message.text}
        </div>
      )}

      {/* CREATE FORM */}
      <div className="bg-background border border-border p-5 rounded-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" /> Nuevo Usuario
        </h2>
        <form onSubmit={handleCreate} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted mb-1 block uppercase">Usuario</label>
            <input name="username" required className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary/50 outline-none" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted mb-1 block uppercase">Contraseña</label>
            <input name="password" required type="password" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary/50 outline-none" />
          </div>
          <div className="w-48">
            <label className="text-xs font-semibold text-muted mb-1 block uppercase">Rol</label>
            <select name="role" className="w-full bg-background border border-border rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary/50 outline-none">
              <option value="EDITOR">EDITOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center h-10">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
          </button>
        </form>
      </div>

      {/* LIST */}
      <div className="grid gap-3">
        {users.map(user => (
          <div key={user.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${user.role === 'ADMIN' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                {user.role === 'ADMIN' ? <ShieldAlert className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">{user.username}</h3>
                <p className="text-xs text-muted">Creado el {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${user.role === 'ADMIN' ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                {user.role}
              </span>
              <div className="h-6 w-px bg-border mx-2"></div>
              <button onClick={() => handleChangePassword(user.id)} className="p-2 text-muted hover:text-white transition-colors" title="Cambiar Contraseña">
                <Key className="w-5 h-5" />
              </button>
              <button onClick={() => handleDelete(user.id)} className="p-2 text-muted hover:text-danger transition-colors" title="Eliminar Usuario">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
