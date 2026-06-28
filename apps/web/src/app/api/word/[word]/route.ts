import { getWord } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  const { word } = await params;
  const info = getWord(decodeURIComponent(word).toLowerCase());
  return info ? Response.json(info) : new Response("not found", { status: 404 });
}
