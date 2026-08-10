import { getLiveState } from "./actions";
import { LiveControl } from "./LiveControl";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const liveState = await getLiveState();

  return (
    <div className="p-8 sm:p-10 font-[family-name:var(--font-geist-sans)] max-w-5xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Transmisión LIVE</h1>
        <p className="text-muted mt-2">
          Control maestro del streaming en vivo para todas las Agencias conectadas a la red de Lotería RN.
        </p>
      </div>

      <LiveControl initialLive={liveState} />
    </div>
  );
}
