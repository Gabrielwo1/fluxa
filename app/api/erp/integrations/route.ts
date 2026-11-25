import { reader } from "@/lib/erp/http";
import { hasIngestKey } from "@/lib/erp/ingest-auth";
import { overview, SOURCES } from "@/lib/erp/services/ingest";
import { syncStatus } from "@/lib/erp/services/sync";

export const GET = reader(async ({ tenant }, req) => ({
  endpoint: `${req.nextUrl.origin}/api/ingest`,
  key_configured: hasIngestKey(tenant),
  sources: SOURCES,
  overview: await overview(tenant),
  sync: await syncStatus(tenant),
}));
