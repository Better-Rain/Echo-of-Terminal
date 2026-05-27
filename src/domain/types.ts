export type ClearanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type RoleId =
  | 'guest'
  | 'trainee'
  | 'fieldAnalyst'
  | 'signalOperator'
  | 'archivist'
  | 'director';

export type Permission =
  | 'case:read'
  | 'case:read-redacted'
  | 'case:read-restricted'
  | 'case:unlock'
  | 'chat:read'
  | 'chat:message'
  | 'hint:view'
  | 'session:impersonate';

export type AccessRule = {
  minClearance?: ClearanceLevel;
  anyRoles?: RoleId[];
  allRoles?: RoleId[];
  permissions?: Permission[];
  discoveredFlags?: string[];
  solvedPuzzles?: string[];
  note?: string;
};

export type AccessResult = {
  allowed: boolean;
  missingClearance?: ClearanceLevel;
  missingRoles: RoleId[];
  missingPermissions: Permission[];
  missingFlags: string[];
  missingPuzzles: string[];
};

export type RoleDefinition = {
  id: RoleId;
  name: string;
  shortName: string;
  clearanceCap: ClearanceLevel;
  permissions: Permission[];
  description: string;
};

export type PlayerProfile = {
  id: string;
  displayName: string;
  activeRole: RoleId;
  roles: RoleId[];
  clearanceLevel: ClearanceLevel;
  permissions: Permission[];
  discoveredFlags: string[];
  solvedPuzzles: string[];
};

export type FileReviewStatus = 'new' | 'open' | 'solved' | 'sealed';

export type CaseFragment = {
  id: string;
  label: string;
  body: string;
  access?: AccessRule;
  redactedText?: string;
};

export type CaseFile = {
  id: string;
  code: string;
  title: string;
  unit: string;
  date: string;
  reviewStatus: FileReviewStatus;
  classification: string;
  access: AccessRule;
  teaser: string;
  summary: string;
  fragments: CaseFragment[];
  clue: string;
  linkedThreadIds: string[];
  puzzleIds: string[];
  tags: string[];
};

export type ChatMessage = {
  id: string;
  from: 'operator' | 'contact' | 'system';
  speaker: string;
  text: string;
  time: string;
  access?: AccessRule;
  redactedText?: string;
};

export type ChatThread = {
  id: string;
  title: string;
  contactName: string;
  channel: string;
  access: AccessRule;
  messages: ChatMessage[];
};
