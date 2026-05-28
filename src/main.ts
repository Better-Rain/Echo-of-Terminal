import './styles.css';
import { roleDefinitions } from './data/access';
import { caseFiles } from './data/cases';
import { chatThreads } from './data/chats';
import { virtualDirectories, virtualDocuments, virtualVolumes } from './data/fileSystem';
import { loginStage } from './data/loginStage';
import { currentProfile } from './data/player';
import { evaluateAccess, findRoleDefinition, formatClearance } from './domain/access';
import type {
  AccessRule,
  CaseFile,
  CaseFragment,
  ChatMessage,
  FileReviewStatus,
  LoginStageConfig,
  Permission,
  PlayerProfile,
  RoleId,
  TerminalLine,
  VirtualDirectory,
  VirtualDocument,
  VirtualVolume,
} from './domain/types';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

const root = app;
const profile = currentProfile;
type MountStage = 'scanning' | 'local-mounted' | 'external-mounted';
type UnixAppId = 'dashboard' | 'records' | 'shortwave' | 'communications' | 'clock';

type UnixAppMeta = {
  id: Exclude<UnixAppId, 'dashboard'>;
  label: string;
  command: string;
  status: string;
  access: string;
};

const unixApps: UnixAppMeta[] = [
  {
    id: 'records',
    label: '档案索引',
    command: 'case-index',
    status: 'READ ONLY',
    access: '/var/archive/case',
  },
  {
    id: 'shortwave',
    label: '短波接收器',
    command: 'rx-shortwave',
    status: 'MONITOR',
    access: '/dev/radio0',
  },
  {
    id: 'communications',
    label: '通信软件',
    command: 'secure-comm',
    status: 'MIRROR',
    access: '/var/spool/comm',
  },
  {
    id: 'clock',
    label: '时钟',
    command: 'clockctl',
    status: 'DRIFT',
    access: '/etc/localtime',
  },
];

const localMountDelayMs = 900;
const externalMountDelayMs = 2400;

let selectedFileId = caseFiles[0].id;
let selectedThreadId = chatThreads[0].id;
let appView: 'boot' | 'login' | 'authenticating' | 'archive' = 'boot';
let workspaceView: 'files' | 'records' = 'files';
let activeUnixAppId: UnixAppId = 'dashboard';
let mountStage: MountStage = 'scanning';
let selectedDirectoryId = 'local-root';
let selectedDocumentId = '';
let showUsbNotice = false;
let mountSequenceScheduled = false;
let loginError = '';

function startBootSequence(): void {
  render();

  window.setTimeout(() => {
    if (appView !== 'boot') return;
    appView = 'login';
    render();
  }, loginStage.scanDurationMs);
}

function enterArchiveShell(): void {
  appView = 'archive';
  workspaceView = 'files';
  activeUnixAppId = 'dashboard';
  mountStage = 'scanning';
  selectedDirectoryId = 'local-root';
  selectedDocumentId = '';
  showUsbNotice = false;
  render();
  scheduleMountSequence();
}

function scheduleMountSequence(): void {
  if (mountSequenceScheduled) return;

  mountSequenceScheduled = true;

  window.setTimeout(() => {
    if (appView !== 'archive') return;
    mountStage = 'local-mounted';
    render();
  }, localMountDelayMs);

  window.setTimeout(() => {
    if (appView !== 'archive') return;
    mountStage = 'external-mounted';
    showUsbNotice = true;
    render();
  }, externalMountDelayMs);
}

function openUsbDirectory(): void {
  if (mountStage !== 'external-mounted') return;

  workspaceView = 'files';
  selectedDirectoryId = 'usb-root';
  selectedDocumentId = '';
  showUsbNotice = false;
  render();
}

function renderTerminalLineItem(line: TerminalLine, index: number): string {
  const tone = line.tone ?? 'normal';

  return `
    <li class="boot-line boot-line--${tone}" style="--delay: ${index * 430}ms">
      <span>[${line.tag}]</span>
      <strong>${line.text}</strong>
    </li>
  `;
}

function renderBootScreen(config: LoginStageConfig): string {
  return `
    <main class="login-shell login-shell--boot">
      <div class="scanlines" aria-hidden="true"></div>
      <section class="boot-console" aria-label="系统自检">
        <div class="boot-console__header">
          <span>BOOT / LOCAL CACHE MODE</span>
          <span>NODE-07</span>
        </div>
        <ul class="boot-lines">
          ${config.scanLines.map(renderTerminalLineItem).join('')}
        </ul>
        <div class="boot-progress" aria-hidden="true">
          <span></span>
        </div>
      </section>
    </main>
  `;
}

function renderAvatar(config: LoginStageConfig): string {
  if (config.avatarSrc) {
    return `<img src="${config.avatarSrc}" alt="${config.avatarAlt}" />`;
  }

  return `
    <div class="avatar-placeholder">
      <span>NO IMAGE</span>
      <strong>${config.avatarPlaceholder}</strong>
    </div>
  `;
}

function renderLoginScreen(config: LoginStageConfig): string {
  return `
    <main class="login-shell">
      <div class="scanlines" aria-hidden="true"></div>
      <section class="login-card" aria-label="系统登录">
        <header class="login-card__header">
          <div>
            <p class="eyebrow">ARCHIVE ACCESS</p>
            <h1>黑箱档案局</h1>
          </div>
          <span>AUTH-GATE 01</span>
        </header>

        <div class="login-card__body">
          <aside class="avatar-panel" aria-label="头像区域">
            ${renderAvatar(config)}
          </aside>

          <form class="login-form" id="loginForm">
            <label class="login-field">
              <span>用户名</span>
              <input type="text" value="${config.username}" readonly aria-readonly="true" />
            </label>
            <p class="login-hint">${config.usernameHint}</p>

            <div class="last-login">
              <span class="warning-icon" title="${config.lastLoginTooltip}" aria-label="${config.lastLoginTooltip}">!</span>
              <span>${config.lastLogin}</span>
            </div>

            <label class="login-field">
              <span>${config.passwordLabel}</span>
              <input id="passwordInput" name="password" type="password" autocomplete="off" autofocus />
            </label>
            <p class="security-question">${config.securityQuestion}</p>
            ${loginError ? `<p class="login-error">${loginError}</p>` : ''}

            <button class="login-submit" type="submit">验证身份</button>
          </form>
        </div>

        <footer class="login-card__footer">
          <span>TIME SERVICE: FAILED</span>
          <span>STORAGE: HISTORICAL RECORDS FOUND</span>
        </footer>
      </section>
    </main>
  `;
}

function renderAuthFeedback(config: LoginStageConfig): string {
  return `
    <main class="login-shell login-shell--auth">
      <div class="scanlines" aria-hidden="true"></div>
      <section class="auth-console" aria-label="身份验证结果">
        <div class="boot-console__header">
          <span>AUTHENTICATION</span>
          <span>READ ONLY</span>
        </div>
        <ul class="boot-lines boot-lines--auth">
          ${config.successLines.map(renderTerminalLineItem).join('')}
        </ul>
      </section>
    </main>
  `;
}

function bindLoginForm(): void {
  const form = document.querySelector<HTMLFormElement>('#loginForm');
  const input = document.querySelector<HTMLInputElement>('#passwordInput');

  input?.focus();

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const password = String(formData.get('password') ?? '').trim();

    if (!loginStage.acceptedPasswords.includes(password)) {
      loginError = loginStage.failureMessage;
      render();
      return;
    }

    loginError = '';
    appView = 'authenticating';
    render();

    window.setTimeout(() => {
      if (appView !== 'authenticating') return;
      enterArchiveShell();
    }, loginStage.successDurationMs);
  });
}

function getReviewLabel(status: FileReviewStatus): string {
  if (status === 'new') return '新增';
  if (status === 'solved') return '已校验';
  if (status === 'sealed') return '受限';
  return '可读取';
}

function getStatusClass(file: CaseFile, player: PlayerProfile): string {
  const access = evaluateAccess(player, file.access);

  if (!access.allowed) return 'locked';
  return file.reviewStatus;
}

function getStatusLabel(file: CaseFile, player: PlayerProfile): string {
  const access = evaluateAccess(player, file.access);

  if (!access.allowed) return '授权不足';
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
    'case:unlock': '解除访问限制',
    'chat:read': '读取通信',
    'chat:message': '发送通信',
    'hint:view': '读取内部备注',
    'session:impersonate': '身份模拟',
  };

  return labels[permission];
}

function getVisibleVolumes(): VirtualVolume[] {
  if (mountStage === 'scanning') return [];

  return virtualVolumes.filter((volume) => {
    if (volume.id === 'local-cache') return true;
    return mountStage === 'external-mounted';
  });
}

function isVolumeVisible(volumeId: string): boolean {
  return getVisibleVolumes().some((volume) => volume.id === volumeId);
}

function getDirectory(directoryId: string | undefined): VirtualDirectory | undefined {
  return virtualDirectories.find((item) => item.id === directoryId);
}

function getSelectedDirectory(): VirtualDirectory | undefined {
  const directory = getDirectory(selectedDirectoryId);

  if (directory && isVolumeVisible(directory.volumeId)) return directory;

  const fallbackDirectory = getDirectory('local-root');
  if (fallbackDirectory && isVolumeVisible(fallbackDirectory.volumeId)) return fallbackDirectory;

  return undefined;
}

function getSelectedDocument(directory: VirtualDirectory): VirtualDocument | undefined {
  if (!selectedDocumentId) return undefined;

  return virtualDocuments.find(
    (document) => document.id === selectedDocumentId && document.directoryId === directory.id,
  );
}

function getChildDirectories(directory: VirtualDirectory): VirtualDirectory[] {
  return directory.directoryIds
    .map((directoryId) => getDirectory(directoryId))
    .filter((item): item is VirtualDirectory => Boolean(item));
}

function getDirectoryDocuments(directory: VirtualDirectory): VirtualDocument[] {
  return directory.fileIds
    .map((fileId) => virtualDocuments.find((document) => document.id === fileId))
    .filter((document): document is VirtualDocument => Boolean(document));
}

function getVolume(volumeId: string): VirtualVolume {
  return virtualVolumes.find((volume) => volume.id === volumeId) ?? virtualVolumes[0];
}

function renderWorkspaceSwitcher(): string {
  return `
    <nav class="workspace-switcher" aria-label="工作区切换">
      <button class="${workspaceView === 'files' ? 'is-active' : ''}" type="button" data-workspace-view="files">
        文件管理器
      </button>
      <button class="${workspaceView === 'records' ? 'is-active' : ''}" type="button" data-workspace-view="records">
        档案记录
      </button>
    </nav>
  `;
}

function renderStorageTree(): string {
  const visibleVolumes = getVisibleVolumes();
  const activeDirectory = getDirectory(selectedDirectoryId);
  const pendingExternalMarkup =
    mountStage === 'local-mounted'
      ? renderMountStatus(
          'BUS WATCH',
          '外部接口空闲',
          '等待新接入的存储介质完成只读握手。',
        )
      : '';

  if (!visibleVolumes.length) {
    return renderMountStatus('MOUNT SCAN', '正在枚举本地存储', '读取会话缓存索引，尚未建立可见挂载点。');
  }

  const volumeRows = visibleVolumes
    .map((volume) => {
      const selected = activeDirectory?.volumeId === volume.id ? 'is-selected' : '';

      return `
        <button class="storage-row ${selected}" type="button" data-directory-id="${volume.rootDirectoryId}">
          <span class="storage-row__icon">${volume.status === 'detected' ? 'USB' : 'DSK'}</span>
          <span class="storage-row__main">
            <span class="storage-row__label">${volume.label}</span>
            <span class="storage-row__device">${volume.deviceName}</span>
          </span>
          <span class="storage-row__path">${volume.mountPath}</span>
        </button>
      `;
    })
    .join('');

  return volumeRows + pendingExternalMarkup;
}

function renderMountStatus(label: string, title: string, message: string): string {
  return `
    <div class="mount-status">
      <p class="eyebrow">${label}</p>
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;
}

function renderDirectoryRow(directory: VirtualDirectory, icon = 'DIR'): string {
  const directoryCount = directory.directoryIds.length;
  const fileCount = directory.fileIds.length;

  return `
    <button class="document-row document-row--directory" type="button" data-directory-id="${directory.id}">
      <span class="document-row__icon">${icon}</span>
      <span class="document-row__main">
        <span class="document-row__name">${directory.name}</span>
      </span>
      <span class="document-row__meta">${directoryCount} DIR / ${fileCount} FILE</span>
    </button>
  `;
}

function renderParentDirectoryRow(directory: VirtualDirectory): string {
  const parentDirectory = getDirectory(directory.parentId);
  if (!parentDirectory) return '';

  return `
    <button class="document-row document-row--directory document-row--parent" type="button" data-directory-id="${parentDirectory.id}">
      <span class="document-row__icon">..</span>
      <span class="document-row__main">
        <span class="document-row__name">返回上级目录</span>
      </span>
      <span class="document-row__meta">DIR</span>
    </button>
  `;
}

function renderDirectoryList(directory: VirtualDirectory): string {
  const directoryRows = getChildDirectories(directory).map((childDirectory) => renderDirectoryRow(childDirectory)).join('');
  const documentRows = getDirectoryDocuments(directory)
    .map((document) => {
      const selected = document.id === selectedDocumentId ? 'is-selected' : '';

      return `
        <button class="document-row ${selected}" type="button" data-document-id="${document.id}">
          <span class="document-row__icon">${document.extension}</span>
          <span class="document-row__main">
            <span class="document-row__name">${document.name}.${document.extension}</span>
          </span>
          <span class="document-row__meta">${document.sizeLabel}</span>
        </button>
      `;
    })
    .join('');
  const rows = renderParentDirectoryRow(directory) + directoryRows + documentRows;

  if (rows) return rows;

  return renderMountStatus('EMPTY DIRECTORY', '没有可见项目', '该目录当前没有可读文件或下级目录。');
}

function renderDocumentPreview(document: VirtualDocument | undefined): string {
  if (!document) {
    return `
      <section class="document-panel" aria-label="文档预览">
        <header class="panel-header">
          <div>
            <p class="eyebrow">PREVIEW</p>
            <h2>等待文件打开</h2>
          </div>
        </header>
        <article class="document-body document-body--empty">
          <p>当前没有打开的只读文档。请从目录列表中选择文件。</p>
        </article>
      </section>
    `;
  }

  return `
    <section class="document-panel" aria-label="文档预览">
      <header class="panel-header">
        <div>
          <p class="eyebrow">DOCUMENT</p>
          <h2>${document.name}.${document.extension}</h2>
        </div>
      </header>
      <div class="record-grid">
        <div class="field">
          <span>修改时间</span>
          <strong>${document.modified}</strong>
        </div>
        <div class="field">
          <span>大小</span>
          <strong>${document.sizeLabel}</strong>
        </div>
      </div>
      <article class="document-body">
        ${document.body.map((paragraph) => `<p>${paragraph}</p>`).join('')}
      </article>
      <div class="document-tags">
        ${document.tags.map((tag) => `<span>${tag}</span>`).join('')}
      </div>
    </section>
  `;
}

function renderFileManagerWorkspace(): string {
  const directory = getSelectedDirectory();
  const selectedDocument = directory ? getSelectedDocument(directory) : undefined;
  const volume = directory ? getVolume(directory.volumeId) : undefined;

  if (!directory || !volume) {
    return `
      <section class="workspace workspace--files">
        <aside class="storage-panel" aria-label="存储介质">
          <header class="panel-header panel-header--compact">
            <div>
              <p class="eyebrow">MOUNTS</p>
              <h2>存储介质</h2>
            </div>
          </header>
          <div class="storage-list">
            ${renderStorageTree()}
          </div>
        </aside>

        <section class="directory-panel" aria-label="目录内容">
          <header class="panel-header">
            <div>
              <p class="eyebrow">CACHE BUS</p>
              <h2>等待挂载</h2>
            </div>
          </header>
          <div class="directory-meta">
            <span>本地缓存索引尚未完成读取。</span>
            <span>0 FILES</span>
          </div>
          <div class="document-list">
            ${renderMountStatus('READING', '索引建立中', '文件列表会在本地存储完成挂载后显示。')}
          </div>
        </section>

        ${renderDocumentPreview(undefined)}
      </section>
    `;
  }

  return `
    <section class="workspace workspace--files">
      <aside class="storage-panel" aria-label="存储介质">
        <header class="panel-header panel-header--compact">
          <div>
            <p class="eyebrow">MOUNTS</p>
            <h2>存储介质</h2>
          </div>
        </header>
        <div class="storage-list">
          ${renderStorageTree()}
        </div>
      </aside>

      <section class="directory-panel" aria-label="目录内容">
        <header class="panel-header">
          <div>
            <p class="eyebrow">${volume.deviceName}</p>
            <h2>${directory.path}</h2>
          </div>
        </header>
        <div class="directory-meta">
          <span>${volume.description}</span>
          <span>${directory.directoryIds.length} DIRS / ${directory.fileIds.length} FILES</span>
        </div>
        <div class="document-list">
          ${renderDirectoryList(directory)}
        </div>
      </section>

      ${renderDocumentPreview(selectedDocument)}
    </section>
  `;
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
    <section class="session-card" aria-label="会话身份">
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
    items.push(`已通过校验：${rule.solvedPuzzles.join(' / ')}`);
  }

  if (rule.note) {
    items.push(rule.note);
  }

  return `<ul class="access-list">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function renderRestrictedFile(file: CaseFile): string {
  return `
    <section class="record-panel" aria-label="档案记录">
      <header class="panel-header">
        <div>
          <p class="eyebrow">ACCESS RESTRICTED</p>
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
          <span>访问结果</span>
          <strong>授权不足</strong>
        </div>
      </div>

      <div class="summary summary--restricted">
        <p>${file.teaser}</p>
      </div>

      <div class="access-panel">
        <p class="eyebrow">ACCESS RULE</p>
        <h3>凭据不满足读取条件</h3>
        ${renderRequirementList(file.access)}
      </div>

      <div class="operator-note">
        <span>内部备注</span>
        <p>${file.internalNote}</p>
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
    <section class="record-panel" aria-label="档案记录">
      <header class="panel-header">
        <div>
          <p class="eyebrow">RECORD</p>
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
          <span>记录状态</span>
          <strong>${getReviewLabel(file.reviewStatus)}</strong>
        </div>
      </div>

      <p class="summary">${file.summary}</p>

      <div class="section-title">
        <span>记录条目</span>
        <span>ENTRIES</span>
      </div>
      <ul class="fragments">
        ${renderFragments(file)}
      </ul>

      <div class="operator-note">
        <span>内部备注</span>
        <p>${file.internalNote}</p>
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
  const canSendMessage = profile.permissions.includes('chat:message');

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
        <h3>凭据不满足信道读取条件</h3>
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
    ${
      canSendMessage
        ? `<form class="chat-input">
            <input type="text" value="询问：沈医生的旧职位" aria-label="聊天输入" />
            <button type="button">发送</button>
          </form>`
        : `<div class="chat-readonly">只读镜像：当前账号不具备写入信道权限。</div>`
    }
  `;
}

function renderUnixDock(): string {
  const appButtons = unixApps
    .map(
      (unixApp) => `
        <button class="unix-dock__item ${activeUnixAppId === unixApp.id ? 'is-active' : ''}" type="button" data-unix-app="${unixApp.id}">
          <span>${unixApp.command}</span>
          <strong>${unixApp.label}</strong>
        </button>
      `,
    )
    .join('');

  return `
    <aside class="unix-dock" aria-label="应用列表">
      <button class="unix-dock__item ${activeUnixAppId === 'dashboard' ? 'is-active' : ''}" type="button" data-unix-app="dashboard">
        <span>desk</span>
        <strong>应用看板</strong>
      </button>
      ${appButtons}
    </aside>
  `;
}

function renderUnixDashboard(): string {
  const appCards = unixApps
    .map(
      (unixApp) => `
        <button class="unix-app-card" type="button" data-unix-app="${unixApp.id}">
          <span class="unix-app-card__cmd">${unixApp.command}</span>
          <strong>${unixApp.label}</strong>
          <span>${unixApp.access}</span>
          <em>${unixApp.status}</em>
        </button>
      `,
    )
    .join('');

  return `
    <div class="unix-dashboard">
      <section class="unix-panel unix-panel--apps">
        <header class="unix-panel__header">
          <span>/usr/local/bin</span>
          <strong>APPLICATIONS</strong>
        </header>
        <div class="unix-app-grid">
          ${appCards}
        </div>
      </section>

      <section class="unix-panel">
        <header class="unix-panel__header">
          <span>ps -a</span>
          <strong>PROCESS</strong>
        </header>
        <div class="unix-process-list">
          <span>0719</span><strong>case-index</strong><em>idle</em>
          <span>0720</span><strong>secure-comm</strong><em>mirror</em>
          <span>0721</span><strong>rx-shortwave</strong><em>standby</em>
          <span>0722</span><strong>clockctl</strong><em>drift</em>
        </div>
      </section>

      <section class="unix-panel">
        <header class="unix-panel__header">
          <span>motd</span>
          <strong>SESSION</strong>
        </header>
        <pre class="unix-pre">login: 访客#0719
host: blackbox-archive
tty: pts/0
perm: read-only
clock: untrusted</pre>
      </section>
    </div>
  `;
}

function renderRecordsApp(activeFile: CaseFile): string {
  return `
    <div class="unix-record-app">
      <aside class="unix-record-index" aria-label="档案列表">
        <div class="unix-pane-title">
          <span>/var/archive/case</span>
          <strong>CASE INDEX</strong>
        </div>
        ${renderRoleSummary()}
        <div class="search-strip">
          <span>grep</span>
          <input type="text" value="北线 灯塔 匿名信 权限" aria-label="档案搜索" />
        </div>
        <nav class="file-list">
          ${renderFileList()}
        </nav>
      </aside>

      <div class="unix-record-reader">
        ${renderActiveFile(activeFile)}
      </div>
    </div>
  `;
}

function renderShortwaveApp(): string {
  return `
    <div class="shortwave-app">
      <section class="unix-panel shortwave-tuner">
        <header class="unix-panel__header">
          <span>/dev/radio0</span>
          <strong>RX-SHORTWAVE</strong>
        </header>
        <div class="frequency-readout">
          <span>FREQ</span>
          <strong>6.107 MHz</strong>
          <em>AM / NARROW</em>
        </div>
        <div class="signal-meter" aria-label="信号强度">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="frequency-list">
          <button type="button" class="is-active">6.107 MHz</button>
          <button type="button">7.190 MHz</button>
          <button type="button">9.421 MHz</button>
          <button type="button">11.719 MHz</button>
        </div>
      </section>

      <section class="unix-panel shortwave-log">
        <header class="unix-panel__header">
          <span>rx-buffer</span>
          <strong>DECODE</strong>
        </header>
        <pre class="unix-pre">00:16:02 carrier lock
00:16:08 ... --- ... / NOT DISTRESS
00:16:19 voice fragment: 灯塔 / 二级透镜 / 061
00:16:31 burst: 07 19 07 19
00:16:44 noise floor rising
00:17:00 carrier lost</pre>
      </section>

      <section class="unix-panel shortwave-spectrum">
        <header class="unix-panel__header">
          <span>waterfall</span>
          <strong>SPECTRUM</strong>
        </header>
        <div class="waterfall" aria-hidden="true">
          <span style="--level: 18%"></span>
          <span style="--level: 42%"></span>
          <span style="--level: 31%"></span>
          <span style="--level: 76%"></span>
          <span style="--level: 48%"></span>
          <span style="--level: 63%"></span>
          <span style="--level: 24%"></span>
          <span style="--level: 54%"></span>
        </div>
      </section>
    </div>
  `;
}

function renderCommunicationsApp(): string {
  const threadRows = chatThreads
    .map((thread) => {
      const selected = thread.id === selectedThreadId ? 'is-active' : '';
      const access = evaluateAccess(profile, thread.access);

      return `
        <button class="thread-row ${selected}" type="button" data-thread-id="${thread.id}">
          <strong>${thread.contactName}</strong>
          <span>${thread.channel}</span>
          <em>${access.allowed ? 'readable' : 'locked'}</em>
        </button>
      `;
    })
    .join('');

  return `
    <div class="unix-comm-app">
      <aside class="unix-thread-list" aria-label="通信信道">
        <div class="unix-pane-title">
          <span>/var/spool/comm</span>
          <strong>CHANNELS</strong>
        </div>
        ${threadRows}
      </aside>
      <section class="unix-chat-window" aria-label="通信软件">
        ${renderChat()}
      </section>
    </div>
  `;
}

function renderClockApp(): string {
  return `
    <div class="clock-app">
      <section class="unix-panel clock-face">
        <header class="unix-panel__header">
          <span>clockctl status</span>
          <strong>LOCAL CLOCK</strong>
        </header>
        <div class="clock-readout">
          <span>-1162-00-00</span>
          <strong>00:14:27</strong>
          <em>UNVERIFIED</em>
        </div>
      </section>

      <section class="unix-panel">
        <header class="unix-panel__header">
          <span>timedatectl</span>
          <strong>SOURCES</strong>
        </header>
        <div class="clock-table">
          <span>授时中心</span><strong>failed</strong>
          <span>本地缓存</span><strong>active</strong>
          <span>共和国历</span><strong>unmapped</strong>
          <span>漂移估计</span><strong>+271 days?</strong>
        </div>
      </section>

      <section class="unix-panel">
        <header class="unix-panel__header">
          <span>/var/log/time</span>
          <strong>LAST EVENTS</strong>
        </header>
        <pre class="unix-pre">00:00:02 sync source unreachable
00:00:03 cache year accepted: -1162
00:00:07 login timestamp marked unsafe
00:13:44 external media date: 1907-07-19</pre>
      </section>
    </div>
  `;
}

function renderUnixAppContent(activeFile: CaseFile): string {
  if (activeUnixAppId === 'records') return renderRecordsApp(activeFile);
  if (activeUnixAppId === 'shortwave') return renderShortwaveApp();
  if (activeUnixAppId === 'communications') return renderCommunicationsApp();
  if (activeUnixAppId === 'clock') return renderClockApp();
  return renderUnixDashboard();
}

function getUnixWindowTitle(): string {
  if (activeUnixAppId === 'dashboard') return '应用看板';
  return unixApps.find((unixApp) => unixApp.id === activeUnixAppId)?.label ?? activeUnixAppId;
}

function renderRecordsWorkspace(activeFile: CaseFile): string {
  return `
    <section class="workspace workspace--unix">
      <header class="unix-menubar">
        <div>
          <p class="eyebrow">UNIX RECOVERY SHELL</p>
          <h2>blackbox-archive:/home/guest0719</h2>
        </div>
        <div class="unix-command-line">
          <span>$</span>
          <strong>${activeUnixAppId === 'dashboard' ? 'ls /usr/local/bin' : unixApps.find((unixApp) => unixApp.id === activeUnixAppId)?.command}</strong>
        </div>
      </header>

      <div class="unix-workbench">
        ${renderUnixDock()}
        <section class="unix-window" aria-label="${getUnixWindowTitle()}">
          <header class="unix-window__bar">
            <div>
              <span class="unix-window__dot"></span>
              <span class="unix-window__dot"></span>
              <span class="unix-window__dot"></span>
            </div>
            <strong>${getUnixWindowTitle()}</strong>
            <button type="button" data-unix-app="dashboard">desk</button>
          </header>
          <div class="unix-window__body">
            ${renderUnixAppContent(activeFile)}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderUsbNotice(): string {
  if (!showUsbNotice) return '';

  return `
    <aside class="usb-notice" aria-label="外接介质检测">
      <div>
        <p class="eyebrow">REMOVABLE DRIVE</p>
        <h2>可移动磁盘已插入</h2>
      </div>
      <p>请选择要对可移动磁盘 AURORA-1907 执行的操作。</p>
      <div class="usb-notice__actions">
        <button type="button" data-usb-action="open">打开文件夹</button>
        <button type="button" data-usb-action="dismiss">不执行操作</button>
      </div>
    </aside>
  `;
}

function renderTerminalLine(): string {
  const readableCount = caseFiles.filter((file) => evaluateAccess(profile, file.access).allowed).length;
  const solvedCount = caseFiles.filter((file) => file.reviewStatus === 'solved').length;
  const workspaceLabel = workspaceView === 'files' ? 'FILE MANAGER' : `UNIX ${activeUnixAppId.toUpperCase()}`;
  return `SYS: ${caseFiles.length} RECORDS / ${readableCount} READABLE / ${solvedCount} VERIFIED / ${workspaceLabel} / ROLE ${profile.activeRole.toUpperCase()}`;
}

function bindArchiveEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-workspace-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.workspaceView;
      if (view !== 'files' && view !== 'records') return;
      workspaceView = view;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-unix-app]').forEach((button) => {
    button.addEventListener('click', () => {
      const appId = button.dataset.unixApp;
      if (
        appId !== 'dashboard' &&
        appId !== 'records' &&
        appId !== 'shortwave' &&
        appId !== 'communications' &&
        appId !== 'clock'
      ) {
        return;
      }

      activeUnixAppId = appId;
      workspaceView = 'records';
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-directory-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const directoryId = button.dataset.directoryId;
      const directory = virtualDirectories.find((item) => item.id === directoryId);
      if (!directory) return;

      selectedDirectoryId = directory.id;
      selectedDocumentId = '';
      showUsbNotice = false;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-document-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDocumentId = button.dataset.documentId ?? selectedDocumentId;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-file-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedFileId = button.dataset.fileId ?? selectedFileId;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-thread-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedThreadId = button.dataset.threadId ?? selectedThreadId;
      activeUnixAppId = 'communications';
      workspaceView = 'records';
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-usb-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.usbAction === 'open') {
        openUsbDirectory();
        return;
      }

      showUsbNotice = false;
      render();
    });
  });
}

function render(): void {
  if (appView === 'boot') {
    root.innerHTML = renderBootScreen(loginStage);
    return;
  }

  if (appView === 'login') {
    root.innerHTML = renderLoginScreen(loginStage);
    bindLoginForm();
    return;
  }

  if (appView === 'authenticating') {
    root.innerHTML = renderAuthFeedback(loginStage);
    return;
  }

  const activeFile = caseFiles.find((file) => file.id === selectedFileId) ?? caseFiles[0];
  const workspaceMarkup =
    workspaceView === 'files' ? renderFileManagerWorkspace() : renderRecordsWorkspace(activeFile);

  root.innerHTML = `
    <main class="archive-shell">
      <div class="scanlines" aria-hidden="true"></div>
      <header class="topbar">
        <div class="brand-block">
          <img class="brand-mark" src="./assets/bureau-seal.svg" alt="" />
          <div>
            <h1>黑箱档案局</h1>
            <p>Read-Only Recovery Console / Local Cache Mode</p>
          </div>
        </div>
        ${renderWorkspaceSwitcher()}
        <div class="system-readout">
          <span>LOCAL</span>
          <strong>NODE-07</strong>
        </div>
      </header>

      ${workspaceMarkup}
      ${renderUsbNotice()}

      <footer class="terminal-bar">
        <span>${renderTerminalLine()}</span>
        <span>F1 HELP / F2 SESSION LOG / F3 INDEX</span>
      </footer>
    </main>
  `;

  bindArchiveEvents();
}

startBootSequence();
