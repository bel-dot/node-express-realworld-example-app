import { ConsentService } from '../../app/routes/auth/consent.service';

describe('Task 4: Consent Management Engine & Policy Gate Verification', () => {
  const testUserId = 101;

  beforeEach(() => {
    ConsentService.clear();
  });

  // ОСНОВНИЙ СЦЕНАРІЙ З МЕТОДИЧКИ: DENY -> GRANT -> ALLOW -> REVOKE -> DENY
  test('PASS: full lifecycle DENY -> GRANT -> ALLOW -> REVOKE -> DENY with timestamps and versions', () => {
    // 1. Початковий стан: згода відсутня -> DENY
    expect(ConsentService.hasActiveConsent(testUserId, 'MARKETING_EMAIL')).toBe(false);

    // 2. GRANT згоди для MARKETING_EMAIL
    const grantedRecord = ConsentService.grantConsent(
      testUserId,
      'MARKETING_EMAIL',
      'v1.2.0',
      'signup_modal'
    );
    expect(grantedRecord.isGranted).toBe(true);
    expect(grantedRecord.policyVersion).toBe('v1.2.0');
    expect(grantedRecord.grantedAt).toBeInstanceOf(Date);
    expect(grantedRecord.withdrawnAt).toBeNull();

    // 3. ALLOW: дія дозволена
    expect(ConsentService.hasActiveConsent(testUserId, 'MARKETING_EMAIL')).toBe(true);

    // 4. REVOKE: відкликання згоди суб'єктом
    const revokedRecord = ConsentService.revokeConsent(testUserId, 'MARKETING_EMAIL');
    expect(revokedRecord.isGranted).toBe(false);
    expect(revokedRecord.withdrawnAt).toBeInstanceOf(Date);

    // 5. DENY: дія повторно заблокована після відкликання
    expect(ConsentService.hasActiveConsent(testUserId, 'MARKETING_EMAIL')).toBe(false);
  });

  // ІЗОЛЯЦІЯ РІЗНИХ ЦІЛЕЙ (PURPOSE ISOLATION)
  test('PASS (Purpose Isolation): consent for MARKETING_EMAIL must not permit OPTIONAL_ANALYTICS', () => {
    ConsentService.grantConsent(testUserId, 'MARKETING_EMAIL', 'v1.0.0');

    // MARKETING дозволено, але ANALYTICS все ще заблоковано
    expect(ConsentService.hasActiveConsent(testUserId, 'MARKETING_EMAIL')).toBe(true);
    expect(ConsentService.hasActiveConsent(testUserId, 'OPTIONAL_ANALYTICS')).toBe(false);
  });
});