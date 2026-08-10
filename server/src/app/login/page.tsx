"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => await loginAction(formData),
    null
  );

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md glass rounded-2xl border border-border p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            RN
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Acceso al Panel</h1>
          <p className="text-muted text-sm mt-2">Ingresa tus credenciales para continuar</p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm font-medium text-center">
              {state.error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Usuario</label>
            <input 
              type="text" 
              name="username" 
              required
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted/50"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Contraseña</label>
            <input 
              type="password" 
              name="password" 
              required
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted/50"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3.5 rounded-lg font-medium transition-colors border border-primary-hover shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
