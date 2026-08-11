"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Tv, FileVideo, Settings, Activity, Users, LogOut, Download, FolderTree, Calendar, AlertTriangle, Type, ShieldAlert } from "lucide-react";
import { logoutAction } from "@/app/login/actions";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, role: "EDITOR" },
  { name: "Agencias y TVs", href: "/agencies", icon: Tv, role: "EDITOR" },
  { name: "Contenido", href: "/content", icon: FileVideo, role: "EDITOR" },
  { name: "Marquesina", href: "/ticker", icon: Type, role: "EDITOR" },
  { name: "Monitoreo Red", href: "/monitoring", icon: Activity, role: "EDITOR" },
  { name: "Alertas", href: "/alerts", icon: ShieldAlert, role: "EDITOR" },

  { name: "Transmisión LIVE", href: "/live", icon: Activity, role: "ADMIN" },
  { name: "Emergencia", href: "/emergency", icon: AlertTriangle, role: "ADMIN" },
  { name: "Actualizaciones", href: "/updates", icon: Download, role: "ADMIN" },
  { name: "Grupos", href: "/groups", icon: FolderTree, role: "ADMIN" },
  { name: "Programación", href: "/schedule", icon: Calendar, role: "ADMIN" },
  { name: "Configuración", href: "/settings", icon: Settings, role: "ADMIN" },
  { name: "Usuarios", href: "/users", icon: Users, role: "ADMIN" },
];

export default function Sidebar({ role, username }: { role?: string, username?: string }) {
  const pathname = usePathname();

  if (pathname === "/login" || !role) return null;

  // If role is EDITOR, filter out ADMIN routes. If ADMIN, show everything.
  const visibleNav = navigation.filter(item => {
    if (role === "ADMIN") return true;
    return item.role !== "ADMIN";
  });

  return (
    <div className="w-64 border-r border-border bg-background glass flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="p-6 flex items-center justify-center border-b border-border">
        <div className="flex flex-col items-center">
          <div className="h-16 w-32 mb-2">
            <img src="/logo-loteria-rn.png" alt="Logo Lotería de Río Negro" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white hidden">Lotería RN</h1>
          <p className="text-xs text-muted mb-1 mt-1">Gestor de Agencias</p>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-1">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-muted hover:bg-surface-hover hover:text-white"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-muted group-hover:text-white"}`} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        {username && (
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">{username}</span>
              <span className="text-xs text-primary">{role}</span>
            </div>
            <button 
              onClick={() => logoutAction()}
              className="p-2 text-muted hover:text-danger transition-colors rounded-lg hover:bg-danger/10"
              title="Cerrar Sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-3 py-2 bg-background/50 rounded-lg">
          <p className="text-xs text-muted/60 text-center">Desarrollado por</p>
          <p className="text-xs font-semibold text-muted text-center mt-1">Patagonia Live</p>
        </div>
      </div>
    </div>
  );
}
