import { UsersClient } from "./UsersClient";
import { getUsers } from "./actions";
import { Users as UsersIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div className="p-8 pb-20 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <UsersIcon className="h-8 w-8 text-primary" />
          Gestión de Usuarios
        </h1>
        <p className="text-muted mt-2">
          Administra quién tiene acceso al panel y qué permisos tienen.
        </p>
      </div>

      <UsersClient initialUsers={users} />
    </div>
  );
}
