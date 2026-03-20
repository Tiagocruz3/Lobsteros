import { html, nothing } from "lit";
import type { AgentsListResult, AgentIdentityResult } from "../types.ts";
import { icons } from "../icons.ts";

export type AgentProfilesProps = {
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentIdentityLoading: boolean;
  selectedAgentId: string | null;
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onLoadIdentity: (agentId: string) => void;
};

// Sample agent avatar colors for visual variety
const AGENT_AVATAR_COLORS = [
  { bg: "#ff3333", fg: "#ffffff" },
  { bg: "#33ff57", fg: "#000000" },
  { bg: "#3385ff", fg: "#ffffff" },
  { bg: "#ff33f6", fg: "#ffffff" },
  { bg: "#ffaa33", fg: "#000000" },
  { bg: "#33fff6", fg: "#000000" },
  { bg: "#aa33ff", fg: "#ffffff" },
  { bg: "#ffff33", fg: "#000000" },
];

function getAvatarColor(agentId: string) {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AGENT_AVATAR_COLORS.length;
  return AGENT_AVATAR_COLORS[index];
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "Never";
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function renderAgentProfiles(props: AgentProfilesProps) {
  const {
    loading,
    error,
    agentsList,
    agentIdentityById,
    agentIdentityLoading,
    selectedAgentId,
    onRefresh,
    onSelectAgent,
    onLoadIdentity,
  } = props;

  const agents = agentsList?.agents ?? [];
  const defaultId = agentsList?.defaultId;
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedIdentity = selectedAgentId ? agentIdentityById[selectedAgentId] : null;

  return html`
    <div class="agent-profiles">
      <!-- Header -->
      <div class="agent-profiles__header">
        <div class="agent-profiles__title">
          ${icons.bot}
          <h2>AI Agent Profiles</h2>
          <span class="agent-count">${agents.length} agent${agents.length !== 1 ? "s" : ""}</span>
        </div>
        <button 
          class="agent-profiles__refresh ${loading ? "loading" : ""}" 
          @click=${onRefresh}
          ?disabled=${loading}
        >
          ${icons.loader}
          Refresh
        </button>
      </div>

      ${error ? html`
        <div class="agent-profiles__error">
          ${icons.bug}
          <span>${error}</span>
        </div>
      ` : nothing}

      <div class="agent-profiles__content">
        <!-- Agent Grid -->
        <div class="agent-profiles__grid">
          ${agents.map((agent) => {
            const isDefault = agent.id === defaultId;
            const isSelected = agent.id === selectedAgentId;
            const identity = agentIdentityById[agent.id];
            const color = getAvatarColor(agent.id);
            const displayName = identity?.name || agent.name || agent.id;
            const emoji = identity?.emoji || "🤖";

            return html`
              <div
                class="agent-card ${isSelected ? "selected" : ""} ${isDefault ? "default" : ""}"
                @click=${() => {
                  onSelectAgent(agent.id);
                  if (!identity && !agentIdentityLoading) {
                    onLoadIdentity(agent.id);
                  }
                }}
              >
                <div class="agent-card__avatar" style="background: ${color.bg}; color: ${color.fg};">
                  ${identity?.avatar
                    ? html`<img src="${identity.avatar}" alt="${displayName}" />`
                    : html`<span class="agent-card__emoji">${emoji}</span>`}
                </div>
                <div class="agent-card__info">
                  <div class="agent-card__name">
                    ${displayName}
                    ${isDefault
                      ? html`<span class="agent-card__badge default">Default</span>`
                      : nothing}
                  </div>
                  <div class="agent-card__id">${agent.id}</div>
                </div>
                <div class="agent-card__actions">
                  <button
                    class="agent-card__action"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      onSelectAgent(agent.id);
                      onLoadIdentity(agent.id);
                    }}
                    title="View Profile"
                  >
                    ${icons.user}
                  </button>
                </div>
              </div>
            `;
          })}

          ${agents.length === 0 && !loading
            ? html`
                <div class="agent-profiles__empty">
                  ${icons.folder}
                  <p>No agents found</p>
                  <span>Create an agent to see their profile here</span>
                </div>
              `
            : nothing}
        </div>

        <!-- Agent Detail Panel -->
        ${selectedAgent
          ? html`
              <div class="agent-detail">
                <div class="agent-detail__header">
                  <button class="agent-detail__close" @click=${() => onSelectAgent("")}>
                    ${icons.x}
                  </button>
                </div>

                <div class="agent-detail__content">
                  ${selectedIdentity?.avatar
                    ? html`
                        <div class="agent-detail__avatar">
                          <img src="${selectedIdentity.avatar}" alt="${selectedIdentity.name}" />
                        </div>
                      `
                    : html`
                        <div
                          class="agent-detail__avatar"
                          style="background: ${getAvatarColor(selectedAgent.id).bg};"
                        >
                          <span>${selectedIdentity?.emoji || "🤖"}</span>
                        </div>
                      `}

                  <h3 class="agent-detail__name">
                    ${selectedIdentity?.name || selectedAgent.name || selectedAgent.id}
                  </h3>

                  <div class="agent-detail__id">${selectedAgent.id}</div>

                  ${selectedAgent.id === defaultId
                    ? html`<span class="agent-detail__badge">Default Agent</span>`
                    : nothing}

                  <div class="agent-detail__section">
                    <h4>Identity</h4>
                    <div class="agent-detail__info-row">
                      <span>Name:</span>
                      <span>${selectedIdentity?.name || "Not set"}</span>
                    </div>
                    <div class="agent-detail__info-row">
                      <span>Emoji:</span>
                      <span>${selectedIdentity?.emoji || "🤖"}</span>
                    </div>
                  </div>

                  <div class="agent-detail__section">
                    <h4>Configuration</h4>
                    <div class="agent-detail__info-row">
                      <span>Agent ID:</span>
                      <span class="agent-detail__code">${selectedAgent.id}</span>
                    </div>
                    <div class="agent-detail__info-row">
                      <span>Status:</span>
                      <span class="agent-detail__status active">Active</span>
                    </div>
                  </div>

                  <div class="agent-detail__actions">
                    <button class="agent-detail__btn primary" @click=${() => onLoadIdentity(selectedAgent.id)}>
                      ${icons.loader}
                      Refresh Identity
                    </button>
                  </div>
                </div>
              </div>
            `
          : html`
              <div class="agent-detail agent-detail--empty">
                <div class="agent-detail__placeholder">
                  ${icons.bot}
                  <p>Select an agent to view their profile</p>
                </div>
              </div>
            `}
      </div>
    </div>
  `;
}
