import { notFound } from "next/navigation";
import { ConversationScreen } from "@/components/chat/ConversationScreen";
import { requirePageUser } from "@/lib/auth/current";
import { ApiError } from "@/lib/errors";
import { getConversation } from "@/lib/services/conversations";

export default async function AlumniConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const alumnus = await requirePageUser("ALUMNI");
  try {
    return <ConversationScreen view={await getConversation(alumnus, (await params).id)} backHref="/alumni/conversations" />;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
}
