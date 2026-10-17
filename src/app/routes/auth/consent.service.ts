export type ConsentPurpose = 'MARKETING_EMAIL' | 'OPTIONAL_ANALYTICS';

export interface UserConsentRecord {
  id: string;
  userId: number;
  purpose: ConsentPurpose;
  isGranted: boolean;
  policyVersion: string;
  source: string;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
  updatedAt: Date;
}

// In-memory сховище згод із доказовою історією (audit trail)
export class ConsentService {
  private static consents: Map<string, UserConsentRecord> = new Map();
  private static auditTrail: Array<UserConsentRecord> = [];

  private static getKey(userId: number, purpose: ConsentPurpose): string {
    return `${userId}:${purpose}`;
  }

  // GRANT: Надання згоди суб'єктом
  public static grantConsent(
    userId: number,
    purpose: ConsentPurpose,
    policyVersion = 'v1.0.0',
    source = 'web_consent_banner'
  ): UserConsentRecord {
    const key = this.getKey(userId, purpose);
    const now = new Date();

    const record: UserConsentRecord = {
      id: `consent_${userId}_${purpose}`,
      userId,
      purpose,
      isGranted: true,
      policyVersion,
      source,
      grantedAt: now,
      withdrawnAt: null,
      updatedAt: now,
    };

    this.consents.set(key, record);
    this.auditTrail.push({ ...record });
    return record;
  }

  // REVOKE: Відкликання згоди суб'єктом (GDPR Art. 7.3)
  public static revokeConsent(userId: number, purpose: ConsentPurpose): UserConsentRecord {
    const key = this.getKey(userId, purpose);
    const existing = this.consents.get(key);
    const now = new Date();

    const record: UserConsentRecord = {
      id: existing?.id || `consent_${userId}_${purpose}`,
      userId,
      purpose,
      isGranted: false,
      policyVersion: existing?.policyVersion || 'v1.0.0',
      source: 'user_privacy_dashboard',
      grantedAt: existing?.grantedAt || null,
      withdrawnAt: now,
      updatedAt: now,
    };

    this.consents.set(key, record);
    this.auditTrail.push({ ...record });
    return record;
  }

  // POLICY GATE: Перевірка статусу перед виконанням залежної дії
  public static hasActiveConsent(userId: number, purpose: ConsentPurpose): boolean {
    const key = this.getKey(userId, purpose);
    const record = this.consents.get(key);
    return Boolean(record && record.isGranted);
  }

  // Отримання повної історії суб'єкта (для експорту даних у Завданні 2)
  public static getUserConsents(userId: number): UserConsentRecord[] {
    const userRecords: UserConsentRecord[] = [];
    for (const record of this.consents.values()) {
      if (record.userId === userId) {
        userRecords.push(record);
      }
    }
    return userRecords;
  }

  public static clear(): void {
    this.consents.clear();
    this.auditTrail = [];
  }
}