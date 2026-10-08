#!/usr/bin/env bash
# auto-merge-approved.sh
# Checks PRs opened by openclaw-claude[bot] in openclawai/openclaw,
# detects human approval, comments, and merges if safe.
#
# Requirements: gh CLI authenticated, jq
# Usage: ./scripts/auto-merge-approved.sh [--dry-run]

set -euo pipefail

REPO="openclawai/openclaw"
BOT_USER="openclaw-claude[bot]"
DRY_RUN=false
COMMENT_BODY="✅ Approved by a human reviewer. Auto-merging."

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] Would comment and merge qualifying PRs."
fi

# Fetch open PRs by the bot user
prs_json=$(gh pr list \
  --repo "$REPO" \
  --author "$BOT_USER" \
  --state open \
  --json number,title,reviewDecision,mergeable,headRefOid,url \
  --limit 100)

count=$(echo "$prs_json" | jq 'length')
echo "Found $count open PR(s) by $BOT_USER in $REPO."

if [[ "$count" -eq 0 ]]; then
  echo "Nothing to do."
  exit 0
fi

merged=0
skipped=0

echo "$prs_json" | jq -c '.[]' | while read -r pr; do
  number=$(echo "$pr" | jq -r '.number')
  title=$(echo "$pr" | jq -r '.title')
  review_decision=$(echo "$pr" | jq -r '.reviewDecision')
  mergeable=$(echo "$pr" | jq -r '.mergeable')
  url=$(echo "$pr" | jq -r '.url')

  echo ""
  echo "--- PR #$number: $title ---"
  echo "    reviewDecision: $review_decision"
  echo "    mergeable:      $mergeable"

  # Only act on PRs that have been approved
  if [[ "$review_decision" != "APPROVED" ]]; then
    echo "    -> Skipped (not approved yet)."
    skipped=$((skipped + 1))
    continue
  fi

  # Check mergeability — refuse if there are conflicts
  if [[ "$mergeable" == "CONFLICTING" ]]; then
    echo "    -> Skipped (merge conflicts). Resolve conflicts first."
    skipped=$((skipped + 1))
    continue
  fi

  if [[ "$mergeable" == "UNKNOWN" ]]; then
    echo "    -> Skipped (mergeability unknown — GitHub hasn't computed it yet). Try again shortly."
    skipped=$((skipped + 1))
    continue
  fi

  echo "    -> Qualifies for auto-merge."

  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] Would comment and merge PR #$number."
    merged=$((merged + 1))
    continue
  fi

  # Post a comment
  echo "    Posting comment..."
  gh pr comment "$number" \
    --repo "$REPO" \
    --body "$COMMENT_BODY"

  # Attempt to merge (squash by default; change flag if needed)
  echo "    Merging (squash)..."
  if gh pr merge "$number" \
    --repo "$REPO" \
    --squash \
    --auto \
    --delete-branch; then
    echo "    -> Merge queued for PR #$number."
    merged=$((merged + 1))
  else
    echo "    -> Merge command failed for PR #$number. Check manually."
    skipped=$((skipped + 1))
  fi
done

echo ""
echo "Done. Qualifying PRs merged/queued: $merged | Skipped: $skipped"
