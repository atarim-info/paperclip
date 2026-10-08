---
name: ticket-triage
description: Classify incoming support tickets, assign priority levels based on customer impact, and draft empathetic troubleshooting responses.
key: paperclipai/optional/support/ticket-triage
recommendedForRoles:
  - support
  - engineer
  - pm
tags:
  - support
  - triage
  - tickets
  - customer-service
---

# Ticket Triage

Systematically process support requests to ensure rapid response times, accurate prioritization, and clear customer communication.

## When to use

- Triage incoming bug reports, support tickets, and customer inquiries.
- Categorizing issues by subsystem, severity, and impact.
- Drafting initial customer replies or escalation notes for engineering.

## When not to use

- Writing code fixes or deploying production patches.
- Outbound sales or marketing campaigns.

## Workflow

1. **Categorize & Label**: Identify the affected feature area, error type, and reproducibility.
2. **Impact Assessment**: Determine severity (P0 outage, P1 major degradation, P2 minor bug/question) based on user impact.
3. **Draft Response**: Write a clear, empathetic response acknowledging the issue, requesting missing reproduction details, or providing immediate workarounds.
4. **Escalation**: If engineering intervention is required, link the ticket to the appropriate engineering issue with reproduction steps.
