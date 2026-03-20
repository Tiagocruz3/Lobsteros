import { html, nothing } from "lit";
import type { AgentsListResult, AgentIdentityResult, SessionsListResult } from "../types.ts";
import { icons } from "../icons.ts";

export type AgentDashboardProps = {
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  sessionsResult: SessionsListResult | null;
  onRefresh: () => void;
  onViewAgent: (agentId: string) => void;
  onViewProfiles: () => void;
};

// Color palette for agents
const AGENT_COLORS = [
  { primary: "#ff3333", secondary: "#ff6666", bg: "rgba(255, 51, 51, 0.1)" },
  { primary: "#33ff57", secondary: "#66ff88", bg: "rgba(51, 255, 87, 0.1)" },
  { primary: "#3385ff", secondary: "#66a3ff", bg: "rgba(51, 133, 255, 0.1)" },
  { primary: "#ff33f6", secondary: "#ff66f9", bg: "rgba(255, 51, 246, 0.1)" },
  { primary: "#ffaa33", secondary: "#ffbb66", bg: "rgba(255, 170, 51, 0.1)" },
  { primary: "#33fff6", secondary: "#66fff9", bg: "rgba(51, 255, 246, 0.1)" },
  { primary: "#aa33ff", secondary: "#bb66ff", bg: "rgba(170, 51, 255, 0.1)" },
  { primary: "#ffff33", secondary: "#ffff66", bg: "rgba(255, 255, 51, 0.1)" },
];

function getAgentColor(agentId: string) {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AGENT_COLORS.length;
  return AGENT_COLORS[index];
}

function getAgentStats(agentId: string, sessionsResult: SessionsListResult | null) {
  const sessions = sessionsResult?.sessions ?? [];
  const agentSessions = sessions.filter(s => s.agentId === agentId);
  const totalSessions = agentSessions.length;
  const totalMessages = agentSessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
  const lastActive = agentSessions.length > 0 
    ? Math.max(...agentSessions.map(s => s.lastActivityAt || 0))
    : null;
  
  return { totalSessions, totalMessages, lastActive };
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "Never";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function renderAgentDashboard(props: AgentDashboardProps) {
  const { loading, error, agentsList, agentIdentityById, sessionsResult, onRefresh, onViewAgent, onViewProfiles } = props;
  
  const agents = agentsList?.agents ?? [];
  const defaultId = agentsList?.defaultId;
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.id === defaultId).length;
  
  // Calculate total stats
  const allStats = agents.map(agent => getAgentStats(agent.id, sessionsResult));
  const totalSessions = allStats.reduce((sum, s) => sum + s.totalSessions, 0);
  const totalMessages = allStats.reduce((sum, s) => sum + s.totalMessages, 0);

  return html`
    <div class="agent-dashboard">
      <!-- Header -->
      <div class="agent-dashboard__header">
        <div class="agent-dashboard__title">
          <div class="agent-dashboard__icon">
            ${icons.bot}
          </div>
          <div>
            <h1>Agent Dashboard</h1>
            <span class="agent-dashboard__subtitle">Manage and monitor your AI agents</span>
          </div>
        </div>
        <div class="agent-dashboard__actions">
          <button class="dashboard-btn secondary" @click=${onViewProfiles}>
            ${icons.user}
            View Profiles
          </button>
          <button class="dashboard-btn primary" @click=${onRefresh} ?disabled=${loading}>
            ${icons.loader}
            ${loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      ${error ? html`
        <div class="agent-dashboard__error">
          ${icons.bug}
          <span>${error}</span>
        </div>
      ` : nothing}

      <!-- Stats Overview -->
      <div class="agent-dashboard__stats">
        <div class="stat-card">
          <div class="stat-card__icon" style="background: rgba(255, 51, 51, 0.1); color: #ff3333;">
            ${icons.bot}
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">${totalAgents}</span>
            <span class="stat-card__label">Total Agents</span>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-card__icon" style="background: rgba(0, 255, 100, 0.1); color: #00ff64;">
            ${icons.activity}
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">${activeAgents}</span>
            <span class="stat-card__label">Active Default</span>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-card__icon" style="background: rgba(51, 133, 255, 0.1); color: #3385ff;">
            ${icons.fileText}
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">${totalSessions}</span>
            <span class="stat-card__label">Total Sessions</span>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-card__icon" style="background: rgba(255, 170, 51, 0.1); color: #ffaa33;">
            ${icons.messageSquare}
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">${totalMessages.toLocaleString()}</span>
            <span class="stat-card__label">Total Messages</span>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="agent-dashboard__content">
        <!-- Agents List -->
        <div class="agent-dashboard__section">
          <div class="section-header">
            <h2>Your Agents</h2>
            <span class="section-count">${totalAgents} agent${totalAgents !== 1 ? 's' : ''}</span>
          </div>
          
          <div class="agents-table-container">
            ${agents.length === 0 ? html`
              <div class="agents-empty">
                ${icons.folder}
                <p>No agents configured</p>
                <span>Add agents in the Settings panel</span>
              </div>
            ` : html`
              <table class="agents-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Sessions</th>
                    <th>Messages</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${agents.map(agent => {
                    const identity = agentIdentityById[agent.id];
                    const color = getAgentColor(agent.id);
                    const stats = getAgentStats(agent.id, sessionsResult);
                    const isDefault = agent.id === defaultId;
                    const displayName = identity?.name || agent.name || agent.id;
                    
                    return html`
                      <tr class="agent-row ${isDefault ? 'default' : ''}" @click=${() => onViewAgent(agent.id)}>
                        <td>
                          <div class="agent-cell">
                            <div class="agent-avatar" style="background: ${color.bg}; color: ${color.primary};">
                              ${identity?.emoji || "🤖"}
                            </div>
                            <div class="agent-info">
                              <span class="agent-name">${displayName}</span>
                              <span class="agent-id">${agent.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span class="agent-status ${isDefault ? 'active' : 'idle'}">
                            ${isDefault ? '● Default' : '○ Standby'}
                          </span>
                        </td>
                        <td>
                          <span class="agent-metric">${stats.totalSessions}</span>
                        </td>
                        <td>
                          <span class="agent-metric">${stats.totalMessages.toLocaleString()}</span>
                        </td>
                        <td>
                          <span class="agent-time">${formatRelativeTime(stats.lastActive)}</span>
                        </td>
                        <td>
                          <button class="agent-action-btn" @click=${(e: Event) => { e.stopPropagation(); onViewAgent(agent.id); }}>
                            ${icons.arrowRight}
                          </button>
                        </td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <!-- Recent Activity & Quick Stats -->
        <div class="agent-dashboard__sidebar">
          <!-- Activity Chart -->
          <div class="dashboard-card">
            <h3>Activity Overview</h3>
            <div class="activity-chart">
              ${agents.slice(0, 5).map((agent, i) => {
                const stats = getAgentStats(agent.id, sessionsResult);
                const maxMessages = Math.max(...allStats.map(s => s.totalMessages), 1);
                const height = maxMessages > 0 ? (stats.totalMessages / maxMessages) * 100 : 0;
                const color = getAgentColor(agent.id);
                
                return html`
                  <div class="chart-bar-wrapper">
                    <div class="chart-bar" style="height: ${Math.max(height, 10)}%; background: ${color.primary};"></div>
                    <span class="chart-label">${String(i + 1)}</span>
                  </div>
                `;
              })}
            </div>
            <div class="chart-legend">
              ${agents.slice(0, 5).map((agent, i) => {
                const identity = agentIdentityById[agent.id];
                const color = getAgentColor(agent.id);
                return html`
                  <div class="legend-item">
                    <span class="legend-color" style="background: ${color.primary};"></span>
                    <span class="legend-name">${identity?.name || agent.name || agent.id}</span>
                  </div>
                `;
              })}
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="dashboard-card">
            <h3>Quick Actions</h3>
            <div class="quick-actions">
              <button class="quick-action" @click=${onViewProfiles}>
                <span class="quick-action__icon">${icons.user}</span>
                <span>Manage Profiles</span>
              </button>
              <button class="quick-action" @click=${() => {}}>
                <span class="quick-action__icon">${icons.settings}</span>
                <span>Agent Settings</span>
              </button>
              <button class="quick-action" @click=${() => {}}>
                <span class="quick-action__icon">${icons.fileText}</span>
                <span>View Logs</span>
              </button>
              <button class="quick-action" @click=${onRefresh}>
                <span class="quick-action__icon">${icons.refresh}</span>
                <span>Sync Data</span>
              </button>
            </div>
          </div>

          <!-- System Status -->
          <div class="dashboard-card">
            <h3>System Status</h3>
            <div class="system-status">
              <div class="status-item">
                <span class="status-dot active"></span>
                <span>Gateway Connected</span>
              </div>
              <div class="status-item">
                <span class="status-dot active"></span>
                <span>Agents Ready</span>
              </div>
              <div class="status-item">
                <span class="status-dot ${sessionsResult ? 'active' : 'inactive'}"></span>
                <span>Session Tracking</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
