import type { ChatThread } from '../domain/types';

export const chatThreads: ChatThread[] = [
  {
    id: 'sable-operator',
    title: '线人通信',
    contactName: 'SABLE',
    channel: 'SECURE CHAT / NODE-07',
    access: {
      minClearance: 1,
      permissions: ['chat:read'],
    },
    messages: [
      {
        id: 'sable-system-open',
        from: 'system',
        speaker: '系统',
        text: '安全信道已建立。当前会话不会上传至中央档案库。',
        time: '00:01',
      },
      {
        id: 'sable-a17-c61',
        from: 'contact',
        speaker: '线人',
        text: '你现在能看到 A-17 和 C-61，对吧？先别急着解锁 B-04。灯塔那份维修单里有个名字缩写。',
        time: '00:03',
      },
      {
        id: 'operator-sd',
        from: 'operator',
        speaker: '调查员',
        text: 'S.D. 是谁？',
        time: '00:04',
      },
      {
        id: 'sable-sd-role',
        from: 'contact',
        speaker: '线人',
        text: '沈医生。以前不叫医生，档案里写的是“声学顾问”。匿名信第七封应该和他有关。',
        time: '00:05',
      },
      {
        id: 'sable-061',
        from: 'contact',
        speaker: '线人',
        text: '如果某处需要四位码，先试着把“061”当作档案编号，而不是角度。',
        time: '00:08',
      },
      {
        id: 'sable-redacted',
        from: 'contact',
        speaker: '线人',
        text: '档案管理员的临时授权口令和第七封信有关。',
        time: '00:11',
        access: {
          permissions: ['case:read-restricted'],
          note: '需要限制字段读取权限。',
        },
        redactedText: '权限不足：后续内容被会话网关遮蔽。',
      },
    ],
  },
];
