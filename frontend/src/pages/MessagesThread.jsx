import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Card, Button, Textarea } from "../ui";

export default function MessagesThread() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");

  const authed = !!localStorage.getItem("access");

  const fetchThread = useCallback(async () => {
    try {
      const { data } = await api.get(`/inbox/threads/`);
      const t = (data || []).find((x) => x.id === Number(threadId));
      setThread(t || null);
    } catch {
      setThread(null);
    }
  }, [threadId]);

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      const { data } = await api.get(
        `/projects/0/threads/${threadId}/messages/`
      );
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (!authed) return;
    fetchThread();
    fetchMessages();
    const id = setInterval(fetchMessages, 5000);
    return () => clearInterval(id);
  }, [authed, fetchThread, fetchMessages]);

  if (!authed) {
    return (
      <div className="p-4 text-sm text-slate-700">
        Please log in to view your messages.
      </div>
    );
  }

  const counterpart = thread?.counterpart || null;

  async function handleSend(e) {
    e.preventDefault();
    setError("");
    if (!text.trim()) return;

    setSending(true);
    try {
      await api.post(
        `/projects/0/threads/${threadId}/messages/`,
        { text: text.trim() },
        { headers: { "Content-Type": "application/json" } }
      );
      setText("");
      await fetchMessages();
    } catch {
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleBlock() {
    if (!window.confirm("Block this profile? You will no longer receive messages from them.")) {
      return;
    }
    try {
      await api.post(`/inbox/threads/${threadId}/block/`);
      alert("Profile blocked. This chat will be archived.");
      navigate("/"); // or redirect to /settings/blocked
    } catch {
      alert("Failed to block this profile.");
    }
  }

  async function handleAccept() {
    try {
      await api.post(`/inbox/threads/${threadId}/accept/`);
      await fetchThread();
    } catch {
      alert("Failed to accept request.");
    }
  }

  async function handleIgnore() {
    try {
      await api.post(`/inbox/threads/${threadId}/ignore/`);
      navigate("/");
    } catch {
      alert("Failed to ignore request.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">
            <Link to="/" className="hover:underline">
              Home
            </Link>{" "}
            / Messages
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {counterpart?.display_name || counterpart?.username || "Conversation"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {thread?.is_request && (
            <>
              <Button size="sm" onClick={handleAccept}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={handleIgnore}>
                Ignore
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleBlock}>
            Block this profile
          </Button>
        </div>
      </header>

      <Card className="min-h-[260px] max-h-[60vh] overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs text-slate-500">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-500">No messages yet.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className="space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-700"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {m.sender_username}
                  </span>
                  <span>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : ""}
                  </span>
                </div>
                {m.text && (
                  <p className="whitespace-pre-line text-sm">{m.text}</p>
                )}
                {m.attachment_url && (
                  <a
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    href={m.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📎 {m.attachment_name || "Attachment"}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-3">
        <form onSubmit={handleSend} className="space-y-2">
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" disabled={sending || !text.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
