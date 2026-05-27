import type {
  AccessResult,
  AccessRule,
  Permission,
  PlayerProfile,
  RoleDefinition,
  RoleId,
} from './types';

export function evaluateAccess(profile: PlayerProfile, rule: AccessRule = {}): AccessResult {
  const missingRoles = getMissingRoles(profile.roles, rule.anyRoles, rule.allRoles);
  const missingPermissions = getMissingPermissions(profile.permissions, rule.permissions);
  const missingFlags = getMissingStrings(profile.discoveredFlags, rule.discoveredFlags);
  const missingPuzzles = getMissingStrings(profile.solvedPuzzles, rule.solvedPuzzles);
  const missingClearance =
    rule.minClearance !== undefined && profile.clearanceLevel < rule.minClearance
      ? rule.minClearance
      : undefined;

  return {
    allowed:
      missingClearance === undefined &&
      missingRoles.length === 0 &&
      missingPermissions.length === 0 &&
      missingFlags.length === 0 &&
      missingPuzzles.length === 0,
    missingClearance,
    missingRoles,
    missingPermissions,
    missingFlags,
    missingPuzzles,
  };
}

export function findRoleDefinition(
  roles: RoleDefinition[],
  roleId: RoleId,
): RoleDefinition | undefined {
  return roles.find((role) => role.id === roleId);
}

export function formatClearance(level: number): string {
  return `L${level}`;
}

function getMissingRoles(
  profileRoles: RoleId[],
  anyRoles: RoleId[] = [],
  allRoles: RoleId[] = [],
): RoleId[] {
  const missingAllRoles = allRoles.filter((role) => !profileRoles.includes(role));

  if (anyRoles.length === 0 || anyRoles.some((role) => profileRoles.includes(role))) {
    return missingAllRoles;
  }

  return [...missingAllRoles, ...anyRoles];
}

function getMissingPermissions(
  profilePermissions: Permission[],
  permissions: Permission[] = [],
): Permission[] {
  return permissions.filter((permission) => !profilePermissions.includes(permission));
}

function getMissingStrings(profileValues: string[], requiredValues: string[] = []): string[] {
  return requiredValues.filter((value) => !profileValues.includes(value));
}
