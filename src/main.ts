import './styles.css';
import { roleDefinitions } from './data/access';
import { caseFiles } from './data/cases';
import { chatThreads } from './data/chats';
import { currentProfile } from './data/player';
import { evaluateAccess, findRoleDefinition, formatClearance } from './domain/access';
import type {
  AccessRule,
  CaseFile,
  CaseFragment,
  ChatMessage,
  FileReviewStatus,
  Permission,
  PlayerProfile,
  RoleId,
} from './domain/types';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

const root = app;
const profile = currentProfile;
let selectedFileId = caseFiles[0].id;
let selectedThreadId = chatThreads[0].id;

function getReviewLabel(status: FileReviewStatus): string {
  if (status === 'new') return '新档案';
  if (status === 'solved') return '已复核';
  if (status === 'sealed') return '封存';
  return '调查中';
}

function getStatusClass(file: CaseFile, player: PlayerProfile): string {
  const access = evaluateAccess(player, file.access);

  if (!access.allowed) return 'locked';
  return file.reviewStatus;
}

function getStatusLabel(file: CaseFile, player: PlayerProfile): string {
  const access = evaluateAccess(player, file.access);

  if (!access.allowed) return '需授权';
  return getReviewLabel(file.reviewStatus);
}

function getRoleName(roleId: RoleId): string {
  return findRoleDefinition(roleDefinitions, roleId)?.name ?? roleId;
}

function getPermissionLabel(permission: Permission): string {
  const labels: Record<Permission, string> = {
    'case:read': '读取档案',
    'case:read-redacted': '读取公开摘要',
    'case:read-restricted': '读取限制字段',
    'case:unlock': '解锁封存档案',
    'chat:read': '读取通信',
    'chat:message': '发送通信',
    'hint:view': '查看提示',
    'session:impersonate': '身份模拟',
  };

  return labels[permission];
}

function renderFileList(): string {
  return caseFiles
    .map((file) => {
      const selected = file.id === selectedFileId ? 'is-selected' : '';
      const statusClass = getStatusClass(file, profile);
      const access = evaluateAccess(profile, file.access);

      return `
        <button class="file-row ${selected}" type="button" data-file-id="${file.id}">
          <span class="file-row__code">${file.code}</span>
          <span class="file-row__main">
            <span class="file-row__title">${file.title}</span>
            <span class="file-row__meta">${file.unit}</span>
          </span>
          <span class="status-pill status-pill--${statusClass}">${getStatusLabel(file, profile)}</span>
          <span class="access-stub">${access.allowed ? file.classification : 'LOCK / ' + file.classification}</span>
        </button>
      `;
    })
    .join('');
}

function renderRoleSummary(): string {
  const activeRole = findRoleDefinition(roleDefinitions, profile.activeRole);
  const roleTags = profile.roles
    .map((roleId) => `<span class="role-tag">${getRoleName(roleId)}</span>`)
    .join('');

  return `
    <section class="session-card" aria-label="当前身份">
      <div>
        <p class="eyebrow">SESSION ROLE</p>
        <h2>${activeRole?.name ?? profile.activeRole}</h2>
      </div>
      <dl class="session-grid">
        <div>
          <dt>调查员</dt>
          <dd>${profile.displayName}</dd>
        </div>
        <div>
          <dt>权限级别</dt>
          <dd>${formatClearance(profile.clearanceLevel)}</dd>
        </div>
      </dl>
      <div class="role-stack">${roleTags}</div>
    </section>
  `;
}

function renderFragments(file: CaseFile): string {
  return file.fragments.map((fragment, index) => renderFragment(file, fragment, index)).join('');
}

function renderFragment(file: CaseFile, fragment: CaseFragment, index: number): string {
  const rule = fragment.access ?? file.access;
  const access = evaluateAccess(profile, rule);
  const body = access.allowed ? fragment.body : fragment.redactedText ?? '权限不足：该字段被遮蔽。';
  const redactedClass = access.allowed ? '' : 'is-redacted';

  return `
    <li class="${redactedClass}">
      <span class="fragment-index">${String(index + 1).padStart(2, '0')}</span>
      <span>
        <strong>${fragment.label}</strong>
        ${body}
      </span>
    </li>
  `;
}

function renderRequirementList(rule: AccessRule): string {
  const items: string[] = [];

  if (rule.minClearance !== undefined) {
    items.push(`最低权限 ${formatClearance(rule.minClearance)}`);
  }

  if (rule.anyRoles?.length) {
    items.push(`任一身份：${rule.anyRoles.map(getRoleName).join(' / ')}`);
  }

  if (rule.allRoles?.length) {
    items.push(`必须身份：${rule.allRoles.map(getRoleName).join(' + ')}`);
  }

  if (rule.permissions?.length) {
    items.push(`权限标记：${rule.permissions.map(getPermissionLabel).join(' / ')}`);
  }

  if (rule.discoveredFlags?.length) {
    items.push(`已发现线索：${rule.discoveredFlags.join(' / ')}`);
  }

  if (rule.solvedPuzzles?.length) {
    items.push(`已解谜题：${rule.solvedPuzzles.join(' / ')}`);
  }

  if (rule.note) {
    items.push(rule.note);
  }

  return `<ul class="access-list">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function renderRestrictedFile(file: CaseFile): string {
  return `
    <section class="record-panel" aria-label="当前档案">
      <header class="panel-header">
        <div>
          <p class="eyebrow">RESTRICTED FILE</p>
          <h2>${file.code} / ${file.title}</h2>
        </div>
        <div class="clearance-block clearance-block--denied">
          <span>要求</span>
          <strong>${file.classification}</strong>
        </div>
      </header>

      <div class="record-grid">
        <div class="field">
          <span>归档日期</span>
          <strong>${file.date}</strong>
        </div>
        <div class="field">
          <span>访问状态</span>
          <strong>需授权</strong>
        </div>
      </div>

      <div class="summary summary--restricted">
        <p>${file.teaser}</p>
      </div>

      <div class="access-panel">
        <p class="eyebrow">ACCESS RULE</p>
        <h3>当前身份无法读取完整档案</h3>
        ${renderRequirementList(file.access)}
      </div>

      <div class="clue-box">
        <span>当前提示</span>
        <p>${file.clue}</p>
      </div>
    </section>
  `;
}

function renderActiveFile(file: CaseFile): string {
  const access = evaluateAccess(profile, file.access);

  if (!access.allowed) {
    return renderRestrictedFile(file);
  }

  return `
    <section class="record-panel" aria-label="当前档案">
      <header class="panel-header">
        <div>
          <p class="eyebrow">ACTIVE FILE</p>
          <h2>${file.code} / ${file.title}</h2>
        </div>
        <div class="clearance-block">
          <span>分级</span>
          <strong>${file.classification}</strong>
        </div>
      </header>

      <div class="record-grid">
        <div class="field">
          <span>归档日期</span>
          <strong>${file.date}</strong>
        </div>
        <div class="field">
          <span>状态</span>
          <strong>${getReviewLabel(file.reviewStatus)}</strong>
        </div>
      </div>

      <p class="summary">${file.summary}</p>

      <div class="section-title">
        <span>碎片记录</span>
        <span>FRAGMENTS</span>
      </div>
      <ul class="fragments">
        ${renderFragments(file)}
      </ul>

      <div class="clue-box">
        <span>当前提示</span>
        <p>${file.clue}</p>
      </div>
    </section>
  `;
}

function renderChatMessage(message: ChatMessage): string {
  const access = evaluateAccess(profile, message.access);
  const text = access.allowed ? message.text : message.redactedText ?? '权限不足：消息被遮蔽。';
  const redactedClass = access.allowed ? '' : 'is-redacted';

  return `
    <article class="chat-message chat-message--${message.from} ${redactedClass}">
      <div class="chat-message__meta">
        <span>${message.speaker}</span>
        <time>${message.time}</time>
      </div>
      <p>${text}</p>
    </article>
  `;
}

function renderChat(): string {
  const thread = chatThreads.find((item) => item.id === selectedThreadId) ?? chatThreads[0];
  const threadAccess = evaluateAccess(profile, thread.access);

  if (!threadAccess.allowed) {
    return `
      <header class="panel-header panel-header--compact">
        <div>
          <p class="eyebrow">SECURE CHAT</p>
          <h2>${thread.title}</h2>
        </div>
      </header>
      <div class="access-panel access-panel--chat">
        <p class="eyebrow">CHANNEL LOCKED</p>
        <h3>当前身份无法读取通信</h3>
        ${renderRequirementList(thread.access)}
      </div>
    `;
  }

  return `
    <header class="panel-header panel-header--compact">
      <div>
        <p class="eyebrow">${thread.channel}</p>
        <h2>${thread.title}</h2>
      </div>
      <span class="online-dot" title="在线"></span>
    </header>
    <div class="chat-log">
      ${thread.messages.map(renderChatMessage).join('')}
    </div>
    <form class="chat-input">
      <input type="text" value="询问：沈医生的旧职位" aria-label="聊天输入" />
      <button type="button">发送</button>
    </form>
  `;
}

function renderTerminalLine(): string {
  const readableCount = caseFiles.filter((file) => evaluateAccess(profile, file.access).allowed).length;
  const solvedCount = caseFiles.filter((file) => file.reviewStatus === 'solved').length;
  return `SYS: ${caseFiles.length} FILES MOUNTED / ${readableCount} READABLE / ${solvedCount} VERIFIED / ROLE ${profile.activeRole.toUpperCase()}`;
}

function render(): void {
  const activeFile = caseFiles.find((file) => file.id === selectedFileId) ?? caseFiles[0];

  root.innerHTML = `
    <main class="archive-shell">
      <div class="scanlines" aria-hidden="true"></div>
      <header class="topbar">
        <div class="brand-block">
          <img class="brand-mark" src="./assets/bureau-seal.svg" alt="" />
          <div>
            <h1>黑箱档案局</h1>
            <p>Internal Archive Console / Demonstration Build</p>
          </div>
        </div>
        <div class="system-readout">
          <span>LOCAL</span>
          <strong>NODE-07</strong>
        </div>
      </header>

      <section class="workspace">
        <aside class="sidebar" aria-label="档案列表">
          <div class="panel-header panel-header--compact">
            <div>
              <p class="eyebrow">CASE INDEX</p>
              <h2>档案索引</h2>
            </div>
          </div>
          ${renderRoleSummary()}
          <div class="search-strip">
            <span>QUERY</span>
            <input type="text" value="北线 灯塔 匿名信 权限" aria-label="档案搜索" />
          </div>
          <nav class="file-list">
            ${renderFileList()}
          </nav>
        </aside>

        ${renderActiveFile(activeFile)}

        <aside class="chat-panel" aria-label="聊天线索">
          ${renderChat()}
        </aside>
      </section>

      <footer class="terminal-bar">
        <span>${renderTerminalLine()}</span>
        <span>F1 HINT / F2 NOTES / F3 MAP</span>
      </footer>
    </main>
  `;

  document.querySelectorAll<HTMLButtonElement>('[data-file-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedFileId = button.dataset.fileId ?? selectedFileId;
      render();
    });
  });
}

render();
