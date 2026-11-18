import { RadarPreviewPage } from "@/components/mock/radar-preview";
import { ProspectingShell } from "@/components/radar/prospecting-shell";
import { radarConfigured } from "@/lib/radar/api";

// Sem RADAR_API_URL/RADAR_API_KEY no ambiente, mostra a prévia com dados de exemplo.
export const dynamic = "force-dynamic";

export default function ProspeccaoPage() {
  return radarConfigured() ? <ProspectingShell /> : <RadarPreviewPage />;
}
