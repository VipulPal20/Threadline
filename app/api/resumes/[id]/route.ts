import { requireApiUser } from "@/lib/auth/current";
import { handle } from "@/lib/http";
import { getResumeFile } from "@/lib/services/resumes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser("STUDENT", "ALUMNI");
  const file = await getResumeFile(user, (await params).id);
  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "content-type": file.mime,
      "content-disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
});
