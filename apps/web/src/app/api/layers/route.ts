import { getLayerSummary } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getLayerSummary());
}
