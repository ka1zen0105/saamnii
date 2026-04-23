import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { askHelpChat } from "../api/analyticsApi.js";
import "./InternalHelpChatbot.css";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildKnowledge(role) {
  const common = [
    {
      id: "dashboard",
      keywords: ["dashboard", "overview", "home", "start", "main page"],
      answer:
        "Start from Dashboard to get the overall status, latest updates, and key analysis summaries.",
      links:
        role === "admin"
          ? [{ to: "/admin/dashboard", label: "Open Admin Dashboard" }]
          : [{ to: "/faculty/dashboard", label: "Open Faculty Dashboard" }],
    },
    {
      id: "upload",
      keywords: ["upload", "file", "excel", "sheet", "import", "result file"],
      answer:
        "Use Upload to import your latest result workbook. Once uploaded, analytics and grade-band pages use that dataset.",
      links:
        role === "faculty"
          ? [{ to: "/faculty/upload", label: "Go to Upload" }]
          : [{ to: "/admin/analysis-of-students", label: "Open Grade Band (Admin view)" }],
    },
    {
      id: "grade-band",
      keywords: ["grade band", "distribution", "grades", "bar graph", "frequency polygon"],
      answer:
        "Grade Band shows how many students fall into each grade bucket for exam components.",
      links:
        role === "admin"
          ? [{ to: "/admin/analysis-of-students", label: "Open Grade Band" }]
          : [{ to: "/faculty/grade-bands", label: "Open Grade Bands" }],
    },
    {
      id: "analytics",
      keywords: ["analytics", "bell curve", "analysis", "chart", "insights"],
      answer:
        "Analytics provides bell-curve and deeper visual trends for selected datasets and subjects.",
      links:
        role === "admin"
          ? [{ to: "/admin/analytics", label: "Open Analytics" }]
          : [{ to: "/faculty/analytics", label: "Open Analytics" }],
    },
  ];

  const adminOnly = [
    {
      id: "faculty-access",
      keywords: ["faculty access", "assign faculty", "add teacher", "subjects allocation"],
      answer:
        "Faculty Access lets you add faculty accounts and allocate subjects/semester mappings.",
      links: [{ to: "/admin/faculty-access", label: "Open Faculty Access" }],
    },
  ];

  const facultyOnly = [
    {
      id: "profile",
      keywords: ["profile", "password", "contact", "email", "update details"],
      answer:
        "Use Profile to update your contact details and password settings.",
      links: [{ to: "/faculty/profile", label: "Open Profile" }],
    },
  ];

  return role === "admin" ? [...common, ...adminOnly] : [...common, ...facultyOnly];
}

function matchIntent(query, knowledge) {
  const q = normalize(query);
  if (!q) return null;

  let best = null;
  let bestScore = 0;
  for (const item of knowledge) {
    let score = 0;
    for (const kw of item.keywords) {
      const n = normalize(kw);
      if (!n) continue;
      if (q.includes(n)) score += Math.max(1, n.length / 6);
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

export function InternalHelpChatbot({ role }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const knowledge = useMemo(() => buildKnowledge(role), [role]);
  const [messages, setMessages] = useState([
    {
      id: "m1",
      sender: "bot",
      text:
        "Hi! I can guide you through this website. Ask things like: 'How do I upload?', 'Where is grade band?', or 'How to update profile?'",
      links: [],
    },
  ]);

  async function handleSend(e) {
    e.preventDefault();
    if (sending) return;
    const text = input.trim();
    if (!text) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
      links: [],
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        text: m.text,
      }));
      const data = await askHelpChat(text, history);
      const botMsg = {
        id: `b-${Date.now() + 1}`,
        sender: "bot",
        text:
          String(data?.answer || "").trim() ||
          "Try asking about dashboard, upload, analytics, grade bands, profile, or faculty access.",
        links: Array.isArray(data?.links) ? data.links : [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Fallback to local intent matching when Ollama is unavailable.
      const intent = matchIntent(text, knowledge);
      const botMsg = intent
        ? {
            id: `b-${Date.now() + 1}`,
            sender: "bot",
            text: `${intent.answer} (Offline fallback mode)`,
            links: intent.links,
          }
        : {
            id: `b-${Date.now() + 1}`,
            sender: "bot",
            text:
              "Local AI assistant is unavailable right now. Try again after starting Ollama, or ask about dashboard/upload/analytics/grade bands/profile.",
            links: knowledge.slice(0, 3).flatMap((k) => k.links).slice(0, 3),
          };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="helpbot-root">
      {open ? (
        <section className="helpbot-panel" aria-label="Website guide chatbot">
          <header className="helpbot-head">
            <strong>Website Guide</strong>
            <button type="button" onClick={() => setOpen(false)} className="helpbot-close">
              Close
            </button>
          </header>

          <div className="helpbot-messages">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`helpbot-msg ${m.sender === "user" ? "is-user" : "is-bot"}`}
              >
                <p>{m.text}</p>
                {m.links?.length ? (
                  <div className="helpbot-links">
                    {m.links.map((l) => (
                      <Link key={`${m.id}-${l.to}`} to={l.to} className="helpbot-link">
                        {l.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form className="helpbot-input" onSubmit={handleSend}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how to use a feature..."
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              {sending ? "..." : "Send"}
            </button>
          </form>
        </section>
      ) : null}

      <button type="button" className="helpbot-fab" onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">💬</span>
        <span className="sr-only">Open help chatbot</span>
      </button>
    </div>
  );
}

