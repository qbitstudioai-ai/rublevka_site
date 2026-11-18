export const BACKUP_NAME_PATTERN: RegExp;
export function backupStamp(date: Date): string;
export function backupFileName(date: Date): string;
export function parseBackupDate(fileName: string): Date | null;
export function removeDir(target: string): void;

export type BackupManifest = {
  app: string;
  format: number;
  createdAt: string;
  database: { file: string; migrations: string[]; events: number; registrations: number };
  uploads: { directory: string; files: number };
};

export function createBackup(options: {
  databasePath: string;
  uploadsDir: string;
  backupDir: string;
  now?: Date;
}): Promise<{ file: string; fileName: string; bytes: number; manifest: BackupManifest }>;

export function listBackups(backupDir: string): { name: string; date: Date }[];
export function applyRetention(options: { backupDir: string; retentionDays: number; now?: Date; keep?: string }): string[];
