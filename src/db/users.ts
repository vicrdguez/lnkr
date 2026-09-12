export type User = {
  id: number;
  username: string;
  passwordHash: string;
  prefs: string;
  dateJoined: string;
  lastLogin: string | null;
};
