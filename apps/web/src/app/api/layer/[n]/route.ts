import { getLayer } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  const { n } = await params;
  const layer = getLayer(Number(n));
  return layer ? Response.json(layer) : new Response("not found", { status: 404 });
}
