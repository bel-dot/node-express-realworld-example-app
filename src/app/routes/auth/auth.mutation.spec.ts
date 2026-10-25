import { UserRegistrationVO } from './user-registration.vo';

describe('Data Mutation Vulnerability & Immutability Verification', () => {
  it('PASS: should guarantee immutability and prevent in-place state corruption via Value Object', () => {
    const rawPayload = {
      username: 'techlead_user',
      email: 'techlead@example.com',
      password: 'StrongPassword123!',
    };

    const registrationVo = UserRegistrationVO.create(rawPayload);

    // Спроба несанкціонованої мутації стану (через приведення типів any)
    try {
      (registrationVo as any).email = registrationVo.username;
    } catch (e) {
      // У суворому режимі Object.freeze викидає виняток TypeError — це очікувана поведінка
    }

    // Головне твердження: значення захищене від підміни
    expect(registrationVo.email).toBe('techlead@example.com');
    expect(registrationVo.username).toBe('techlead_user');
  });
});
