#!/bin/bash

# Git secrets check script for lefthook
# Adapted from: https://raw.githubusercontent.com/VeloraDEX/paraswap-dex-lib/dfa1783dc8bc58e294fe3b40a2dcb8931c7ced9f/.husky/pre-commit

if ! command -v git-secrets &> /dev/null; then
  echo "❌ git-secrets is not installed. Please run 'brew install git-secrets' or visit https://github.com/awslabs/git-secrets#installing-git-secrets"
  exit 1
fi

HOOK_FLAG=".git-secrets-installed"

if [[ ! -f "$HOOK_FLAG" ]]; then
  echo "🔧 Setting up git-secrets patterns..."
  git-secrets --register-aws > /dev/null
  git secrets --add -- 'ghp_[A-Za-z0-9_]{36}'
  git secrets --add -- 'github_pat_[A-Za-z0-9_]{36}'
  git secrets --add -- 'xox[apb]-[0-9]{12}-[0-9]{12}-[A-Za-z0-9]{24}'
  git secrets --add -- 'sk_live_[A-Za-z0-9]{24}'
  git secrets --add -- 'pk_live_[A-Za-z0-9]{24}'
  git secrets --add -- 'AIza[0-9A-Za-z_-]{35}'
  git secrets --add -- '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  git secrets --add -- '[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
  git secrets --add -- 'postgres:\/\/[A-Za-z0-9@:\-_.\/?%=+]+'
  git secrets --add -- 'BEGIN'
  touch "$HOOK_FLAG"
  echo "✅ Git secrets patterns configured"
fi

# Check if parameters were passed
if [ $# -eq 0 ]; then
  echo "🔍 Running git-secrets scan in staged files mode..."
  # No parameters - scan staged files and exclude the script itself and deleted files
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -v "scripts/git-secrets-check.sh" | tr '\n' ' ')
  
  if [ -z "$STAGED_FILES" ]; then
    echo "✅ No staged files to scan"
    exit 0
  fi
  
  # Filter out deleted files (files that don't exist on disk)
  EXISTING_FILES=""
  for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
      EXISTING_FILES="$EXISTING_FILES $file"
    fi
  done
  
  # Remove leading space and check if any files remain
  EXISTING_FILES=$(echo "$EXISTING_FILES" | sed 's/^ *//')
  
  if [ -z "$EXISTING_FILES" ]; then
    echo "✅ No existing staged files to scan (all staged files are deletions)"
    exit 0
  fi
  
  echo "📁 Scanning staged files: $EXISTING_FILES"
  # Scan only the existing staged files
  git-secrets --scan $EXISTING_FILES
else
  echo "🔍 Running git-secrets scan in manual mode..."
  # Filter out the script itself from the provided files (match on filename only)
  FILTERED_FILES=""
  for file in "$@"; do
    if [[ "$(basename "$file")" != "git-secrets-check.sh" ]]; then
      FILTERED_FILES="$FILTERED_FILES $file"
    fi
  done
  FILTERED_FILES=$(echo "$FILTERED_FILES" | sed 's/^ *//')
  
  if [ -z "$FILTERED_FILES" ]; then
    echo "✅ No files to scan after filtering"
    exit 0
  fi
  
  echo "📁 Scanning specified files: $FILTERED_FILES"
  # Parameters provided - use them directly (excluding this script)
  git-secrets --scan $FILTERED_FILES
fi

if [ $? -eq 0 ]; then
  echo "✅ No secrets found in staged files"
else
  echo "❌ Secrets detected! Please remove them before pushing."
  exit 1
fi
