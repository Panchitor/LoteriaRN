import { getEmergencyState } from "./actions";
import { EmergencyClient } from "./EmergencyClient";

export const dynamic = "force-dynamic";

export default async function EmergencyPage() {
  const state = await getEmergencyState();

  return (
    <div className="p-8 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-5xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Modo Emergencia</h1>
        <p className="text-muted mt-2">
          Control maestro para activar alertas de emergencia en todas las pantallas.
        </p>
      </div>

      <EmergencyClient initialState={state} />
    </div>
  );
}
