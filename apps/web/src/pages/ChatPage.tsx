import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CHAT_MESSAGE_EVENT, type MessageResponse } from '@genuine-homes/shared';
import { chatApi } from '@/api/chat';
import { EmptyState, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { createChatSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function ChatPage() {
  const token = useAuthStore((s) => s.accessToken);
  const meId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const listingId = params.get('listingId') ?? undefined;

  const [selected, setSelected] = useState<string | null>(params.get('to'));
  const [body, setBody] = useState('');
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const conversations = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => chatApi.conversations(),
  });

  const thread = useQuery({
    queryKey: ['chat', 'thread', selected],
    queryFn: () => chatApi.thread(selected as string),
    enabled: Boolean(selected),
  });

  const send = useMutation({
    mutationFn: () =>
      chatApi.send({ receiverId: selected as string, listingId, body: body.trim() }),
    onSuccess: () => {
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['chat', 'thread', selected] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });

  // Realtime: refresh the conversation list (and the open thread) on a push.
  useEffect(() => {
    if (!token) return;
    const socket = createChatSocket(token);
    socket.on(CHAT_MESSAGE_EVENT, (msg: MessageResponse) => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      if (msg.senderId === selectedRef.current) {
        void queryClient.invalidateQueries({
          queryKey: ['chat', 'thread', selectedRef.current],
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [token, queryClient]);

  const convos = conversations.data ?? [];
  const partnerName =
    convos.find((c) => c.partner.id === selected)?.partner.fullName ??
    (selected ? 'New conversation' : null);

  const messages = thread.data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-stone-800">Messages</h1>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* Conversation list */}
        <aside className="card max-h-[70vh] overflow-y-auto p-2">
          {conversations.isLoading ? (
            <Spinner label="Loading…" />
          ) : convos.length === 0 && !selected ? (
            <p className="p-4 text-sm text-stone-500">No conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {convos.map((c) => (
                <li key={c.partner.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.partner.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      selected === c.partner.id ? 'bg-brand/10' : 'hover:bg-stone-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-stone-800">
                        {c.partner.fullName}
                      </span>
                      <span className="block truncate text-stone-500">{c.lastMessage}</span>
                    </span>
                    {c.unread > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-semibold text-white">
                        {c.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Thread */}
        <section className="card flex h-[70vh] flex-col">
          {!selected ? (
            <div className="grid flex-1 place-items-center">
              <EmptyState title="Select a conversation" hint="Pick someone on the left to chat." />
            </div>
          ) : (
            <>
              <div className="border-b border-stone-200 px-4 py-3 font-semibold text-stone-800">
                {partnerName}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.isLoading ? (
                  <Spinner label="Loading messages…" />
                ) : thread.isError ? (
                  <ErrorState message={apiErrorMessage(thread.error)} />
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-stone-400">
                    No messages yet — say hello.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === meId;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            mine ? 'bg-brand text-white' : 'bg-stone-100 text-stone-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`mt-1 text-right text-[10px] ${mine ? 'text-emerald-50/80' : 'text-stone-400'}`}>
                            {time(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form
                className="flex gap-2 border-t border-stone-200 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (body.trim()) send.mutate();
                }}
              >
                <input
                  className="input flex-1"
                  placeholder="Type a message…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                />
                <button className="btn-primary" type="submit" disabled={send.isPending || !body.trim()}>
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
