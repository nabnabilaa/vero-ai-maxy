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

  // Settings
  language: 'id' | 'en';
  setLanguage: (lang: 'id' | 'en') => void;

  // Agents
  agents: AgentConfig[];
  setAgents: (agents: AgentConfig[]) => void;
  activeAgentId: string | null;
  setActiveAgentId: (id: string | null) => void;

  // Background Scraping
  pendingScrapes: number;
  scrapeUrl: (url: string, crawlMode: 'single' | 'full') => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      admin: null,
      isAuthenticated: false,
      setAdmin: (admin) => set({ admin, isAuthenticated: !!admin }),
      logout: () => set({ admin: null, isAuthenticated: false, agents: [], activeAgentId: null }),

      language: 'id',
      setLanguage: (lang) => set({ language: lang }),

      agents: [],
      setAgents: (agents) => set({ agents }),
      activeAgentId: null,
      setActiveAgentId: (id) => set({ activeAgentId: id }),

      // Background Scraping
      pendingScrapes: 0,
      scrapeUrl: (url: string, crawlMode: 'single' | 'full') => {
        set(s => ({ pendingScrapes: s.pendingScrapes + 1 }));

        fetch('/api/general-knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'url', name: url, content: url, crawlMode }),
        })
          .then(async (res) => {
            const data = await res.json();
            set(s => ({ pendingScrapes: Math.max(0, s.pendingScrapes - 1) }));
            const lang = get().language;

            let displayUrl = 'Website';
            try {
              const u = new URL(url);
              displayUrl = u.hostname.replace(/^www\./, '');
            } catch {
              displayUrl = 'URL';
            }

            if (res.ok) {
              const msg = lang === 'en'
                ? `✅ ${displayUrl} successfully crawled and added to Knowledge Base!`
                : `✅ ${displayUrl} berhasil di-crawl dan ditambahkan ke Knowledge Base!`;
              toast.success(msg, { duration: 8000 });
            } else {
              let errorMsg = data.error || 'Unknown error';
              if (lang === 'en' && errorMsg.includes('memblokir bot')) {
                errorMsg = 'Website does not have enough content or blocked the bot. Try entering the information manually.';
              } else if (lang === 'en' && errorMsg.includes('Gagal mengekstrak')) {
                errorMsg = 'Failed to extract URL.';
              }
              
              const msg = lang === 'en'
                ? `❌ Failed to crawl ${displayUrl}: ${errorMsg}`
                : `❌ Gagal crawl ${displayUrl}: ${errorMsg}`;
              toast.error(msg, { duration: 8000 });
            }
          })
          .catch((err) => {
            set(s => ({ pendingScrapes: Math.max(0, s.pendingScrapes - 1) }));
            const lang = get().language;
            const msg = lang === 'en'
                ? `❌ Failed to crawl: ${err.message}`
                : `❌ Gagal crawl: ${err.message}`;
            toast.error(msg, { duration: 8000 });
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
        language: state.language,
        // Don't persist pendingScrapes — it's transient
      }),
    }
  )
);
