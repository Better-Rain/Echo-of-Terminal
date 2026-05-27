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
    description: '登录后检测到的未知来源存储介质。',
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
    name: '委托说明',
    extension: 'TXT',
    modified: '1907-07-19 03:17',
    sizeLabel: '6.4 KB',
    classification: 'CLIENT / READ ONLY',
    summary: '外接介质根目录中的委托文档。内容说明当前任务、账号身份和后续访问边界。',
    body: [
      '致接入者：',
      '如果你能打开这份文档，说明“访客#0719”的会话恢复已经通过。该账号并非管理员账号，只保留最小读取权限。',
      '你当前看到的文件管理器是隔离镜像，不会写回原始介质。任何异常时间戳、缺失年份或负数纪年都应保留，不要手动修正。',
      '委托目标：整理这枚外接介质中的可读记录，确认账号原主人曾经访问过哪些档案，以及哪些访问行为不符合正常时间线。',
      '账号原主人身份暂未确认。现有线索只显示其曾被系统称为“访客”，并在多次记录中与编号 0719 绑定。',
      '第一步：从本介质根目录开始，读取所有可见文档；第二步：交叉核对档案系统中的记录状态；第三步：记录任何与时间服务失效相关的矛盾。',
    ],
    tags: ['委托', '身份', '外接介质', '时间异常'],
  },
];
