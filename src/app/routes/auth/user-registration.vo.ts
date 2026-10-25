import HttpException from '../../models/http-exception.model';

export class UserRegistrationVO {
  public readonly email: string;
  public readonly username: string;
  public readonly password: string;
  public readonly image?: string;
  public readonly bio?: string;
  public readonly demo?: boolean;

  private constructor(rawInput: any) {
    if (!rawInput.email || !rawInput.username || !rawInput.password) {
      throw new HttpException(422, { errors: { body: ['All credentials are required'] } });
    }

    this.email = String(rawInput.email).trim().toLowerCase();
    this.username = String(rawInput.username).trim();
    this.password = String(rawInput.password).trim();
    this.image = rawInput.image;
    this.bio = rawInput.bio;
    this.demo = Boolean(rawInput.demo);

    // Забезпечення абсолютної імутабельності на рівні JavaScript Runtime
    Object.freeze(this);
  }

  public static create(rawInput: any): UserRegistrationVO {
    return new UserRegistrationVO(rawInput);
  }
}
