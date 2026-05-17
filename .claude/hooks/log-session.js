#!/usr/bin/env node
/**
 * .claude/hooks/log-session.js
 *
 * Auto-runs when Claude Code session ends (Stop hook).
 * Reads recent git activity and appends bug log entries to CLAUDE.md
 *
 * Setup:
 *   1. Place in .claude/hooks/log-session.js
 *   2. chmod +x .claude/hooks/log-session.js (or use node directly)
 *   3. .claude/settings.json points "Stop" hook to this file
 *
 * What it does:
 *   - Reads last commit message
 *   - If commit is a fix/feat → adds entry to CLAUDE.md BUG LOG
 *   - Also appends to AGENTS.md session log
 *   - Updates CHANGELOG.md with version bump
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = process.cwd();
const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');
const AGENTS_MD = path.join(REPO_ROOT, 'AGENTS.md');
const CHANGELOG_MD = path.join(REPO_ROOT, 'CHANGELOG.md');
const FIX_PATTERNS_MD = path.join(REPO_ROOT, 'FIX_PATTERNS.md');

function getLastCommit() {
  try {
    const msg = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim();
    const hash = execSync('git log -1 --pretty=%h', { encoding: 'utf-8' }).trim();
    const filesChanged = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    return { msg, hash, filesChanged };
  } catch {
    return null;
  }
}

function extractVersion(msg) {
  const match = msg.match(/\[v(\d+\.\d+\.\d+)\]/);
  return match ? match[1] : null;
}

function extractType(msg) {
  const match = msg.match(/^(feat|fix|docs|test|refactor|chore|ci):/);
  return match ? match[1] : 'chore';
}

function appendBugLogEntry(commit) {
  if (!fs.existsSync(CLAUDE_MD)) return;

  const type = extractType(commit.msg);
  if (type !== 'fix' && type !== 'feat') return; // only log bugs/features

  const version = extractVersion(commit.msg) || 'unreleased';
  const cleanMsg = commit.msg.replace(/\[v\d+\.\d+\.\d+\]/, '').trim();
  const date = new Date().toISOString().split('T')[0];

  // Get next BUG number
  const content = fs.readFileSync(CLAUDE_MD, 'utf-8');
  const bugNumbers = [...content.matchAll(/BUG-(\d{3})/g)].map(m => parseInt(m[1]));
  const nextBug = bugNumbers.length ? Math.max(...bugNumbers) + 1 : 14;
  const bugId = `BUG-${String(nextBug).padStart(3, '0')}`;

  const entry = `

## [${date}] ${bugId} — ${cleanMsg}
**Commit:** ${commit.hash}
**Type:** ${type}
**Files:** ${commit.filesChanged.slice(0, 5).join(', ')}${commit.filesChanged.length > 5 ? '...' : ''}
**Version:** v${version}
**Auto-logged:** by Claude Code Stop hook
`;

  // Insert AFTER the comment marker "Claude Code: prepend new bug entries below this line"
  const marker = '<!-- Claude Code: prepend new bug entries below this line -->';
  if (content.includes(marker)) {
    const updated = content.replace(marker, marker + entry);
    fs.writeFileSync(CLAUDE_MD, updated);
    console.log(`✅ Logged ${bugId} to CLAUDE.md`);
  }
}

function appendAgentsLog(commit) {
  if (!fs.existsSync(AGENTS_MD)) return;

  const date = new Date().toISOString().split('T')[0];
  const entry = `

### Auto-log: ${date} — ${commit.msg}
- Commit: \`${commit.hash}\`
- Files: ${commit.filesChanged.length} changed
- Logged by: Claude Code Stop hook
`;

  const content = fs.readFileSync(AGENTS_MD, 'utf-8');
  // Append at end of "Session Log" section
  if (content.includes('## Session Log')) {
    const updated = content + entry;
    fs.writeFileSync(AGENTS_MD, updated);
    console.log('✅ Appended to AGENTS.md');
  }
}

function updateChangelog(commit) {
  if (!fs.existsSync(CHANGELOG_MD)) return;

  const version = extractVersion(commit.msg);
  if (!version) return; // skip if no version tag

  const date = new Date().toISOString().split('T')[0];
  const type = extractType(commit.msg);
  const cleanMsg = commit.msg.replace(/\[v\d+\.\d+\.\d+\]/, '').replace(/^(fix|feat|docs|test|refactor|chore|ci):/, '').trim();

  const sectionMap = {
    fix: '### Fixed',
    feat: '### Added',
    docs: '### Docs',
    refactor: '### Changed',
    test: '### Tests',
    chore: '### Chore',
    ci: '### CI',
  };

  const section = sectionMap[type] || '### Changed';
  const entry = `\n## [${version}] — ${date}\n${section}\n- ${cleanMsg}\n`;

  const content = fs.readFileSync(CHANGELOG_MD, 'utf-8');
  // Insert after first --- line (after header)
  const splitIdx = content.indexOf('---');
  if (splitIdx > 0) {
    const updated = content.slice(0, splitIdx + 3) + entry + content.slice(splitIdx + 3);
    fs.writeFileSync(CHANGELOG_MD, updated);
    console.log(`✅ Added v${version} to CHANGELOG.md`);
  }
}

// MAIN
const commit = getLastCommit();
if (commit) {
  console.log(`🔍 Last commit: ${commit.hash} — ${commit.msg}`);
  appendBugLogEntry(commit);
  appendAgentsLog(commit);
  updateChangelog(commit);
} else {
  console.log('⚠ No git history found - skipping auto-log');
}
