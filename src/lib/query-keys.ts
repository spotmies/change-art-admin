/**
 * Centralised TanStack Query keys. Every module's hooks resolve keys
 * through this builder — no inline `['xxx', id]` strings scattered across
 * the codebase.
 *
 * The shape is consistent: `[<entity>, '<scope>', ...]` so that
 * `queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() })`
 * matches every more-specific job key.
 */

export const queryKeys = {
  session: () => ['session'] as const,

  users: {
    all: () => ['users'] as const,
    list: (filters?: Record<string, unknown>) => ['users', 'list', filters ?? {}] as const,
    byId: (id: string) => ['users', 'byId', id] as const,
    teamWorkload: () => ['users', 'team-workload'] as const,
  },

  clients: {
    all: () => ['clients'] as const,
    list: (filters?: Record<string, unknown>) => ['clients', 'list', filters ?? {}] as const,
    byId: (id: string) => ['clients', 'byId', id] as const,
    me: () => ['clients', 'me'] as const,
    changeRequests: (filters?: Record<string, unknown>) =>
      ['clients', 'change-requests', filters ?? {}] as const,
  },

  jobs: {
    all: () => ['jobs'] as const,
    list: (filters?: Record<string, unknown>) => ['jobs', 'list', filters ?? {}] as const,
    byId: (id: string) => ['jobs', 'byId', id] as const,
    timeline: (id: string) => ['jobs', 'timeline', id] as const,
    versions: (id: string) => ['jobs', 'versions', id] as const,
    adminCopy: (originalJobId: string) => ['jobs', 'adminCopy', originalJobId] as const,
  },

  reviews: {
    all: () => ['reviews'] as const,
    forJob: (jobId: string) => ['reviews', 'forJob', jobId] as const,
  },

  files: {
    forJob: (jobId: string) => ['files', 'forJob', jobId] as const,
    byId: (id: string) => ['files', 'byId', id] as const,
    thumbnails: (jobIds: readonly string[]) => ['files', 'thumbnails', jobIds] as const,
  },

  quotes: {
    all: () => ['quotes'] as const,
    byId: (id: string) => ['quotes', 'byId', id] as const,
    negotiations: (id: string) => ['quotes', 'negotiations', id] as const,
  },

  notifications: {
    all: () => ['notifications'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['notifications', 'list', filters ?? {}] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },

  attendance: {
    today: () => ['attendance', 'today'] as const,
    history: (filters?: Record<string, unknown>) =>
      ['attendance', 'history', filters ?? {}] as const,
    leave: {
      list: () => ['attendance', 'leave', 'list'] as const,
    },
    summary: (userId: string) => ['attendance', 'summary', userId] as const,
  },

  analytics: {
    dashboard: (role: string) => ['analytics', 'dashboard', role] as const,
    report: (type: string, filters?: Record<string, unknown>) =>
      ['analytics', 'report', type, filters ?? {}] as const,
  },

  emailIngestion: {
    drafts: () => ['email-ingestion', 'drafts'] as const,
  },

  contactSubmissions: {
    all: () => ['contact-submissions'] as const,
    list: () => ['contact-submissions', 'list'] as const,
    byId: (id: string) => ['contact-submissions', 'byId', id] as const,
  },
} as const;
