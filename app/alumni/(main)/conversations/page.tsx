import { ConversationList } from "@/components/chat/ConversationList";
import { requirePageUser } from "@/lib/auth/current";
import { listConversations } from "@/lib/services/conversations";

export default async function AlumniConversationsPage() {
  const alumnus = await requirePageUser("ALUMNI");
  const conversations = await listConversations(alumnus);
  return (
    <>
      <span className="eyebrow">alumni</span>
      <h1 className="mb-8 mt-2 text-4xl font-extrabold leading-none md:text-5xl">Conversations</h1>
      <ConversationList conversations={conversations} basePath="/alumni/conversations" />
    </>
  );
}
