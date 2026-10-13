#!/bin/bash
cd /c/Users/ebima/Documents/GitHub/unified-article-app
git add analysis/llm-rollout-2026-10-12/claude/drive
git commit -q -m "Claude: DRIVE $1" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" 2>&1 | grep -v warning
git push -q origin main 2>&1 | grep -v warning | head -3
git log -1 --oneline
