import { notFound } from "next/navigation";
import { ConversationScreen } from "@/components/chat/ConversationScreen";
import { requirePageUser } from "@/lib/auth/current";
import { ApiError } from "@/lib/errors";
import { getConversation } from "@/lib/services/conversations";

export default async function StudentConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await requirePageUser("STUDENT");
  try {
    return <ConversationScreen view={await getConversation(student, (await params).id)} backHref="/student/conversations" />;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
}
