import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';

export type AdminSession = {
  id: string;
  email: string;
  name: string;
  industry: string;
  organization: string;
};

export type AgentConfig = {
  id: string;
  admin_id: string;
  name: string;
  role: string;
  tone: string;
  language: string;
  instructions: string;
  goal: string;
  industry: string;
  is_active: number;
  token_usage: number;
  knowledge_count?: number;
  conversation_count?: number;
  created_at?: string;
};

export type KnowledgeSource = {
  id: string;
  agent_id: string;
  type: 'file' | 'url' | 'text';
  name: string;
  content: string;
  mime_type: string;
  date_added: string;
};

interface AppState {
  // Auth
  admin: AdminSession | null;
  isAuthenticated: boolean;
  setAdmin: (admin: AdminSession | null) => void;
  logout: () => void;

  // Agents
  agents: AgentConfig[];
  setAgents: (agents: AgentConfig[]) => void;
  activeAgentId: string | null;
  setActiveAgentId: (id: string | null) => void;

  // Background Scraping
  pendingScrapes: number;
  scrapeUrl: (url: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      admin: null,
      isAuthenticated: false,
      setAdmin: (admin) => set({ admin, isAuthenticated: !!admin }),
      logout: () => set({ admin: null, isAuthenticated: false, agents: [], activeAgentId: null }),

      agents: [],
      setAgents: (agents) => set({ agents }),
      activeAgentId: null,
      setActiveAgentId: (id) => set({ activeAgentId: id }),

      // Background Scraping
      pendingScrapes: 0,
      scrapeUrl: (url: string) => {
        set(s => ({ pendingScrapes: s.pendingScrapes + 1 }));

        // Fire-and-forget: runs in the SPA JS context even if user navigates away
        fetch('/api/general-knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'url', name: url, content: url }),
        })
          .then(async (res) => {
            const data = await res.json();
            set(s => ({ pendingScrapes: Math.max(0, s.pendingScrapes - 1) }));
            if (res.ok) {
              toast.success(`✅ Website "${url}" berhasil di-crawl dan ditambahkan ke Knowledge Base!`, { duration: 8000 });
            } else {
              toast.error(`❌ Gagal crawl ${url}: ${data.error || 'Unknown error'}`, { duration: 8000 });
            }
          })
          .catch((err) => {
            set(s => ({ pendingScrapes: Math.max(0, s.pendingScrapes - 1) }));
            toast.error(`❌ Gagal crawl: ${err.message}`, { duration: 8000 });
          });
      },
    }),
    {
      name: 'vero-ai-storage',
      partialize: (state) => ({
        admin: state.admin,
        isAuthenticated: state.isAuthenticated,
        agents: state.agents,
        activeAgentId: state.activeAgentId,
        // Don't persist pendingScrapes — it's transient
      }),
    }
  )
);
