import './styles.css';

type FileStatus = 'locked' | 'open' | 'solved';

type CaseFile = {
  id: string;
  code: string;
  title: string;
  unit: string;
  date: string;
  status: FileStatus;
  clearance: string;
  summary: string;
  fragments: string[];
  clue: string;
};

type ChatMessage = {
  from: 'operator' | 'contact' | 'system';
  text: string;
  time: string;
};

const caseFiles: CaseFile[] = [
  {
    id: 'a17',
    code: 'A-17',
    title: '失联观测站',
    unit: '外勤记录 / 北线',
    date: '1997-11-03',
    status: 'open',
    clearance: 'L2',
    summary:
      '三号观测站在风暴前切断外部通信。最后一条自动上报只包含一组异常气压读数和一句被截断的值班备注。',
    fragments: [
      '23:41 备用电源切换成功。',
      '23:58 主天线转向 061 度，非计划动作。',
      '00:12 值班员备注：不要相信灯塔给出的第二个坐标。',
    ],
    clue: '061 并不一定是方向，也可能是档案编号。',
  },
  {
    id: 'b04',
    code: 'B-04',
    title: '匿名信件批次',
    unit: '文档复核 / 城区',
    date: '2002-04-18',
    status: 'locked',
    clearance: 'L3',
    summary:
      '同一台打字机留下了七封匿名信。前六封内容互相矛盾，第七封只写了收件人的旧职位。',
    fragments: [
      '纸张边缘有重复裁切痕。',
      '第七封信没有署名，但邮戳时间早于其余信件。',
      '归档员手写备注：先问沈医生，他知道“旧职位”指谁。',
    ],
    clue: '聊天记录可能会给出第一把钥匙。',
  },
  {
    id: 'c61',
    code: 'C-61',
    title: '灯塔维修单',
    unit: '资产维护 / 海岸',
    date: '1988-09-21',
    status: 'open',
    clearance: 'L2',
    summary:
      '维修单显示灯塔透镜在失踪案发生前被人为调暗。维护日志中有一段被删去的验收码。',
    fragments: [
      '更换件：二级透镜、旧式调光盘、短波收发模块。',
      '验收人签名只留下两个字母：S.D.',
      '验收码字段被涂黑，但涂黑长度为四位。',
    ],
    clue: '四位验收码不一定来自维修单本身。',
  },
  {
    id: 'd12',
    code: 'D-12',
    title: '内部通话节录',
    unit: '监听转写 / 未核验',
    date: '2010-06-09',
    status: 'solved',
    clearance: 'L1',
    summary:
      '这份节录被反复调用，因为它首次出现了“黑箱档案局”这个内部代称。转写质量很差，但语气不像伪造。',
    fragments: [
      '甲：把钥匙放回档案柜，不要交给外勤。',
      '乙：那如果他们已经看见坐标？',
      '甲：让他们以为自己卡关了。',
    ],
    clue: '这是一份教学档案，用来暗示游戏不会故意卡死玩家。',
  },
];

const chatMessages: ChatMessage[] = [
  {
    from: 'system',
    text: '安全信道已建立。当前会话不会上传至中央档案库。',
    time: '00:01',
  },
  {
    from: 'contact',
    text: '你现在能看到 A-17 和 C-61，对吧？先别急着解锁 B-04。灯塔那份维修单里有个名字缩写。',
    time: '00:03',
  },
  {
    from: 'operator',
    text: 'S.D. 是谁？',
    time: '00:04',
  },
  {
    from: 'contact',
    text: '沈医生。以前不叫医生，档案里写的是“声学顾问”。匿名信第七封应该和他有关。',
    time: '00:05',
  },
  {
    from: 'contact',
    text: '如果某处需要四位码，先试着把“061”当作档案编号，而不是角度。',
    time: '00:08',
  },
];

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

const root = app;
let selectedFileId = caseFiles[0].id;

function getStatusLabel(status: FileStatus): string {
  if (status === 'solved') return '已复核';
  if (status === 'locked') return '权限不足';
  return '可查阅';
}

function renderFileList(): string {
  return caseFiles
    .map((file) => {
      const selected = file.id === selectedFileId ? 'is-selected' : '';
      return `
        <button class="file-row ${selected}" type="button" data-file-id="${file.id}">
          <span class="file-row__code">${file.code}</span>
          <span class="file-row__main">
            <span class="file-row__title">${file.title}</span>
            <span class="file-row__meta">${file.unit}</span>
          </span>
          <span class="status-pill status-pill--${file.status}">${getStatusLabel(file.status)}</span>
        </button>
      `;
    })
    .join('');
}

function renderFragments(file: CaseFile): string {
  return file.fragments
    .map(
      (fragment, index) => `
        <li>
          <span class="fragment-index">${String(index + 1).padStart(2, '0')}</span>
          <span>${fragment}</span>
        </li>
      `,
    )
    .join('');
}

function renderChat(): string {
  return chatMessages
    .map(
      (message) => `
        <article class="chat-message chat-message--${message.from}">
          <div class="chat-message__meta">
            <span>${message.from === 'operator' ? '调查员' : message.from === 'contact' ? '线人' : '系统'}</span>
            <time>${message.time}</time>
          </div>
          <p>${message.text}</p>
        </article>
      `,
    )
    .join('');
}

function renderActiveFile(file: CaseFile): string {
  return `
    <section class="record-panel" aria-label="当前档案">
      <header class="panel-header">
        <div>
          <p class="eyebrow">ACTIVE FILE</p>
          <h2>${file.code} / ${file.title}</h2>
        </div>
        <div class="clearance-block">
          <span>权限</span>
          <strong>${file.clearance}</strong>
        </div>
      </header>

      <div class="record-grid">
        <div class="field">
          <span>归档日期</span>
          <strong>${file.date}</strong>
        </div>
        <div class="field">
          <span>状态</span>
          <strong>${getStatusLabel(file.status)}</strong>
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

function renderTerminalLine(): string {
  const openCount = caseFiles.filter((file) => file.status === 'open').length;
  const solvedCount = caseFiles.filter((file) => file.status === 'solved').length;
  return `SYS: ${caseFiles.length} FILES MOUNTED / ${openCount} OPEN / ${solvedCount} VERIFIED / LOCAL SAVE READY`;
}

function render(): void {
  const activeFile = caseFiles.find((file) => file.id === selectedFileId) ?? caseFiles[0];

  root.innerHTML = `
    <main class="archive-shell">
      <div class="scanlines" aria-hidden="true"></div>
      <header class="topbar">
        <div class="brand-block">
          <span class="brand-mark">BB</span>
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
          <div class="search-strip">
            <span>QUERY</span>
            <input type="text" value="北线 灯塔 匿名信" aria-label="档案搜索" />
          </div>
          <nav class="file-list">
            ${renderFileList()}
          </nav>
        </aside>

        ${renderActiveFile(activeFile)}

        <aside class="chat-panel" aria-label="聊天线索">
          <header class="panel-header panel-header--compact">
            <div>
              <p class="eyebrow">SECURE CHAT</p>
              <h2>线人通信</h2>
            </div>
            <span class="online-dot" title="在线"></span>
          </header>
          <div class="chat-log">
            ${renderChat()}
          </div>
          <form class="chat-input">
            <input type="text" value="询问：沈医生的旧职位" aria-label="聊天输入" />
            <button type="button">发送</button>
          </form>
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
