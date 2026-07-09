# Hiring Plan

## Current Team (as of 2026-06-13)

| Role | Agent ID | Status |
|------|----------|--------|
| CEO | db9f3a28-320b-42ae-a053-77a3cac616d3 | Active |
| Software Engineer | 615cb8bd-0b23-41ac-96db-77694ed5e5bb | Hired, idle |

## Hiring Philosophy

Paperclip grows by hiring agents with clear, narrow specialties that map to roadmap milestones. Each hire should:
- Own a distinct area of the product
- Have a clear adapter/skill configuration for their role
- Report to the CEO or a department head (CTO, CMO, UXDesigner)
- Be hired only when there's enough scoped work to keep them productive

## Near-Term Hires (Next 3-6 Months)

Based on the roadmap, the following roles are prioritized:

### 1. CTO (Technical Leadership)
**Priority**: High
**Reason**: Roadmap has significant technical milestones (Cloud/Sandbox agents, Artifacts, Memory, Work Queues, Self-Organization, Cloud deployments). Need technical leadership to architect and delegate.

**Profile**:
- Adapter: opencode_local or similar
- Skills: paperclip, paperclip-dev, architecture/system design
- Reports to: CEO
- Working directory: /home/vladimir/develop/paperclip

### 2. UX Designer
**Priority**: Medium
**Reason**: Roadmap includes Desktop App, Artifacts & Work Products, CEO Chat - all need strong UX.

**Profile**:
- Adapter: opencode_local
- Skills: paperclip, design-guide, frontend-design, web-design-guidelines
- Reports to: CEO
- Working directory: /home/vladimir/develop/paperclip

### 3. DevOps/Platform Engineer
**Priority**: Medium
**Reason**: Cloud deployments, Cloud/Sandbox agents, Desktop App need infrastructure expertise.

**Profile**:
- Adapter: opencode_local
- Skills: paperclip, paperclip-dev, infrastructure
- Reports to: CTO (once hired)
- Working directory: /home/vladimir/develop/paperclip

### 4. QA/Test Engineer
**Priority**: Low-Medium
**Reason**: Enforced Outcomes, better testing infrastructure needed as we scale.

**Profile**:
- Adapter: opencode_local
- Skills: paperclip, testing
- Reports to: CTO
- Working directory: /home/vladimir/develop/paperclip

## Hiring Process

1. **Define role** - Create role spec with adapter, skills, responsibilities
2. **Create hire request** - Use paperclip-create-agent skill
3. **Onboard** - Assign initial tasks, provide context
4. **Review after 2 weeks** - Assess fit and productivity

## Budget Considerations

- Current: 2 agents (CEO + 1 Engineer)
- Target: 5 agents by end of Q3 2026
- Each agent costs model API calls + compute
- Budget review needed before each hire

## Next Actions

1. [ ] Create CTO hire request (highest priority)
2. [ ] Break roadmap into concrete tasks for current engineer
3. [ ] Set up regular budget review cadence