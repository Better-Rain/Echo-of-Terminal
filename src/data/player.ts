import type { PlayerProfile } from '../domain/types';

export const currentProfile: PlayerProfile = {
  id: 'player-local-01',
  displayName: '临时调查员',
  activeRole: 'fieldAnalyst',
  roles: ['fieldAnalyst', 'trainee'],
  clearanceLevel: 2,
  permissions: ['case:read', 'case:read-redacted', 'chat:read', 'chat:message', 'hint:view'],
  discoveredFlags: ['intro.chat.sd-known'],
  solvedPuzzles: ['tutorial.key-returned'],
};
