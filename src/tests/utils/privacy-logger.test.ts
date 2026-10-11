import { PrivacyLogger } from '../../app/utils/privacy-logger';

describe('Task 1: Secure Logging & PII Masking Verification', () => {
  let logOutput = '';
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    logOutput = '';
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((output: string) => {
      logOutput += output;
    });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((output: string) => {
      logOutput += output;
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('PASS: should mask email and fully redact password & token in structured logs', () => {
    const syntheticEmail = 'privacy.tester@synthetic-example.com';
    const rawSecretPassword = 'UltraSecureSyntheticPassword!123';
    const syntheticToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDkifQ.synthetic_signature';

    PrivacyLogger.info('User authentication event', {
      user: {
        id: 101,
        email: syntheticEmail,
        password: rawSecretPassword,
      },
      token: syntheticToken,
    });

    // Перевірка відсутності відкритих значень у лозі
    expect(logOutput).not.toContain(syntheticEmail);
    expect(logOutput).not.toContain(rawSecretPassword);
    expect(logOutput).not.toContain(syntheticToken);

    // Перевірка коректного маскування
    expect(logOutput).toContain('p***r@synthetic-example.com');
    expect(logOutput).toContain('"password":"[REDACTED]"');
    expect(logOutput).toContain('"token":"[REDACTED]"');
  });

  test('PASS (Negative Handling): should redact PII/secrets inside deep nested DTOs and Error messages', () => {
    const leakedPasswordInError = 'AuthException_Pass#999';
    const deeplyNestedUser = {
      layer1: {
        layer2: {
          accountDetails: {
            email: 'deep.nested@synthetic.org',
            passwordHash: '$2a$12$e8SyntheticHashValue',
          },
        },
      },
    };

    PrivacyLogger.info('Deep payload received', deeplyNestedUser);

    expect(logOutput).not.toContain('deep.nested@synthetic.org');
    expect(logOutput).not.toContain('$2a$12$e8SyntheticHashValue');
    expect(logOutput).toContain('d***d@synthetic.org');
    expect(logOutput).toContain('"passwordHash":"[REDACTED]"');

    const sensitiveError = new Error(`Database connection failed for user password=${leakedPasswordInError}`);
    PrivacyLogger.error('Critical DB Failure', sensitiveError);

    expect(logOutput).not.toContain(leakedPasswordInError);
    expect(logOutput).toContain('password=[REDACTED]');
  });
});