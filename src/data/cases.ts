import type { CaseFile } from '../domain/types';

export const caseFiles: CaseFile[] = [
  {
    id: 'a17',
    code: 'A-17',
    title: '失联观测站',
    unit: '外勤记录 / 北线',
    date: '1997-11-03',
    reviewStatus: 'open',
    classification: 'L2 / FIELD',
    access: {
      minClearance: 2,
      permissions: ['case:read'],
    },
    teaser: '三号观测站在风暴前切断外部通信。',
    summary:
      '三号观测站在风暴前切断外部通信。最后一条自动上报只包含一组异常气压读数和一句被截断的值班备注。',
    fragments: [
      {
        id: 'a17-power',
        label: '电源切换',
        body: '23:41 备用电源切换成功。',
      },
      {
        id: 'a17-antenna',
        label: '天线动作',
        body: '23:58 主天线转向 061 度，非计划动作。',
      },
      {
        id: 'a17-duty-note',
        label: '值班备注',
        body: '00:12 值班员备注：不要相信灯塔给出的第二个坐标。',
      },
    ],
    internalNote: '复核备注：061 字段来源未确认，暂勿按方位角单独归类。',
    linkedThreadIds: ['sable-operator'],
    puzzleIds: ['puzzle-observation-061'],
    tags: ['北线', '坐标', '观测站'],
  },
  {
    id: 'b04',
    code: 'B-04',
    title: '匿名信件批次',
    unit: '文档复核 / 城区',
    date: '2002-04-18',
    reviewStatus: 'sealed',
    classification: 'L3 / ARCHIVE',
    access: {
      minClearance: 3,
      anyRoles: ['archivist', 'director'],
      permissions: ['case:read-restricted'],
      discoveredFlags: ['intro.chat.sd-known'],
      note: '需要档案管理员身份或等价授权。',
    },
    teaser:
      '同一台打字机留下了七封匿名信。公开摘要显示第七封信只写了收件人的旧职位。',
    summary:
      '同一台打字机留下了七封匿名信。前六封内容互相矛盾，第七封只写了收件人的旧职位。',
    fragments: [
      {
        id: 'b04-paper',
        label: '纸张',
        body: '纸张边缘有重复裁切痕。',
      },
      {
        id: 'b04-postmark',
        label: '邮戳',
        body: '第七封信没有署名，但邮戳时间早于其余信件。',
      },
      {
        id: 'b04-archivist-note',
        label: '手写备注',
        body: '归档员手写备注：先问沈医生，他知道“旧职位”指谁。',
      },
    ],
    internalNote: '权限备注：限制字段依赖档案管理员凭据。',
    linkedThreadIds: ['sable-operator'],
    puzzleIds: ['puzzle-archivist-role'],
    tags: ['匿名信', '旧职位', '权限'],
  },
  {
    id: 'c61',
    code: 'C-61',
    title: '灯塔维修单',
    unit: '资产维护 / 海岸',
    date: '1988-09-21',
    reviewStatus: 'open',
    classification: 'L2 / SIGNAL',
    access: {
      minClearance: 2,
      permissions: ['case:read'],
    },
    teaser: '维修单显示灯塔透镜在失踪案发生前被人为调暗。',
    summary:
      '维修单显示灯塔透镜在失踪案发生前被人为调暗。维护日志中有一段被删去的验收码。',
    fragments: [
      {
        id: 'c61-parts',
        label: '更换件',
        body: '更换件：二级透镜、旧式调光盘、短波收发模块。',
      },
      {
        id: 'c61-signature',
        label: '验收人',
        body: '验收人签名只留下两个字母：S.D.',
      },
      {
        id: 'c61-code',
        label: '验收码',
        body: '验收码字段被涂黑，但涂黑长度为四位。',
        access: {
          permissions: ['case:read-restricted'],
          note: '限制字段需要更高档案权限。',
        },
        redactedText: '验收码字段：████',
      },
    ],
    internalNote: '复核备注：验收码来源未在维修单正文中确认。',
    linkedThreadIds: ['sable-operator'],
    puzzleIds: ['puzzle-lighthouse-code'],
    tags: ['灯塔', '维修单', '验收码'],
  },
  {
    id: 'd12',
    code: 'D-12',
    title: '内部通话节录',
    unit: '监听转写 / 未核验',
    date: '2010-06-09',
    reviewStatus: 'solved',
    classification: 'L1 / TRAINING',
    access: {
      minClearance: 1,
      permissions: ['case:read'],
      solvedPuzzles: ['tutorial.key-returned'],
    },
    teaser: '一份用于训练新调查员的内部通话节录。',
    summary:
      '这份节录被反复调用，因为它首次出现了“黑箱档案局”这个内部代称。转写质量很差，但语气不像伪造。',
    fragments: [
      {
        id: 'd12-key',
        label: '钥匙',
        body: '甲：把钥匙放回档案柜，不要交给外勤。',
      },
      {
        id: 'd12-coordinate',
        label: '坐标',
        body: '乙：那如果他们已经看见坐标？',
      },
      {
        id: 'd12-hint',
        label: '训练记录',
        body: '甲：让他们以为自己卡关了。',
      },
    ],
    internalNote: '训练档案：用于说明档案柜访问流程和只读会话边界。',
    linkedThreadIds: [],
    puzzleIds: ['tutorial-key'],
    tags: ['教学', '钥匙', '训练'],
  },
];
