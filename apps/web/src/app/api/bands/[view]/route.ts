import { getBandSummary, isView } from "@/lib/bands";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ view: string }> },
) {
  const { view } = await params;
  if (!isView(view)) return new Response("unknown view", { status: 404 });
  return Response.json(getBandSummary(view));
}
