import { createLazyFileRoute } from "@tanstack/react-router";
import { ConversationPage } from "@/routes/_app/chat/-components/conversation-page";

export const Route = createLazyFileRoute("/_app/chat/")({ component: ConversationPage });
