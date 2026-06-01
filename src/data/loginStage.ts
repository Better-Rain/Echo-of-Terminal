import type { LoginStageConfig } from '../domain/types';

export const loginStage: LoginStageConfig = {
  id: 'stage-01-terminal-login',
  scanDurationMs: 5600,
  successDurationMs: 2200,
  scanLines: [
    {
      tag: '系统自检',
      text: '硬件完整性：97%',
    },
    {
      tag: '存储介质',
      text: '检测到历史操作记录……',
    },
    {
      tag: '时间服务',
      text: '正在连接授时中心（1/3）……',
      tone: 'warning',
      updates: [
        '正在连接授时中心（1/3）……',
        '正在连接授时中心（2/3）……',
        '正在连接授时中心（3/3）……',
        '远程授时不可达，确定使用本地缓存时间。',
      ],
    },
    {
      tag: '警告',
      text: '本地时钟可能不准确，建议手动校准。',
      tone: 'warning',
      delayMs: 4300,
    },
  ],
  username: '中枢席位#0719',
  usernameHint: '历史核心席位恢复模式 / 席位号不可修改',
  avatarAlt: '核心席位原持有人头像',
  avatarPlaceholder: '核心席位原持有人影像待定',
  passwordLabel: '访问口令',
  securityQuestion: '密保问题：席位编号的后四位是什么？',
  acceptedPasswords: ['0719'],
  lastLogin: '最后登录：-1162年（基于本地缓存时间）',
  lastLoginTooltip: '该时间未经校准，仅供参考',
  failureMessage: '[身份验证] 失败：密保答案不匹配。',
  successLines: [
    {
      tag: '身份验证',
      text: '通过。',
      tone: 'success',
    },
    {
      tag: '权限',
      text: '核心席位已降级为只读镜像，根据《遗迹访问协议》仅授予“只读”访问权限。',
    },
    {
      tag: '通知',
      text: '所有操作将被记录。欢迎回来，中枢席位 0719。',
    },
  ],
};
