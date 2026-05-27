import type { VirtualDirectory, VirtualDocument, VirtualVolume } from '../domain/types';

export const virtualVolumes: VirtualVolume[] = [
  {
    id: 'local-cache',
    label: '本地缓存',
    deviceName: 'CACHE-0719',
    mountPath: 'CACHE://LOCAL',
    status: 'mounted',
    description: '会话恢复后挂载的只读本地缓存。',
    rootDirectoryId: 'local-root',
  },
  {
    id: 'usb-aurora',
    label: '外接介质',
    deviceName: 'USB_AURORA_1907',
    mountPath: 'USB://AURORA-1907',
    status: 'detected',
    description: '登录后接入的只读外部存储镜像。',
    rootDirectoryId: 'usb-root',
  },
];

export const virtualDirectories: VirtualDirectory[] = [
  {
    id: 'local-root',
    volumeId: 'local-cache',
    name: 'LOCAL',
    path: 'CACHE://LOCAL/',
    fileIds: ['local-session-log'],
  },
  {
    id: 'usb-root',
    volumeId: 'usb-aurora',
    name: 'USB_AURORA_1907',
    path: 'USB://AURORA-1907/',
    fileIds: ['commission-brief'],
  },
];

export const virtualDocuments: VirtualDocument[] = [
  {
    id: 'local-session-log',
    directoryId: 'local-root',
    name: 'SESSION_RECOVERY',
    extension: 'LOG',
    modified: '-1162-00-00 00:09',
    sizeLabel: '3.1 KB',
    classification: 'LOCAL / READ ONLY',
    summary: '账号恢复流程留下的本地缓存日志。',
    body: [
      '会话恢复完成。',
      '账号：访客#0719。',
      '本地时钟未校准，历史时间戳不可作为证据。',
      '外接介质检测服务已启动。',
    ],
    tags: ['会话', '缓存', '时间异常'],
  },
  {
    id: 'commission-brief',
    directoryId: 'usb-root',
    name: '委托书_文化部_优先级A+',
    extension: 'txt',
    modified: '1907-07-19 03:17',
    sizeLabel: '9.2 KB',
    classification: 'MINISTRY / PRIORITY A+',
    summary: '文化部旧文明遗存移交委托书，说明当前身份、任务和外接介质处理边界。',
    body: [
      '洛林尼亚共和国文化部',
      '旧文明遗产司 / 第三考古室',
      '文件编号：MC-OCA-0719-A+',
      '收件人：临时接入员 0719',
      '主题：关于 AURORA-1907 外接介质的只读整理委托',
      '你已经通过“访客#0719”的只读会话进入旧文明终端。该账号不是你的正式职衔，也不代表行政授权；它只是目前能够读取这组镜像材料的最低访问入口。',
      '文化部旧文明遗产司委托你整理此枚外接介质中的可读资料。请记录每一份可见文档的题名、时间戳、署名、所在目录，以及任何与档案局访问记录相互矛盾的条目。',
      '请注意：本介质是在终端登录完成后由现场执行人接入。当前文件管理器显示的是只读镜像，不得改写、重命名或用共和国现行历法校正旧文明日期。缺年、负年、失效时钟与重复纪日都应作为原始证据保留。',
      '共和国现有技术以蒸汽机、金属活字、精密测绘仪和有线电报为基础。旧文明文档中的“服务器”“终端”“加密”“权限”等词，请按原文记录；无法解释的词汇应提交术语表，不要替换成工部或学院的近似说法。',
      '你的直接任务如下：第一，读取根目录内全部可见文档；第二，对照黑箱档案局记录，确认原账号主人曾触达哪些档案；第三，标出任何不符合正常时间线的访问行为，尤其是发生在系统时钟失效前后的条目。',
      '原账号主人身份尚未核准。现有材料只显示编号 0719 曾多次以“访客”名义出现。未经复核，不得将其推定为馆员、技术师、逃亡者或旧文明残存者。',
      '若后续文件要求更高权限，你只需登记其存在与访问条件。不要尝试破坏介质，也不要向终端提交会改变原始记录的指令。文化部需要可核验的证据链，而不是新的传说。',
      '签发单位：洛林尼亚共和国文化部旧文明遗产司',
      '签发人：伊莲娜·韦斯特，第三考古室主任书记官',
      '签发地点：灰港，文化部钟塔办公楼',
      '签发日期：共和国历 312 年 7 月 19 日',
    ],
    tags: ['文化部', '委托', '旧文明考据', '外接介质', '时间异常'],
  },
];
