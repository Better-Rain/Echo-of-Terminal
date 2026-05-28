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
  ChatThread,
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
type UtilityAppId = 'communications' | 'shortwave' | 'clock';
type CommunicationsView = 'threads' | 'conversation' | 'detail';
type CommunicationsReturnView = 'threads' | 'conversation';

type UtilityAppMeta = {
  id: UtilityAppId;
  label: string;
  command: string;
  status: string;
};

const utilityApps: UtilityAppMeta[] = [
  {
    id: 'communications',
    label: '通信软件',
    command: 'secure-comm',
    status: 'MIRROR',
  },
  {
    id: 'shortwave',
    label: '短波接收器',
    command: 'rx-shortwave',
    status: 'MONITOR',
  },
  {
    id: 'clock',
    label: '时钟',
    command: 'clockctl',
    status: 'DRIFT',
  },
];

const localMountDelayMs = 900;
const externalMountDelayMs = 2400;

let selectedFileId = caseFiles[0].id;
let selectedThreadId = chatThreads[0].id;
let appView: 'boot' | 'login' | 'authenticating' | 'archive' = 'boot';
let workspaceView: 'files' | 'records' = 'files';
let activeUtilityAppId: UtilityAppId = 'communications';
let communicationsView: CommunicationsView = 'threads';
let communicationsReturnView: CommunicationsReturnView = 'threads';
let mountStage: MountStage = 'scanning';
let selectedDirectoryId = 'local-root';
let selectedDocumentId = '';
let shortwaveFrequencyMhz = 6.107;
let shortwaveOffsetKhz = 0;
let fileSearchQuery = '';
let showUsbNotice = false;
let mountSequenceScheduled = false;
let loginError = '';

const shortwaveMinMhz = 3;
const shortwaveMaxMhz = 12;
const shortwaveOffsetMinKhz = -80;
const shortwaveOffsetMaxKhz = 80;
const shortwaveDragSensitivityMhz = 0.018;
const shortwaveTargetCenterMhz = 6.107;
const shortwaveTargetOffsetKhz = 42;

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
  activeUtilityAppId = 'communications';
  communicationsView = 'threads';
  communicationsReturnView = 'threads';
  mountStage = 'scanning';
  selectedDirectoryId = 'local-root';
  selectedDocumentId = '';
  fileSearchQuery = '';
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function getDocumentDirectory(document: VirtualDocument): VirtualDirectory | undefined {
  return getDirectory(document.directoryId);
}

function getDocumentPath(document: VirtualDocument): string {
  const directory = getDocumentDirectory(document);
  return `${directory?.path ?? ''}${document.name}.${document.extension}`;
}

function getVisibleDocuments(): VirtualDocument[] {
  return virtualDocuments.filter((document) => {
    const directory = getDocumentDirectory(document);
    return Boolean(directory && isVolumeVisible(directory.volumeId));
  });
}

function matchesFileSearch(document: VirtualDocument, normalizedQuery: string): boolean {
  const haystack = [
    document.name,
    document.extension,
    document.classification,
    getDocumentPath(document),
    ...document.tags,
    ...document.body,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function getFileSearchRank(document: VirtualDocument, normalizedQuery: string): number {
  const fileName = `${document.name}.${document.extension}`.toLowerCase();
  if (fileName.includes(normalizedQuery)) return 0;
  if (getDocumentPath(document).toLowerCase().includes(normalizedQuery)) return 1;
  if (document.tags.join(' ').toLowerCase().includes(normalizedQuery)) return 2;
  if (document.classification.toLowerCase().includes(normalizedQuery)) return 3;
  return 4;
}

function getFileSearchResults(): VirtualDocument[] {
  const normalizedQuery = fileSearchQuery.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return getVisibleDocuments()
    .filter((document) => matchesFileSearch(document, normalizedQuery))
    .sort(
      (a, b) =>
        getFileSearchRank(a, normalizedQuery) - getFileSearchRank(b, normalizedQuery) ||
        getDocumentPath(a).localeCompare(getDocumentPath(b)),
    );
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
          'MOUNT SCAN',
          '正在刷新可移动介质',
          '总线监听中，等待外接存储完成只读握手。',
          true,
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

function renderMountStatus(label: string, title: string, message: string, withProgress = false): string {
  return `
    <div class="mount-status">
      <p class="eyebrow">${label}</p>
      <strong>${title}</strong>
      <span>${message}</span>
      ${withProgress ? '<i class="mount-progress" aria-hidden="true"><b></b></i>' : ''}
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

function renderDocumentRow(document: VirtualDocument, withPath = false): string {
  const selected = document.id === selectedDocumentId ? 'is-selected' : '';
  const pathMarkup = withPath ? `<span class="document-row__path">${getDocumentPath(document)}</span>` : '';

  return `
    <button class="document-row ${selected}" type="button" data-document-id="${document.id}" data-document-directory-id="${document.directoryId}">
      <span class="document-row__icon">${document.extension}</span>
      <span class="document-row__main">
        <span class="document-row__name">${document.name}.${document.extension}</span>
        ${pathMarkup}
      </span>
      <span class="document-row__meta">${document.sizeLabel}</span>
    </button>
  `;
}

function renderDirectoryList(directory: VirtualDirectory): string {
  const directoryRows = getChildDirectories(directory).map((childDirectory) => renderDirectoryRow(childDirectory)).join('');
  const documentRows = getDirectoryDocuments(directory).map((document) => renderDocumentRow(document)).join('');
  const rows = renderParentDirectoryRow(directory) + directoryRows + documentRows;

  if (rows) return rows;

  return renderMountStatus('EMPTY DIRECTORY', '没有可见项目', '该目录当前没有可读文件或下级目录。');
}

function renderFileSearchForm(): string {
  return `
    <form class="file-search" id="fileSearchForm">
      <span>SEARCH</span>
      <input type="search" name="fileSearch" value="${escapeHtml(fileSearchQuery)}" placeholder="offset / signal / report" aria-label="搜索文件" />
      <button type="submit">搜索</button>
      ${fileSearchQuery ? '<button type="button" data-file-search-clear>清除</button>' : ''}
    </form>
  `;
}

function renderFileSearchResults(results: VirtualDocument[]): string {
  if (!results.length) {
    return renderMountStatus('NO MATCH', '没有匹配文件', `未在已挂载介质中找到 “${escapeHtml(fileSearchQuery)}”。`);
  }

  return results.map((document) => renderDocumentRow(document, true)).join('');
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
  const searchResults = fileSearchQuery ? getFileSearchResults() : [];

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
          <span>${fileSearchQuery ? `搜索已挂载介质：${escapeHtml(fileSearchQuery)}` : volume.description}</span>
          <span>${fileSearchQuery ? `${searchResults.length} RESULTS` : `${directory.directoryIds.length} DIRS / ${directory.fileIds.length} FILES`}</span>
        </div>
        ${renderFileSearchForm()}
        <div class="document-list">
          ${fileSearchQuery ? renderFileSearchResults(searchResults) : renderDirectoryList(directory)}
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

function getSelectedChatThread(): ChatThread {
  return chatThreads.find((item) => item.id === selectedThreadId) ?? chatThreads[0];
}

function getThreadKindLabel(thread: ChatThread): string {
  return thread.kind === 'group' ? 'GROUP' : 'DIRECT';
}

function renderContactAvatar(thread: ChatThread, className = ''): string {
  return `
    <button class="contact-avatar ${thread.kind === 'group' ? 'contact-avatar--group' : ''} ${className}" type="button" data-contact-detail="${thread.id}" aria-label="查看${thread.contactName}登记信息">
      ${thread.avatar}
    </button>
  `;
}

function renderChatMessage(message: ChatMessage, thread: ChatThread): string {
  const access = evaluateAccess(profile, message.access);
  const text = access.allowed ? message.text : message.redactedText ?? '权限不足：消息被遮蔽。';
  const redactedClass = access.allowed ? '' : 'is-redacted';

  if (message.from === 'system') {
    return `
      <article class="chat-message chat-message--system ${redactedClass}">
        <span>${message.speaker} / ${message.time}</span>
        <p>${text}</p>
      </article>
    `;
  }

  const avatar = message.avatar ?? (message.from === 'operator' ? '07' : thread.avatar);
  const avatarMarkup =
    message.from === 'contact'
      ? `<button class="message-avatar" type="button" data-contact-detail="${thread.id}" aria-label="查看${thread.contactName}登记信息">${avatar}</button>`
      : `<span class="message-avatar message-avatar--self">${avatar}</span>`;

  return `
    <article class="chat-message chat-message--${message.from} ${redactedClass}">
      ${message.from === 'contact' ? avatarMarkup : ''}
      <div class="chat-message__bubble">
        <div class="chat-message__meta">
          <span>${message.speaker}</span>
          <time>${message.time}</time>
        </div>
        <p>${text}</p>
      </div>
      ${message.from === 'operator' ? avatarMarkup : ''}
    </article>
  `;
}

function renderChat(): string {
  const thread = getSelectedChatThread();
  const threadAccess = evaluateAccess(profile, thread.access);
  const canSendMessage = profile.permissions.includes('chat:message');

  if (!threadAccess.allowed) {
    return `
      <header class="panel-header panel-header--compact panel-header--chat">
        <button class="comm-back-button" type="button" data-comm-back aria-label="返回通信列表">返回</button>
        <div class="chat-heading">
          ${renderContactAvatar(thread, 'chat-heading__avatar')}
          <div>
            <p class="eyebrow">SECURE CHAT</p>
            <h2>${thread.title}</h2>
          </div>
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
    <header class="panel-header panel-header--compact panel-header--chat">
      <button class="comm-back-button" type="button" data-comm-back aria-label="返回通信列表">返回</button>
      <div class="chat-heading">
        ${renderContactAvatar(thread, 'chat-heading__avatar')}
        <div>
          <p class="eyebrow">${thread.channel}</p>
          <h2>${thread.title}</h2>
        </div>
      </div>
      <span class="online-dot" title="在线"></span>
    </header>
    <div class="chat-log">
      ${thread.messages.map((message) => renderChatMessage(message, thread)).join('')}
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

function renderContactDetail(): string {
  const thread = getSelectedChatThread();
  const access = evaluateAccess(profile, thread.access);
  const memberMarkup =
    thread.kind === 'group' && thread.members?.length
      ? `
          <section class="contact-detail__section">
            <span>成员镜像</span>
            <ul>
              ${thread.members.map((member) => `<li>${member}</li>`).join('')}
            </ul>
          </section>
        `
      : '';

  return `
    <header class="panel-header panel-header--compact panel-header--chat">
      <button class="comm-back-button" type="button" data-comm-detail-back aria-label="返回上一层">返回</button>
      <div>
        <p class="eyebrow">CONTACT RECORD</p>
        <h2>${thread.contactName}</h2>
      </div>
      <button class="comm-open-button" type="button" data-thread-id="${thread.id}">打开会话</button>
    </header>
    <section class="contact-detail">
      <div class="contact-detail__identity">
        <span class="contact-detail__avatar ${thread.kind === 'group' ? 'contact-detail__avatar--group' : ''}">${thread.avatar}</span>
        <div>
          <p class="eyebrow">SECURE CHAT</p>
          <strong>${thread.title}</strong>
          <span>${thread.subtitle}</span>
        </div>
      </div>

      <div class="contact-detail__facts">
        <span>类型</span><strong>${getThreadKindLabel(thread)}</strong>
        <span>信道</span><strong>${thread.channel}</strong>
        <span>权限</span><strong>${access.allowed ? 'READABLE' : 'LOCKED'}</strong>
      </div>

      <section class="contact-detail__section">
        <span>登记备注</span>
        <p>${thread.detail}</p>
      </section>

      ${memberMarkup}
    </section>
  `;
}

function renderUtilityTabs(): string {
  return utilityApps
    .map(
      (utilityApp) => `
        <button class="utility-tab ${activeUtilityAppId === utilityApp.id ? 'is-active' : ''}" type="button" data-utility-app="${utilityApp.id}">
          <span>${utilityApp.command}</span>
          <strong>${utilityApp.label}</strong>
        </button>
      `,
    )
    .join('');
}

function clampShortwaveFrequency(value: number): number {
  return Math.min(shortwaveMaxMhz, Math.max(shortwaveMinMhz, value));
}

function formatShortwaveFrequency(value: number): string {
  return clampShortwaveFrequency(value).toFixed(3);
}

function tuneShortwaveFrequency(value: number): void {
  shortwaveFrequencyMhz = Number(formatShortwaveFrequency(value));
}

function clampShortwaveOffset(value: number): number {
  return Math.min(shortwaveOffsetMaxKhz, Math.max(shortwaveOffsetMinKhz, Math.round(value)));
}

function formatShortwaveOffset(value: number): string {
  const offset = clampShortwaveOffset(value);
  return `${offset >= 0 ? '+' : '-'}${String(Math.abs(offset)).padStart(3, '0')}`;
}

function tuneShortwaveOffset(value: number): void {
  shortwaveOffsetKhz = clampShortwaveOffset(value);
}

function getShortwaveEffectiveFrequencyMhz(): number {
  return shortwaveFrequencyMhz + shortwaveOffsetKhz / 1000;
}

function getShortwaveTargetFrequencyMhz(): number {
  return shortwaveTargetCenterMhz + shortwaveTargetOffsetKhz / 1000;
}

function hasShortwaveReportLock(): boolean {
  return Math.abs(getShortwaveEffectiveFrequencyMhz() - getShortwaveTargetFrequencyMhz()) <= 0.002;
}

function getShortwaveKnobAngle(): number {
  const range = shortwaveMaxMhz - shortwaveMinMhz;
  const ratio = (shortwaveFrequencyMhz - shortwaveMinMhz) / range;
  return Math.round(-135 + ratio * 270);
}

function getShortwaveSignalBars(): string {
  const distanceKhz = Math.abs(getShortwaveEffectiveFrequencyMhz() - getShortwaveTargetFrequencyMhz()) * 1000;
  const litBars = Math.max(1, 6 - Math.floor(distanceKhz / 8));

  return Array.from({ length: 6 }, (_, index) => `<span class="${index < litBars ? 'is-lit' : ''}"></span>`).join('');
}

function renderShortwaveTool(): string {
  const frequency = formatShortwaveFrequency(shortwaveFrequencyMhz);
  const knobAngle = getShortwaveKnobAngle();
  const offset = formatShortwaveOffset(shortwaveOffsetKhz);
  const effectiveFrequency = formatShortwaveFrequency(getShortwaveEffectiveFrequencyMhz());
  const reportLocked = hasShortwaveReportLock();
  const decodeBuffer = reportLocked
    ? `00:16:02 carrier lock
00:16:08 center ${frequency} MHz / offset ${offset} kHz
00:16:19 REPORT_NAME: REPORT_NORTHLINE_061.enc
00:16:31 KEY_FORMAT: JANUS-0719-{four-digit-checksum}
00:16:44 unlock stage disabled in this recovery build`
    : `00:16:02 scanning carrier
00:16:08 apply project offset before decode
00:16:19 voice fragment: 灯塔 / 二级透镜 / 061
00:16:31 burst: 07 19 07 19
00:16:44 noise floor rising
00:17:00 no stable report header`;

  return `
    <div class="shortwave-tuner">
      <button class="tuning-knob" type="button" data-shortwave-knob style="--knob-angle: ${knobAngle}deg" aria-label="调频旋钮">
        <span></span>
      </button>
      <label class="frequency-input">
        <span>CENTER / MHz</span>
        <input type="text" inputmode="decimal" value="${frequency}" data-shortwave-frequency aria-label="短波频率" />
      </label>
      <div class="tuning-steps" aria-label="频率微调">
        <button type="button" data-tune-step="-0.010">-10 kHz</button>
        <button type="button" data-tune-step="0.010">+10 kHz</button>
      </div>
      <label class="offset-control">
        <span>OFFSET / kHz</span>
        <input type="range" min="${shortwaveOffsetMinKhz}" max="${shortwaveOffsetMaxKhz}" step="1" value="${shortwaveOffsetKhz}" data-shortwave-offset aria-label="频率偏移" />
      </label>
      <div class="offset-readout">
        <span>effective</span>
        <strong>${effectiveFrequency} MHz</strong>
        <em>${offset} kHz</em>
      </div>
      <div class="offset-steps" aria-label="偏移微调">
        <button type="button" data-offset-step="-1">-1 kHz</button>
        <button type="button" data-offset-step="1">+1 kHz</button>
      </div>
      <div class="receiver-state">
        <span>MODE</span>
        <strong>AM / NARROW</strong>
        <em>${reportLocked ? 'LOCK' : 'SCAN'}</em>
      </div>
    </div>

    <div class="shortwave-signal">
      <div class="signal-meter" aria-label="信号强度">
        ${getShortwaveSignalBars()}
      </div>
      <div class="signal-scale">
        <span>3.0</span>
        <span>6.0</span>
        <span>9.0</span>
        <span>12.0</span>
      </div>
    </div>

    <pre class="utility-pre shortwave-buffer">${decodeBuffer}</pre>

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
  `;
}

function renderCommunicationsTool(): string {
  const threadRows = chatThreads
    .map((thread) => {
      const selected = thread.id === selectedThreadId ? 'is-active' : '';
      const access = evaluateAccess(profile, thread.access);

      return `
        <article class="thread-row ${selected}">
          ${renderContactAvatar(thread)}
          <button class="thread-row__open" type="button" data-thread-id="${thread.id}">
            <strong>${thread.contactName}</strong>
            <span>${thread.subtitle}</span>
          </button>
          <em>${access.allowed ? getThreadKindLabel(thread) : 'LOCKED'}</em>
        </article>
      `;
    })
    .join('');

  if (communicationsView === 'detail') {
    return renderContactDetail();
  }

  if (communicationsView === 'conversation') {
    return renderChat();
  }

  return `
    <header class="utility-pane-title">
      <span>/var/spool/comm</span>
      <strong>通信列表</strong>
    </header>
    <div class="thread-list">
      ${threadRows}
    </div>
  `;
}

function renderClockTool(): string {
  return `
    <header class="utility-pane-title">
      <span>clockctl status</span>
      <strong>LOCAL CLOCK</strong>
    </header>

    <div class="clock-readout">
      <span>-1162-00-00</span>
      <strong>00:14:27</strong>
      <em>UNVERIFIED</em>
    </div>

    <div class="clock-section">
      <header class="clock-section__header">
        <span>timedatectl</span>
        <strong>SOURCES</strong>
      </header>
      <div class="clock-table">
        <span>授时中心</span><strong>failed</strong>
        <span>本地缓存</span><strong>active</strong>
        <span>共和国历</span><strong>unmapped</strong>
        <span>漂移估计</span><strong>+271 days?</strong>
      </div>
    </div>

    <div class="clock-section clock-section--events">
      <header class="clock-section__header">
        <span>/var/log/time</span>
        <strong>LAST EVENTS</strong>
      </header>
      <pre class="utility-pre">00:00:02 sync source unreachable
00:00:03 cache year accepted: -1162
00:00:07 login timestamp marked unsafe
00:13:44 external media date: 1907-07-19</pre>
    </div>
  `;
}

function renderUtilityContent(): string {
  if (activeUtilityAppId === 'shortwave') return renderShortwaveTool();
  if (activeUtilityAppId === 'clock') return renderClockTool();
  return renderCommunicationsTool();
}

function getUtilityTitle(): string {
  return utilityApps.find((utilityApp) => utilityApp.id === activeUtilityAppId)?.label ?? activeUtilityAppId;
}

function getUtilityCommand(): string {
  return utilityApps.find((utilityApp) => utilityApp.id === activeUtilityAppId)?.command ?? activeUtilityAppId;
}

function renderRecordsWorkspace(activeFile: CaseFile): string {
  return `
    <section class="workspace workspace--records">
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

      <aside class="utility-panel" aria-label="辅助软件">
        <header class="utility-tabs" aria-label="软件标签页">
          ${renderUtilityTabs()}
        </header>
        <section class="utility-window utility-window--${activeUtilityAppId}" aria-label="${getUtilityTitle()}">
          <div class="utility-window__title">
            <span>${getUtilityCommand()}</span>
            <strong>${getUtilityTitle()}</strong>
          </div>
          ${renderUtilityContent()}
        </section>
      </aside>
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
  const workspaceLabel = workspaceView === 'files' ? 'FILE MANAGER' : `RECORDS / ${activeUtilityAppId.toUpperCase()}`;
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

  document.querySelectorAll<HTMLButtonElement>('[data-utility-app]').forEach((button) => {
    button.addEventListener('click', () => {
      const appId = button.dataset.utilityApp;
      if (appId !== 'shortwave' && appId !== 'communications' && appId !== 'clock') return;

      activeUtilityAppId = appId;
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
      fileSearchQuery = '';
      showUsbNotice = false;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-document-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const directoryId = button.dataset.documentDirectoryId;
      if (directoryId) selectedDirectoryId = directoryId;
      selectedDocumentId = button.dataset.documentId ?? selectedDocumentId;
      fileSearchQuery = '';
      render();
    });
  });

  const fileSearchForm = document.querySelector<HTMLFormElement>('#fileSearchForm');
  fileSearchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(fileSearchForm);
    fileSearchQuery = String(formData.get('fileSearch') ?? '').trim();
    selectedDocumentId = '';
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-file-search-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      fileSearchQuery = '';
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
      activeUtilityAppId = 'communications';
      communicationsView = 'conversation';
      communicationsReturnView = 'threads';
      workspaceView = 'records';
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-contact-detail]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedThreadId = button.dataset.contactDetail ?? selectedThreadId;
      activeUtilityAppId = 'communications';
      communicationsReturnView = communicationsView === 'conversation' ? 'conversation' : 'threads';
      communicationsView = 'detail';
      workspaceView = 'records';
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-comm-back]').forEach((button) => {
    button.addEventListener('click', () => {
      communicationsView = 'threads';
      activeUtilityAppId = 'communications';
      workspaceView = 'records';
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-comm-detail-back]').forEach((button) => {
    button.addEventListener('click', () => {
      communicationsView = communicationsReturnView;
      activeUtilityAppId = 'communications';
      workspaceView = 'records';
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-tune-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const step = Number.parseFloat(button.dataset.tuneStep ?? '0');
      tuneShortwaveFrequency(shortwaveFrequencyMhz + step);
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-offset-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const step = Number.parseFloat(button.dataset.offsetStep ?? '0');
      tuneShortwaveOffset(shortwaveOffsetKhz + step);
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-shortwave-offset]').forEach((input) => {
    input.addEventListener('change', () => {
      tuneShortwaveOffset(Number.parseFloat(input.value));
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-shortwave-frequency]').forEach((input) => {
    const commitFrequency = () => {
      const value = Number.parseFloat(input.value);
      if (Number.isNaN(value)) {
        input.value = formatShortwaveFrequency(shortwaveFrequencyMhz);
        return;
      }

      tuneShortwaveFrequency(value);
      render();
    };

    input.addEventListener('change', commitFrequency);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitFrequency();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-shortwave-knob]').forEach((button) => {
    button.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        tuneShortwaveFrequency(shortwaveFrequencyMhz + (event.deltaY > 0 ? -0.01 : 0.01));
        render();
      },
      { passive: false },
    );

    button.addEventListener('pointerdown', (event) => {
      const startX = event.clientX;
      const startFrequency = shortwaveFrequencyMhz;
      let moved = false;

      const previewFrequency = (value: number) => {
        tuneShortwaveFrequency(value);
        button.style.setProperty('--knob-angle', `${getShortwaveKnobAngle()}deg`);
        const input = document.querySelector<HTMLInputElement>('[data-shortwave-frequency]');
        if (input) input.value = formatShortwaveFrequency(shortwaveFrequencyMhz);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        if (Math.abs(deltaX) > 3) moved = true;
        previewFrequency(startFrequency + deltaX * shortwaveDragSensitivityMhz);
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        if (!moved) tuneShortwaveFrequency(startFrequency + 0.01);
        render();
      };

      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
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
