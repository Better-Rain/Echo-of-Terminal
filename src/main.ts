import './styles.css';
import { roleDefinitions } from './data/access';
import { caseFiles } from './data/cases';
import { chatThreads, delayedChatDelivery } from './data/chats';
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

type ShortwaveLogTone = 'noise' | 'scan' | 'near' | 'lock' | 'hint' | 'success';

type ShortwaveLogEntry = {
  id: number;
  tone: ShortwaveLogTone;
  message: string;
};

type ShortwaveReceptionMessage = {
  tone: ShortwaveLogTone;
  message: string;
};

type ShortwaveSignalTarget = {
  id: string;
  label: string;
  centerMhz: number;
  phaseRad: number;
  phaseToleranceRad: number;
  phaseDetectionRangeRad: number;
  lockToleranceKhz: number;
  detectionRangeKhz: number;
  reportName: string;
  keyFormat: string;
  documentId?: string;
  weakMessages: ShortwaveReceptionMessage[];
  carrierMessages: ShortwaveReceptionMessage[];
  lockedIntroMessages: ShortwaveReceptionMessage[];
  lockedLoopMessages: ShortwaveReceptionMessage[];
};

type ShortwaveSignalReading = {
  target: ShortwaveSignalTarget;
  detuneKhz: number;
  distanceKhz: number;
  phaseDistanceRad: number;
  phaseStrength: number;
  strength: number;
  locked: boolean;
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
const usbNoticeVisibleMs = 9000;
const shortwaveReceptionInitialDelayMs = 900;
const shortwaveReceptionIntervalMs = 3200;

let selectedFileId = '';
let selectedThreadId = chatThreads[0].id;
let appView: 'boot' | 'login' | 'authenticating' | 'archive' = 'boot';
let workspaceView: 'files' | 'records' = 'files';
let activeUtilityAppId: UtilityAppId = 'communications';
let communicationsView: CommunicationsView = 'threads';
let communicationsReturnView: CommunicationsReturnView = 'threads';
let mountStage: MountStage = 'scanning';
let selectedDirectoryId = 'local-root';
let selectedDocumentId = '';
const unlockedDocumentIds = new Set<string>();
let shortwaveFrequencyMhz = 6.107;
let shortwavePhaseRad = 0;
let fileSearchQuery = '';
let fileSearchNotice = '';
let showUsbNotice = false;
let usbNoticeShouldAnimate = false;
let mountSequenceScheduled = false;
let loginError = '';
let documentUnlockError = '';
let usbNoticeTimeoutId: number | undefined;
let shortwaveReceptionTimerId: number | undefined;
let delayedCommunicationTimerId: number | undefined;
let delayedCommunicationDelivered = false;
let showCommunicationNotice = false;
const unreadThreadIds = new Set<string>();

const shortwaveMinMhz = 3;
const shortwaveMaxMhz = 12;
const shortwavePhaseMinRad = 0;
const shortwavePhaseMaxRad = 6.283;
const shortwaveFrequencyDragSensitivityMhz = 0.004;
const shortwavePhaseStepRad = 0.01;
const shortwaveWaterfallColumns = 18;
const shortwaveWaterfallRows = 9;
const archiveSourceExtension = 'arc';

const shortwaveSignalTargets: ShortwaveSignalTarget[] = [
  {
    id: 'northline-061',
    label: '北线镜像报告 061',
    centerMhz: 6.107,
    phaseRad: 1.319,
    phaseToleranceRad: 0.035,
    phaseDetectionRangeRad: 0.42,
    lockToleranceKhz: 2,
    detectionRangeKhz: 90,
    reportName: 'REPORT_NORTHLINE_061.enc',
    keyFormat: 'JANUS-0719-{四位校验码}',
    documentId: 'report-northline-061',
    weakMessages: [
      { tone: 'scan', message: '监听 {frequency} MHz：宽带噪声中出现周期性起伏。' },
      { tone: 'noise', message: '自动增益记录到短暂抬升，解码缓存仍为空。' },
      { tone: 'scan', message: '低频漂移已压低，未形成稳定载波。' },
    ],
    carrierMessages: [
      { tone: 'near', message: '监听 {frequency} MHz：窄带载波保持，帧同步未通过。' },
      { tone: 'scan', message: '解码缓存反复写入空帧，等待相位校准。' },
      { tone: 'near', message: '载波包络稳定，报告头仍不可读。' },
    ],
    lockedIntroMessages: [
      { tone: 'lock', message: '帧同步完成，接收缓存稳定。' },
      { tone: 'lock', message: '中心频率 {frequency} MHz / 相位校准 {phase} rad / 同步签名 {signature}。' },
      { tone: 'success', message: '报告名称：{reportName}' },
      { tone: 'success', message: '密钥格式：{keyFormat}' },
    ],
    lockedLoopMessages: [
      { tone: 'lock', message: '帧同步保持，重复播送报告头。' },
      { tone: 'success', message: '报告名称：{reportName}' },
      { tone: 'success', message: '密钥格式：{keyFormat}' },
    ],
  },
];

let shortwaveLogSequence = 6;
let shortwaveLastLockedTargetId = '';
let shortwaveReceptionModeKey = 'idle';
let shortwaveReceptionMessageCursor = 0;
const shortwaveLogEntries: ShortwaveLogEntry[] = [
  { id: 1, tone: 'scan', message: '00:16:02 接收器启动，监听短波载波。' },
  { id: 2, tone: 'hint', message: '00:16:08 中心振荡器与相位校准器已就绪。' },
  { id: 3, tone: 'noise', message: '00:16:19 背景噪声稳定，未发现可读报告头。' },
  { id: 4, tone: 'scan', message: '00:16:31 解码缓存为空。' },
  { id: 5, tone: 'hint', message: '00:16:44 同步门限未满足。' },
  { id: 6, tone: 'noise', message: '00:17:00 等待调谐。' },
];

const shortwaveDefaultReceptionMessages: ShortwaveReceptionMessage[] = [
  { tone: 'noise', message: '监听 {frequency} MHz：背景噪声稳定，未发现稳定报告头。' },
  { tone: 'scan', message: '解码缓存为空，自动增益保持低幅扫描。' },
  { tone: 'noise', message: '背景噪声微弱颤动，接收窗口无可读帧。' },
  { tone: 'scan', message: '载波门限未满足，继续监听当前读数。' },
];

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
  fileSearchNotice = '';
  showUsbNotice = false;
  usbNoticeShouldAnimate = false;
  clearUsbNoticeTimer();
  clearShortwaveReceptionTimer();
  scheduleDelayedCommunicationDelivery();
  render();
  scheduleMountSequence();
}

function clearUsbNoticeTimer(): void {
  if (usbNoticeTimeoutId === undefined) return;

  window.clearTimeout(usbNoticeTimeoutId);
  usbNoticeTimeoutId = undefined;
}

function showUsbNoticeTemporarily(): void {
  showUsbNotice = true;
  usbNoticeShouldAnimate = true;
  clearUsbNoticeTimer();

  usbNoticeTimeoutId = window.setTimeout(() => {
    usbNoticeTimeoutId = undefined;
    if (appView !== 'archive' || !showUsbNotice) return;

    showUsbNotice = false;
    render();
  }, usbNoticeVisibleMs);
}

function dismissUsbNotice(): void {
  clearUsbNoticeTimer();
  showUsbNotice = false;
  usbNoticeShouldAnimate = false;
}

function clearDelayedCommunicationTimer(): void {
  if (delayedCommunicationTimerId === undefined) return;

  window.clearTimeout(delayedCommunicationTimerId);
  delayedCommunicationTimerId = undefined;
}

function isThreadOpen(threadId: string): boolean {
  return (
    appView === 'archive' &&
    workspaceView === 'records' &&
    activeUtilityAppId === 'communications' &&
    communicationsView === 'conversation' &&
    selectedThreadId === threadId
  );
}

function markThreadRead(threadId: string): void {
  unreadThreadIds.delete(threadId);
  if (threadId === delayedChatDelivery.threadId) showCommunicationNotice = false;
}

function openDelayedCommunicationThread(): void {
  selectedThreadId = delayedChatDelivery.threadId;
  activeUtilityAppId = 'communications';
  communicationsView = 'conversation';
  communicationsReturnView = 'threads';
  workspaceView = 'records';
  markThreadRead(delayedChatDelivery.threadId);
  clearShortwaveReceptionTimer();
  render();
}

function deliverDelayedCommunication(): void {
  delayedCommunicationTimerId = undefined;
  if (delayedCommunicationDelivered || appView !== 'archive') return;

  const thread = chatThreads.find((item) => item.id === delayedChatDelivery.threadId);
  if (!thread) return;

  delayedChatDelivery.messages.forEach((message) => {
    if (!thread.messages.some((item) => item.id === message.id)) {
      thread.messages.push(message);
    }
  });

  delayedCommunicationDelivered = true;

  if (isThreadOpen(delayedChatDelivery.threadId)) {
    markThreadRead(delayedChatDelivery.threadId);
  } else {
    unreadThreadIds.add(delayedChatDelivery.threadId);
    showCommunicationNotice = true;
  }

  render();
}

function scheduleDelayedCommunicationDelivery(): void {
  clearDelayedCommunicationTimer();
  if (delayedCommunicationDelivered) return;

  delayedCommunicationTimerId = window.setTimeout(deliverDelayedCommunication, delayedChatDelivery.delayMs);
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
    showUsbNoticeTemporarily();
    render();
  }, externalMountDelayMs);
}

function openUsbDirectory(): void {
  if (mountStage !== 'external-mounted') return;

  workspaceView = 'files';
  selectedDirectoryId = 'usb-root';
  selectedDocumentId = '';
  fileSearchQuery = '';
  fileSearchNotice = '';
  dismissUsbNotice();
  render();
}

function renderTerminalLineItem(line: TerminalLine, index: number): string {
  const tone = line.tone ?? 'normal';
  const timeServiceClass = line.updates?.length ? ' boot-line--time-service' : '';
  const delayMs = line.delayMs ?? index * 560;
  const textMarkup = line.updates?.length
    ? `<strong class="boot-line__updates">
        ${line.updates
          .map((update, updateIndex) => {
            const updateClass = updateIndex === line.updates!.length - 1 ? ' class="is-final"' : '';
            return `<span${updateClass} style="--update-delay: ${updateIndex * 760}ms">${update}</span>`;
          })
          .join('')}
      </strong>`
    : `<strong>${line.text}</strong>`;

  return `
    <li class="boot-line boot-line--${tone}${timeServiceClass}" style="--delay: ${delayMs}ms">
      <span>[${line.tag}]</span>
      ${textMarkup}
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

function getRoleShortName(roleId: RoleId): string {
  return findRoleDefinition(roleDefinitions, roleId)?.shortName ?? roleId.toUpperCase();
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
    (document) => document.id === selectedDocumentId && document.directoryId === directory.id && isDocumentVisible(document),
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRecoveryCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function isDocumentUnlocked(document: VirtualDocument): boolean {
  return !document.unlock || unlockedDocumentIds.has(document.id);
}

function getDocumentBody(document: VirtualDocument): string[] {
  if (isDocumentUnlocked(document)) return document.body;
  return document.unlock?.lockedBody ?? document.body;
}

function getChildDirectories(directory: VirtualDirectory): VirtualDirectory[] {
  return directory.directoryIds
    .map((directoryId) => getDirectory(directoryId))
    .filter((item): item is VirtualDirectory => Boolean(item));
}

function isDocumentMounted(document: VirtualDocument): boolean {
  const directory = getDocumentDirectory(document);
  return Boolean(directory && isVolumeVisible(directory.volumeId));
}

function isHiddenDocumentDiscovered(document: VirtualDocument): boolean {
  return !document.hidden || profile.discoveredFlags.includes(document.hidden.discoveredFlag);
}

function isDocumentVisible(document: VirtualDocument): boolean {
  return isDocumentMounted(document) && isHiddenDocumentDiscovered(document);
}

function getDirectoryDocuments(directory: VirtualDirectory): VirtualDocument[] {
  return directory.fileIds
    .map((fileId) => virtualDocuments.find((document) => document.id === fileId))
    .filter((document): document is VirtualDocument => Boolean(document && isDocumentVisible(document)));
}

function getDocumentDirectory(document: VirtualDocument): VirtualDirectory | undefined {
  return getDirectory(document.directoryId);
}

function getDocumentPath(document: VirtualDocument): string {
  const directory = getDocumentDirectory(document);
  return `${directory?.path ?? ''}${document.name}.${document.extension}`;
}

function isArchiveSourceDocument(document: VirtualDocument): boolean {
  return document.extension.toLowerCase() === archiveSourceExtension;
}

function getCaseSourceDocument(file: CaseFile): VirtualDocument | undefined {
  return virtualDocuments.find(
    (document) =>
      document.id === file.sourceDocumentId &&
      document.archiveCaseId === file.id &&
      isArchiveSourceDocument(document),
  );
}

function getParseableCaseFiles(): CaseFile[] {
  return caseFiles.filter((file) => {
    const sourceDocument = getCaseSourceDocument(file);
    if (!sourceDocument) return false;

    return isDocumentVisible(sourceDocument);
  });
}

function getCaseSourcePath(file: CaseFile): string {
  const sourceDocument = getCaseSourceDocument(file);
  if (!sourceDocument) return 'SOURCE MISSING';
  return getDocumentPath(sourceDocument);
}

function getVisibleDocuments(): VirtualDocument[] {
  return virtualDocuments.filter((document) => isDocumentVisible(document));
}

function matchesFileSearch(document: VirtualDocument, normalizedQuery: string): boolean {
  const searchableBody = isDocumentUnlocked(document) ? document.body : document.unlock?.lockedBody ?? document.body;
  const haystack = [
    document.name,
    document.extension,
    document.classification,
    getDocumentPath(document),
    ...document.tags,
    document.hidden?.recoveryCode ?? '',
    ...searchableBody,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function revealHiddenDocumentsForRecoveryCode(code: string): VirtualDocument[] {
  const normalizedCode = normalizeRecoveryCode(code);
  if (!normalizedCode) return [];

  const revealedDocuments: VirtualDocument[] = [];

  virtualDocuments.forEach((document) => {
    if (!document.hidden || isHiddenDocumentDiscovered(document) || !isDocumentMounted(document)) return;
    if (normalizeRecoveryCode(document.hidden.recoveryCode) !== normalizedCode) return;

    profile.discoveredFlags.push(document.hidden.discoveredFlag);
    revealedDocuments.push(document);
  });

  return revealedDocuments;
}

function getHiddenRevealNotice(documents: VirtualDocument[]): string {
  if (!documents.length) return '';

  const messages = documents
    .map((document) => document.hidden?.revealMessage)
    .filter((message): message is string => Boolean(message));

  if (messages.length) return Array.from(new Set(messages)).join(' ');
  return `索引重建：恢复 ${documents.length} 个此前未登记的镜像条目。`;
}

function getFileSearchRank(document: VirtualDocument, normalizedQuery: string): number {
  const fileName = `${document.name}.${document.extension}`.toLowerCase();
  if (fileName.includes(normalizedQuery)) return 0;
  if (getDocumentPath(document).toLowerCase().includes(normalizedQuery)) return 1;
  if ([...document.tags, document.hidden?.recoveryCode ?? ''].join(' ').toLowerCase().includes(normalizedQuery)) return 2;
  if (document.classification.toLowerCase().includes(normalizedQuery)) return 3;
  return 4;
}

function getFileSearchResults(): VirtualDocument[] {
  const normalizedQuery = normalizeSearchText(fileSearchQuery);
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
  const recordsAlertClass = unreadThreadIds.size ? ' has-alert' : '';

  return `
    <nav class="workspace-switcher" aria-label="工作区切换">
      <button class="${workspaceView === 'files' ? 'is-active' : ''}" type="button" data-workspace-view="files">
        文件管理器
      </button>
      <button class="${workspaceView === 'records' ? 'is-active' : ''}${recordsAlertClass}" type="button" data-workspace-view="records">
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
  const directoryCount = getChildDirectories(directory).length;
  const fileCount = getDirectoryDocuments(directory).length;

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
      <span>QUERY</span>
      <input type="search" name="fileSearch" value="${escapeHtml(fileSearchQuery)}" aria-label="搜索文件或输入系统暗码" autocomplete="off" />
      <button type="submit">执行</button>
      ${fileSearchQuery ? '<button type="button" data-file-search-clear>清除</button>' : ''}
    </form>
  `;
}

function renderFileSearchNotice(): string {
  if (!fileSearchNotice) return '';

  return `
    <div class="file-search-notice">
      <span>INDEX</span>
      <strong>${escapeHtml(fileSearchNotice)}</strong>
    </div>
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

  const documentBody = getDocumentBody(document);
  const bodyClasses = [
    'document-body',
    document.unlock && !isDocumentUnlocked(document) ? 'document-body--locked' : '',
    isArchiveSourceDocument(document) ? 'document-body--cipher' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
      <article class="${bodyClasses}">
        ${documentBody.map((paragraph) => `<p>${paragraph}</p>`).join('')}
      </article>
      ${renderDocumentUnlockPanel(document)}
      <div class="document-tags">
        ${document.tags.map((tag) => `<span>${tag}</span>`).join('')}
      </div>
    </section>
  `;
}

function renderDocumentUnlockPanel(document: VirtualDocument): string {
  if (!document.unlock) return '';

  if (isDocumentUnlocked(document)) {
    return `
      <div class="document-unlock document-unlock--success">
        <p class="eyebrow">解锁记录</p>
        <strong>${document.unlock.successMessage}</strong>
      </div>
    `;
  }

  return `
    <form class="document-unlock" id="documentUnlockForm">
      <div>
        <p class="eyebrow">加密校验</p>
        <strong>${document.unlock.prompt}</strong>
      </div>
      <label>
        <span>密钥</span>
        <input type="text" name="documentKey" autocomplete="off" placeholder="JANUS-0719-0000" />
      </label>
      ${documentUnlockError ? `<p class="document-unlock__error">${documentUnlockError}</p>` : ''}
      <button type="submit">提交密钥</button>
    </form>
  `;
}

function renderFileManagerWorkspace(): string {
  const directory = getSelectedDirectory();
  const selectedDocument = directory ? getSelectedDocument(directory) : undefined;
  const volume = directory ? getVolume(directory.volumeId) : undefined;
  const searchResults = fileSearchQuery ? getFileSearchResults() : [];
  const directoryCount = directory ? getChildDirectories(directory).length : 0;
  const fileCount = directory ? getDirectoryDocuments(directory).length : 0;

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
          <span>${fileSearchQuery ? `${searchResults.length} RESULTS` : `${directoryCount} DIRS / ${fileCount} FILES`}</span>
        </div>
        ${renderFileSearchForm()}
        ${renderFileSearchNotice()}
        <div class="document-list">
          ${fileSearchQuery ? renderFileSearchResults(searchResults) : renderDirectoryList(directory)}
        </div>
      </section>

      ${renderDocumentPreview(selectedDocument)}
    </section>
  `;
}

function renderFileList(): string {
  return getParseableCaseFiles()
    .map((file) => {
      const selected = file.id === selectedFileId ? 'is-selected' : '';
      const statusClass = getStatusClass(file, profile);
      const access = evaluateAccess(profile, file.access);
      const sourceDocument = getCaseSourceDocument(file);

      return `
        <button class="file-row ${selected}" type="button" data-file-id="${file.id}">
          <span class="file-row__code" title="${escapeHtml(file.code)}" aria-label="档案编号 ${escapeHtml(file.code)}">${escapeHtml(file.code)}</span>
          <span class="file-row__main">
            <span class="file-row__title">${file.title}</span>
            <span class="file-row__meta">${file.unit}</span>
          </span>
          <span class="status-pill status-pill--${statusClass}">${getStatusLabel(file, profile)}</span>
          <span class="access-stub">${sourceDocument?.name}.${sourceDocument?.extension} / ${access.allowed ? file.classification : 'LOCK / ' + file.classification}</span>
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
          <dt>镜像账号</dt>
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

function getFragmentView(file: CaseFile, fragment: CaseFragment): { body: string; isRedacted: boolean } {
  const rule = fragment.access ?? file.access;
  const access = evaluateAccess(profile, rule);
  const body = access.allowed ? fragment.body : fragment.redactedText ?? '权限不足：该字段被遮蔽。';

  return {
    body,
    isRedacted: !access.allowed,
  };
}

function splitLogLine(body: string): { marker: string; text: string } {
  const match = body.match(/^(\d{2}:\d{2})\s+(.+)$/);
  if (!match) return { marker: '--:--', text: body };

  return {
    marker: match[1],
    text: match[2],
  };
}

function splitTranscriptLine(fragment: CaseFragment, body: string): { speaker: string; text: string } {
  const match = body.match(/^([^:：]{1,12})[:：]\s*(.+)$/);
  if (!match) return { speaker: fragment.label, text: body };

  return {
    speaker: match[1],
    text: match[2],
  };
}

function renderPlainFragments(file: CaseFile): string {
  const text = file.fragments.map((fragment) => getFragmentView(file, fragment).body).join('\n\n');

  return `
    <article class="record-body record-body--plain">
      <pre>${escapeHtml(text)}</pre>
    </article>
  `;
}

function renderArticleFragments(file: CaseFile): string {
  return `
    <article class="record-body record-body--article">
      ${file.fragments
        .map((fragment) => {
          const view = getFragmentView(file, fragment);
          const redactedClass = view.isRedacted ? ' is-redacted' : '';

          return `
            <section class="record-section${redactedClass}">
              <h3>${fragment.label}</h3>
              <p>${view.body}</p>
            </section>
          `;
        })
        .join('')}
    </article>
  `;
}

function renderLogFragments(file: CaseFile): string {
  return `
    <div class="section-title">
      <span>事件日志</span>
      <span>LOG</span>
    </div>
    <ol class="fragments fragments--log">
      ${file.fragments
        .map((fragment) => {
          const view = getFragmentView(file, fragment);
          const redactedClass = view.isRedacted ? ' class="is-redacted"' : '';
          const line = splitLogLine(view.body);

          return `
            <li${redactedClass}>
              <time>${line.marker}</time>
              <span>
                <strong>${fragment.label}</strong>
                ${line.text}
              </span>
            </li>
          `;
        })
        .join('')}
    </ol>
  `;
}

function renderFormFragments(file: CaseFile): string {
  return `
    <dl class="record-body record-body--form">
      ${file.fragments
        .map((fragment) => {
          const view = getFragmentView(file, fragment);
          const redactedClass = view.isRedacted ? ' class="is-redacted"' : '';

          return `
            <div${redactedClass}>
              <dt>${fragment.label}</dt>
              <dd>${view.body}</dd>
            </div>
          `;
        })
        .join('')}
    </dl>
  `;
}

function renderTranscriptFragments(file: CaseFile): string {
  return `
    <article class="record-body record-body--transcript">
      ${file.fragments
        .map((fragment) => {
          const view = getFragmentView(file, fragment);
          const redactedClass = view.isRedacted ? ' is-redacted' : '';
          const line = splitTranscriptLine(fragment, view.body);

          return `
            <section class="transcript-line${redactedClass}">
              <strong>${line.speaker}</strong>
              <p>${line.text}</p>
            </section>
          `;
        })
        .join('')}
    </article>
  `;
}

function renderTableFragments(file: CaseFile): string {
  if (!file.table) return renderArticleFragments(file);
  const introMarkup = file.fragments
    .map((fragment) => {
      const view = getFragmentView(file, fragment);
      const redactedClass = view.isRedacted ? ' is-redacted' : '';

      return `
        <section class="record-section${redactedClass}">
          <h3>${fragment.label}</h3>
          <p>${view.body}</p>
        </section>
      `;
    })
    .join('');

  return `
    <article class="record-body record-body--table">
      ${introMarkup ? `<div class="record-table-intro">${introMarkup}</div>` : ''}
      <div class="record-table-wrap">
        <table class="record-table">
          <thead>
            <tr>
              ${file.table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${file.table.rows
              .map(
                (row) => `
                  <tr>
                    ${file.table!.columns
                      .map((_, columnIndex) => `<td>${escapeHtml(row[columnIndex] ?? '')}</td>`)
                      .join('')}
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ${file.table.note ? `<p class="record-table-note">${escapeHtml(file.table.note)}</p>` : ''}
    </article>
  `;
}

function renderCaseBody(file: CaseFile): string {
  if (file.presentation === 'plain') return renderPlainFragments(file);
  if (file.presentation === 'log') return renderLogFragments(file);
  if (file.presentation === 'form') return renderFormFragments(file);
  if (file.presentation === 'transcript') return renderTranscriptFragments(file);
  if (file.presentation === 'table') return renderTableFragments(file);

  return renderArticleFragments(file);
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

function renderRecordPlaceholder(): string {
  return `
    <section class="record-panel" aria-label="档案记录">
      <header class="panel-header">
        <div>
          <p class="eyebrow">RECORD</p>
          <h2>等待档案解析</h2>
        </div>
      </header>

      <article class="document-body document-body--empty">
        <p>当前没有打开的档案。请从左侧档案索引中选择一条可解析记录。</p>
      </article>
    </section>
  `;
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
          <span>源文件</span>
          <strong>${getCaseSourcePath(file)}</strong>
        </div>
        <div class="field">
          <span>访问结果</span>
          <strong>授权不足</strong>
        </div>
        <div class="field">
          <span>解析格式</span>
          <strong>.${archiveSourceExtension.toUpperCase()}</strong>
        </div>
      </div>

      <div class="access-panel">
        <p class="eyebrow">ACCESS RULE</p>
        <h3>凭据不满足读取条件</h3>
        <p class="access-panel__teaser">${file.teaser}</p>
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
          <span>源文件</span>
          <strong>${getCaseSourcePath(file)}</strong>
        </div>
        <div class="field">
          <span>记录状态</span>
          <strong>${getReviewLabel(file.reviewStatus)}</strong>
        </div>
        <div class="field">
          <span>解析格式</span>
          <strong>.${archiveSourceExtension.toUpperCase()}</strong>
        </div>
      </div>

      ${renderCaseBody(file)}

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
    .map((utilityApp) => {
      const activeClass = activeUtilityAppId === utilityApp.id ? ' is-active' : '';
      const alertClass = utilityApp.id === 'communications' && unreadThreadIds.size ? ' has-alert' : '';

      return `
        <button class="utility-tab${activeClass}${alertClass}" type="button" data-utility-app="${utilityApp.id}">
          <span>${utilityApp.command}</span>
          <strong>${utilityApp.label}</strong>
        </button>
      `;
    })
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

function clampShortwavePhase(value: number): number {
  const clamped = Math.min(shortwavePhaseMaxRad, Math.max(shortwavePhaseMinRad, value));
  return Math.round(clamped * 1000) / 1000;
}

function formatShortwavePhase(value: number): string {
  return clampShortwavePhase(value).toFixed(3);
}

function tuneShortwavePhase(value: number): void {
  shortwavePhaseRad = clampShortwavePhase(value);
}

function getShortwaveWaterfallJitter(rowIndex: number, columnIndex: number, seed: number): number {
  const jitter = Math.sin((rowIndex + 1) * 12.9898 + (columnIndex + 1) * 78.233 + seed * 37.719) * 43758.5453;
  return jitter - Math.floor(jitter);
}

function getShortwavePhaseDistanceRad(value: number, target: number): number {
  const rawDistance = Math.abs(value - target) % shortwavePhaseMaxRad;
  return Math.min(rawDistance, shortwavePhaseMaxRad - rawDistance);
}

function getShortwaveTargetFrequencyMhz(target: ShortwaveSignalTarget): number {
  return target.centerMhz;
}

function getShortwaveSyncChecksum(target: ShortwaveSignalTarget): string {
  const frequencyCode = Math.round(target.centerMhz * 1000);
  const phaseCode = Math.round(target.phaseRad * 1000);
  const checksum = (frequencyCode * 17 + phaseCode * 70) % 10000;
  return String(checksum).padStart(4, '0');
}

function getShortwaveSyncSignature(target: ShortwaveSignalTarget): string {
  return `RX-SIG-${getShortwaveSyncChecksum(target)}`;
}

function getShortwaveSignalReadings(): ShortwaveSignalReading[] {
  return shortwaveSignalTargets.map((target) => {
    const detuneKhz = (shortwaveFrequencyMhz - getShortwaveTargetFrequencyMhz(target)) * 1000;
    const distanceKhz = Math.abs(detuneKhz);
    const phaseDistanceRad = getShortwavePhaseDistanceRad(shortwavePhaseRad, target.phaseRad);
    const strength = Math.max(0, 1 - distanceKhz / target.detectionRangeKhz);
    const phaseStrength = Math.max(0, 1 - phaseDistanceRad / target.phaseDetectionRangeRad);

    return {
      target,
      detuneKhz,
      distanceKhz,
      phaseDistanceRad,
      phaseStrength,
      strength,
      locked: distanceKhz <= target.lockToleranceKhz && phaseDistanceRad <= target.phaseToleranceRad,
    };
  });
}

function getClosestShortwaveSignal(): ShortwaveSignalReading {
  return getShortwaveSignalReadings().sort(
    (a, b) => a.distanceKhz - b.distanceKhz || a.phaseDistanceRad - b.phaseDistanceRad,
  )[0];
}

function getShortwaveKnobAngle(): number {
  const range = shortwaveMaxMhz - shortwaveMinMhz;
  const ratio = (shortwaveFrequencyMhz - shortwaveMinMhz) / range;
  return Math.round(-135 + ratio * 270);
}

function getShortwaveSignalBars(): string {
  const reading = getClosestShortwaveSignal();
  const litBars = reading.locked ? 6 : Math.max(1, Math.ceil(reading.strength * 6));

  return Array.from({ length: 6 }, (_, index) => `<span class="${index < litBars ? 'is-lit' : ''}"></span>`).join('');
}

function formatShortwaveLogTimestamp(): string {
  const totalSeconds = 17 * 60 + Math.max(0, shortwaveLogSequence - 6) * 7;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function appendShortwaveLog(tone: ShortwaveLogTone, message: string): void {
  shortwaveLogSequence += 1;
  shortwaveLogEntries.push({
    id: shortwaveLogSequence,
    tone,
    message: `${formatShortwaveLogTimestamp()} ${message}`,
  });
}

function clearShortwaveReceptionTimer(): void {
  if (shortwaveReceptionTimerId === undefined) return;

  window.clearTimeout(shortwaveReceptionTimerId);
  shortwaveReceptionTimerId = undefined;
}

function shouldRunShortwaveReceptionStream(): boolean {
  return appView === 'archive' && workspaceView === 'records' && activeUtilityAppId === 'shortwave';
}

function getShortwaveReceptionModeKey(reading: ShortwaveSignalReading): string {
  if (reading.locked) return `lock:${reading.target.id}`;
  if (reading.strength >= 0.72) return `carrier:${reading.target.id}`;
  if (reading.strength >= 0.38) return `weak:${reading.target.id}`;
  return 'noise';
}

function updateShortwaveReceptionMode(reading: ShortwaveSignalReading): void {
  const nextModeKey = getShortwaveReceptionModeKey(reading);
  if (nextModeKey === shortwaveReceptionModeKey) return;

  shortwaveReceptionModeKey = nextModeKey;
  shortwaveReceptionMessageCursor = 0;
}

function formatShortwaveReceptionMessage(message: string, reading: ShortwaveSignalReading): string {
  return message
    .replaceAll('{frequency}', formatShortwaveFrequency(shortwaveFrequencyMhz))
    .replaceAll('{phase}', formatShortwavePhase(shortwavePhaseRad))
    .replaceAll('{signature}', getShortwaveSyncSignature(reading.target))
    .replaceAll('{reportName}', reading.target.reportName)
    .replaceAll('{keyFormat}', reading.target.keyFormat)
    .replaceAll('{label}', reading.target.label);
}

function appendNextShortwaveReceptionMessage(messages: ShortwaveReceptionMessage[], reading: ShortwaveSignalReading): void {
  if (messages.length === 0) return;

  const message = messages[shortwaveReceptionMessageCursor % messages.length];
  shortwaveReceptionMessageCursor += 1;
  appendShortwaveLog(message.tone, formatShortwaveReceptionMessage(message.message, reading));
}

function recordShortwaveReceptionTick(): void {
  const reading = getClosestShortwaveSignal();
  updateShortwaveReceptionMode(reading);

  if (reading.locked) {
    if (shortwaveLastLockedTargetId !== reading.target.id) {
      shortwaveLastLockedTargetId = reading.target.id;
      reading.target.lockedIntroMessages.forEach((message) => {
        appendShortwaveLog(message.tone, formatShortwaveReceptionMessage(message.message, reading));
      });
      shortwaveReceptionMessageCursor = 0;
      return;
    }

    appendNextShortwaveReceptionMessage(reading.target.lockedLoopMessages, reading);
    return;
  }

  if (shortwaveLastLockedTargetId) {
    appendShortwaveLog('scan', '帧同步丢失，接收器返回扫描状态。');
    shortwaveLastLockedTargetId = '';
  }

  if (reading.strength >= 0.72) {
    appendNextShortwaveReceptionMessage(reading.target.carrierMessages, reading);
    return;
  }

  if (reading.strength >= 0.38) {
    appendNextShortwaveReceptionMessage(reading.target.weakMessages, reading);
    return;
  }

  appendNextShortwaveReceptionMessage(shortwaveDefaultReceptionMessages, reading);
}

function scheduleShortwaveReceptionTick(delayMs: number): void {
  clearShortwaveReceptionTimer();
  if (!shouldRunShortwaveReceptionStream()) return;

  shortwaveReceptionTimerId = window.setTimeout(() => {
    shortwaveReceptionTimerId = undefined;
    if (!shouldRunShortwaveReceptionStream()) return;

    recordShortwaveReceptionTick();
    render();
  }, delayMs);
}

function restartShortwaveReceptionStream(): void {
  updateShortwaveReceptionMode(getClosestShortwaveSignal());
  scheduleShortwaveReceptionTick(shortwaveReceptionInitialDelayMs);
}

function syncShortwaveReceptionTimer(): void {
  if (!shouldRunShortwaveReceptionStream()) {
    clearShortwaveReceptionTimer();
    return;
  }

  if (shortwaveReceptionTimerId === undefined) {
    scheduleShortwaveReceptionTick(shortwaveReceptionIntervalMs);
  }
}

function renderHighlightedShortwaveMessage(message: string): string {
  return escapeHtml(message)
    .replace(/(RX-SIG-\d{4})/g, '<strong class="shortwave-token shortwave-token--key">$1</strong>')
    .replace(/(REPORT_[A-Z0-9_]+\.enc)/g, '<strong class="shortwave-token shortwave-token--report">$1</strong>')
    .replace(/(JANUS-0719-\{四位校验码\}|JANUS-0719-\d{4})/g, '<strong class="shortwave-token shortwave-token--key">$1</strong>')
    .replace(/(\d+\.\d{3} MHz|\d+\.\d{3} rad)/g, '<span class="shortwave-token shortwave-token--value">$1</span>')
    .replace(/(帧同步完成|帧同步保持|报告名称|密钥格式|同步签名|已解锁|接收缓存稳定)/g, '<strong class="shortwave-token shortwave-token--event">$1</strong>');
}

function renderShortwaveLogEntries(): string {
  return shortwaveLogEntries
    .map(
      (entry) => `
        <p class="shortwave-log-entry shortwave-log-entry--${entry.tone}">
          ${renderHighlightedShortwaveMessage(entry.message)}
        </p>
      `,
    )
    .join('');
}

function renderShortwaveWaterfall(reading: ShortwaveSignalReading): string {
  const strength = Number(reading.strength.toFixed(3));
  const carrierStrength = Math.max(0, Math.min(1, (strength - 0.36) / 0.64));
  const pulseStrength = carrierStrength * (0.35 + reading.phaseStrength * 0.65);
  const detuneRatio = Math.max(-1, Math.min(1, reading.detuneKhz / reading.target.detectionRangeKhz));
  const signalCenter = (shortwaveWaterfallColumns - 1) / 2 - detuneRatio * shortwaveWaterfallColumns * 0.42;
  const carrierWidth = 0.58 + pulseStrength * 0.86;
  const rowBurstPattern = [0.2, 0.58, 0.32, 0.92, 0.26, 0.74, 0.42, 0.86, 0.24];
  const noisePattern = [0.16, 0.24, 0.13, 0.28, 0.19, 0.34, 0.12, 0.23, 0.31, 0.15, 0.26, 0.2];
  const jitterSeed = Math.random();

  const cells = Array.from({ length: shortwaveWaterfallRows }, (_, rowIndex) =>
    Array.from({ length: shortwaveWaterfallColumns }, (_, columnIndex) => {
      const rowJitter = getShortwaveWaterfallJitter(rowIndex, -1, jitterSeed);
      const signalJitter = getShortwaveWaterfallJitter(rowIndex, columnIndex, jitterSeed);
      const noiseJitter = getShortwaveWaterfallJitter(rowIndex + 11, columnIndex + 7, jitterSeed);
      const burstJitter = getShortwaveWaterfallJitter(rowIndex + 23, columnIndex + 17, jitterSeed);
      const timingJitter = getShortwaveWaterfallJitter(rowIndex + 37, columnIndex + 29, jitterSeed);
      const rowOffset = (rowJitter - 0.5) * (0.18 + pulseStrength * 0.28);
      const columnDistance = Math.abs(columnIndex - signalCenter - rowOffset);
      const carrier = Math.max(0, 1 - columnDistance / carrierWidth) * pulseStrength;
      const sidebandDistance = Math.abs(columnDistance - 2.2);
      const sideband = Math.max(0, 1 - sidebandDistance / 0.86) * pulseStrength * 0.34;
      const rowBurst = Math.max(
        0.08,
        Math.min(1, rowBurstPattern[(rowIndex + shortwaveLogSequence) % rowBurstPattern.length] + (burstJitter - 0.5) * 0.26),
      );
      const dropout = signalJitter < 0.09 ? 0.36 + signalJitter * 4 : 0.78 + signalJitter * 0.42;
      const signal = Math.max(carrier, sideband) * rowBurst * dropout;
      const noise = noisePattern[(rowIndex * 5 + columnIndex * 3) % noisePattern.length] + strength * 0.04 + noiseJitter * 0.13;
      const intensity = Math.max(noise, signal);
      const isHot = signal > 0.56 + noiseJitter * 0.08;
      const isCarrier = signal > 0.21 + burstJitter * 0.08;
      const color = isHot ? '224, 255, 229' : isCarrier ? '83, 243, 138' : signal > 0.07 + signalJitter * 0.05 ? '114, 217, 255' : '43, 126, 104';
      const alphaBase = isCarrier ? Math.min(0.96, 0.34 + intensity * 0.62) : Math.min(0.52, intensity);
      const alpha = Math.max(0.06, Math.min(1, alphaBase + (signalJitter - 0.5) * 0.16));
      const lowAlpha = Math.max(0.08, alpha - (isCarrier ? 0.2 : 0.08));
      const highAlpha = Math.min(1, alpha + (isCarrier ? 0.22 : 0.1));
      const duration = 0.24 + timingJitter * 0.52;
      const delay = -(getShortwaveWaterfallJitter(rowIndex + 41, columnIndex + 5, jitterSeed) * 0.9);

      return `
        <span
          class="${isCarrier ? 'is-carrier' : 'is-noise'}"
          style="--cell-color: ${color}; --cell-alpha: ${alpha.toFixed(3)}; --cell-low-alpha: ${lowAlpha.toFixed(3)}; --cell-high-alpha: ${highAlpha.toFixed(3)}; --cell-duration: ${duration.toFixed(2)}s; --cell-delay: ${delay.toFixed(2)}s"
        ></span>
      `;
    }).join(''),
  ).join('');

  return `
    <div class="waterfall" style="--waterfall-columns: ${shortwaveWaterfallColumns}; --waterfall-rows: ${shortwaveWaterfallRows}" aria-hidden="true">
      ${cells}
    </div>
  `;
}

function renderShortwaveTool(): string {
  const frequency = formatShortwaveFrequency(shortwaveFrequencyMhz);
  const knobAngle = getShortwaveKnobAngle();
  const phase = formatShortwavePhase(shortwavePhaseRad);
  const reading = getClosestShortwaveSignal();
  const reportLocked = reading.locked;
  const reportUnlocked = Boolean(reading.target.documentId && unlockedDocumentIds.has(reading.target.documentId));
  const receiverState = reportUnlocked ? '已解锁' : reportLocked ? '同步' : reading.strength > 0.38 ? '载波' : '扫描';
  const syncSignature = reportLocked ? getShortwaveSyncSignature(reading.target) : 'RX-SIG ----';

  return `
    <div class="shortwave-tuner">
      <div class="tuner-dial">
        <button class="tuning-knob" type="button" data-shortwave-knob style="--knob-angle: ${knobAngle}deg" aria-label="中心频率旋钮">
          <span></span>
        </button>
        <span>中心频率旋钮</span>
      </div>
      <label class="frequency-input">
        <span>中心频率 / MHz</span>
        <input type="text" inputmode="decimal" value="${frequency}" data-shortwave-frequency aria-label="短波频率" />
      </label>
      <label class="phase-control">
        <span>相位校准 / rad</span>
        <div class="phase-control__row">
          <input type="range" min="${shortwavePhaseMinRad}" max="${shortwavePhaseMaxRad}" step="0.001" value="${phase}" data-shortwave-phase aria-label="相位校准" />
          <button type="button" data-phase-step="-${shortwavePhaseStepRad}" aria-label="相位减少 ${formatShortwavePhase(shortwavePhaseStepRad)}">-0.010</button>
          <button type="button" data-phase-step="${shortwavePhaseStepRad}" aria-label="相位增加 ${formatShortwavePhase(shortwavePhaseStepRad)}">+0.010</button>
        </div>
      </label>
      <div class="phase-readout">
        <span>同步签名</span>
        <strong>${syncSignature}</strong>
        <input type="text" inputmode="decimal" value="${phase}" data-shortwave-phase-value aria-label="相位读数" />
      </div>
      <div class="receiver-state">
        <span>模式</span>
        <strong>AM / NARROW</strong>
        <em>${receiverState}</em>
      </div>
    </div>

    <div class="shortwave-signal" style="--signal-haze-alpha: ${(0.02 + reading.strength * 0.08).toFixed(3)}">
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

    <div class="shortwave-buffer" data-shortwave-log role="log" aria-label="接收内容">
      ${renderShortwaveLogEntries()}
    </div>

    ${renderShortwaveWaterfall(reading)}
  `;
}

function renderCommunicationsTool(): string {
  const threadRows = chatThreads
    .map((thread) => {
      const selected = thread.id === selectedThreadId ? 'is-active' : '';
      const unread = unreadThreadIds.has(thread.id);
      const unreadClass = unread ? 'thread-row--unread' : '';
      const access = evaluateAccess(profile, thread.access);

      return `
        <article class="thread-row ${selected} ${unreadClass}">
          ${renderContactAvatar(thread)}
          <button class="thread-row__open" type="button" data-thread-id="${thread.id}">
            <strong>${thread.contactName}</strong>
            <span>${thread.subtitle}</span>
          </button>
          <em>${unread ? 'NEW' : access.allowed ? getThreadKindLabel(thread) : 'LOCKED'}</em>
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

function renderRecordsWorkspace(activeFile: CaseFile | undefined): string {
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
          <input type="text" value="" aria-label="档案搜索" autocomplete="off" />
        </div>
        <nav class="file-list">
          ${renderFileList()}
        </nav>
      </aside>

      ${activeFile ? renderActiveFile(activeFile) : renderRecordPlaceholder()}

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
  const animationClass = usbNoticeShouldAnimate ? ' usb-notice--entering' : '';
  usbNoticeShouldAnimate = false;

  return `
    <aside class="usb-notice${animationClass}" aria-label="外接介质检测">
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

function renderCommunicationNotice(): string {
  if (!showCommunicationNotice) return '';

  return `
    <aside class="comm-notice" aria-label="通信消息提示">
      <div>
        <p class="eyebrow">SECURE-COMM</p>
        <h2>${delayedChatDelivery.noticeTitle}</h2>
      </div>
      <p>${delayedChatDelivery.noticeBody}</p>
      <div class="comm-notice__actions">
        <button type="button" data-comm-notice-action="open">打开通信</button>
        <button type="button" data-comm-notice-action="dismiss">稍后处理</button>
      </div>
    </aside>
  `;
}

function renderTerminalLine(): string {
  const parseableCaseFiles = getParseableCaseFiles();
  const readableCount = parseableCaseFiles.filter((file) => evaluateAccess(profile, file.access).allowed).length;
  const solvedCount = parseableCaseFiles.filter((file) => file.reviewStatus === 'solved').length;
  const workspaceLabel = workspaceView === 'files' ? 'FILE MANAGER' : `RECORDS / ${activeUtilityAppId.toUpperCase()}`;
  return `SYS: ${parseableCaseFiles.length} RECORDS / ${readableCount} READABLE / ${solvedCount} VERIFIED / ${workspaceLabel} / ROLE ${getRoleShortName(profile.activeRole)}`;
}

function bindArchiveEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-workspace-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.workspaceView;
      if (view !== 'files' && view !== 'records') return;
      workspaceView = view;
      if (workspaceView === 'records' && activeUtilityAppId === 'shortwave') {
        restartShortwaveReceptionStream();
      } else {
        clearShortwaveReceptionTimer();
      }
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-utility-app]').forEach((button) => {
    button.addEventListener('click', () => {
      const appId = button.dataset.utilityApp;
      if (appId !== 'shortwave' && appId !== 'communications' && appId !== 'clock') return;

      activeUtilityAppId = appId;
      workspaceView = 'records';
      if (appId === 'shortwave') {
        restartShortwaveReceptionStream();
      } else {
        clearShortwaveReceptionTimer();
      }
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
      fileSearchNotice = '';
      documentUnlockError = '';
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-document-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const documentId = button.dataset.documentId;
      const directoryId = button.dataset.documentDirectoryId;
      const isSelectedDocument = Boolean(
        documentId && documentId === selectedDocumentId && (!directoryId || directoryId === selectedDirectoryId),
      );

      if (isSelectedDocument) {
        selectedDocumentId = '';
        documentUnlockError = '';
        render();
        return;
      }

      if (directoryId) selectedDirectoryId = directoryId;
      selectedDocumentId = documentId ?? selectedDocumentId;
      fileSearchQuery = '';
      fileSearchNotice = '';
      documentUnlockError = '';
      render();
    });
  });

  const fileSearchForm = document.querySelector<HTMLFormElement>('#fileSearchForm');
  fileSearchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(fileSearchForm);
    fileSearchQuery = String(formData.get('fileSearch') ?? '').trim();
    fileSearchNotice = getHiddenRevealNotice(revealHiddenDocumentsForRecoveryCode(fileSearchQuery));
    selectedDocumentId = '';
    documentUnlockError = '';
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-file-search-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      fileSearchQuery = '';
      fileSearchNotice = '';
      documentUnlockError = '';
      render();
    });
  });

  const documentUnlockForm = document.querySelector<HTMLFormElement>('#documentUnlockForm');
  documentUnlockForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const directory = getSelectedDirectory();
    const document = directory ? getSelectedDocument(directory) : undefined;
    if (!document?.unlock) return;

    const formData = new FormData(documentUnlockForm);
    const submittedKey = String(formData.get('documentKey') ?? '').trim().toUpperCase();
    const expectedKey = document.unlock.key.toUpperCase();

    if (submittedKey !== expectedKey) {
      documentUnlockError = document.unlock.failureMessage;
      render();
      return;
    }

    unlockedDocumentIds.add(document.id);
    documentUnlockError = '';

    if (document.unlock.discoveredFlag && !profile.discoveredFlags.includes(document.unlock.discoveredFlag)) {
      profile.discoveredFlags.push(document.unlock.discoveredFlag);
    }

    if (document.unlock.solvedPuzzleId && !profile.solvedPuzzles.includes(document.unlock.solvedPuzzleId)) {
      profile.solvedPuzzles.push(document.unlock.solvedPuzzleId);
    }

    appendShortwaveLog('success', `报告状态：已解锁。${document.name}.${document.extension} 已登记到本次会话。`);
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-file-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const fileId = button.dataset.fileId;
      selectedFileId = fileId === selectedFileId ? '' : fileId ?? selectedFileId;
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
      markThreadRead(selectedThreadId);
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

  document.querySelectorAll<HTMLInputElement>('[data-shortwave-phase]').forEach((input) => {
    input.addEventListener('change', () => {
      tuneShortwavePhase(Number.parseFloat(input.value));
      restartShortwaveReceptionStream();
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-shortwave-phase-value]').forEach((input) => {
    const commitPhase = () => {
      const value = Number.parseFloat(input.value);
      if (Number.isNaN(value)) {
        input.value = formatShortwavePhase(shortwavePhaseRad);
        return;
      }

      tuneShortwavePhase(value);
      restartShortwaveReceptionStream();
      render();
    };

    input.addEventListener('change', commitPhase);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitPhase();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-phase-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const step = Number.parseFloat(button.dataset.phaseStep ?? '0');
      tuneShortwavePhase(shortwavePhaseRad + step);
      restartShortwaveReceptionStream();
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
      restartShortwaveReceptionStream();
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
        tuneShortwaveFrequency(shortwaveFrequencyMhz + (event.deltaY > 0 ? -0.001 : 0.001));
        restartShortwaveReceptionStream();
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
        previewFrequency(startFrequency + deltaX * shortwaveFrequencyDragSensitivityMhz);
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        if (!moved) tuneShortwaveFrequency(startFrequency + 0.001);
        restartShortwaveReceptionStream();
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

      dismissUsbNotice();
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-comm-notice-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.commNoticeAction === 'open') {
        openDelayedCommunicationThread();
        return;
      }

      showCommunicationNotice = false;
      render();
    });
  });
}

function keepShortwaveLogAtLatest(): void {
  const log = document.querySelector<HTMLElement>('[data-shortwave-log]');
  if (!log) return;

  log.scrollTop = log.scrollHeight;
}

function keepChatLogAtLatest(): void {
  const log = document.querySelector<HTMLElement>('.chat-log');
  if (!log) return;

  log.scrollTop = log.scrollHeight;
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

  const parseableCaseFiles = getParseableCaseFiles();
  const activeFile = parseableCaseFiles.find((file) => file.id === selectedFileId);
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
      ${renderCommunicationNotice()}

      <footer class="terminal-bar">
        <span>${renderTerminalLine()}</span>
        <span>F1 HELP / F2 SESSION LOG / F3 INDEX</span>
      </footer>
    </main>
  `;

  bindArchiveEvents();
  keepShortwaveLogAtLatest();
  keepChatLogAtLatest();
  syncShortwaveReceptionTimer();
}

startBootSequence();
