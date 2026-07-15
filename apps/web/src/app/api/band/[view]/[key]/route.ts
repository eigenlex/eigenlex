import { getBand, isView } from "@/lib/bands";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ view: string; key: string }> },
) {
  const { view, key } = await params;
  if (!isView(view)) return new Response("unknown view", { status: 404 });
  const band = getBand(view, decodeURIComponent(key));
  return band ? Response.json(band) : new Response("unknown band", { status: 404 });
}
