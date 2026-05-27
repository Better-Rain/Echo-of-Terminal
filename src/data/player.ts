import type { PlayerProfile } from '../domain/types';

export const currentProfile: PlayerProfile = {
  id: 'player-local-01',
  displayName: '访客#0719',
  activeRole: 'guest',
  roles: ['guest'],
  clearanceLevel: 2,
  permissions: ['case:read', 'case:read-redacted', 'chat:read', 'hint:view'],
  discoveredFlags: ['intro.chat.sd-known'],
  solvedPuzzles: ['tutorial.key-returned'],
};
