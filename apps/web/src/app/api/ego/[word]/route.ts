import { getEgo } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  const { word } = await params;
  const max = Number(new URL(req.url).searchParams.get("max") ?? "12");
  const ego = getEgo(
    decodeURIComponent(word).toLowerCase(),
    Number.isFinite(max) ? max : 12,
  );
  return ego ? Response.json(ego) : new Response("not found", { status: 404 });
}
