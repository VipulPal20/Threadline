import { ConversationList } from "@/components/chat/ConversationList";
import { requirePageUser } from "@/lib/auth/current";
import { listConversations } from "@/lib/services/conversations";

export default async function StudentConversationsPage() {
  const student = await requirePageUser("STUDENT");
  const conversations = await listConversations(student);
  return (
    <>
      <span className="eyebrow">student</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Conversations</h1>
      <ConversationList conversations={conversations} basePath="/student/conversations" />
    </>
  );
}
