import * as bcrypt from 'bcryptjs';
import { RegisterInput } from './register-input.model';
import prisma from '../../../prisma/prisma-client';
import HttpException from '../../models/http-exception.model';
import { RegisteredUser } from './registered-user.model';
import generateToken from './token.utils';
import { User } from './user.model';
import { UserRegistrationVO } from './user-registration.vo';

const checkUserUniqueness = async (email: string, username: string) => {
  const existingUserByEmail = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  const existingUserByUsername = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
    },
  });

  if (existingUserByEmail || existingUserByUsername) {
    throw new HttpException(422, {
      errors: {
        ...(existingUserByEmail ? { email: ['has already been taken'] } : {}),
        ...(existingUserByUsername ? { username: ['has already been taken'] } : {}),
      },
    });
  }
};

// --- DATA-DRIVEN VALIDATION SUITE (LOOKUP TABLE) ---
interface ValidationRule {
  field: string;
  statusCode: number;
  message: string;
  isValid: (val: any, input: any) => boolean;
}

const REGISTRATION_RULES_LOOKUP: ValidationRule[] = [
  { field: 'email', statusCode: 422, message: "can't be blank", isValid: (v) => Boolean(v) },
  { field: 'username', statusCode: 422, message: "can't be blank", isValid: (v) => Boolean(v) },
  { field: 'password', statusCode: 422, message: "can't be blank", isValid: (v) => Boolean(v) },
  { field: 'password', statusCode: 422, message: 'is too short (min 8 chars)', isValid: (v) => !v || v.length >= 8 },
  { field: 'password', statusCode: 422, message: 'must contain special symbol', isValid: (v) => !v || /[!@#$%^&*]/.test(v) },
  { field: 'email', statusCode: 422, message: 'disposable domain forbidden', isValid: (v) => !v || !/@(tempmail\.com|disposable\.com)$/.test(v) },
  { field: 'adminSecret', statusCode: 403, message: 'invalid security key', isValid: (v, inp) => inp.role !== 'admin' || v === 'SUPER_SECRET_KEY' },
  { field: 'age', statusCode: 422, message: 'must be at least 18', isValid: (v) => v === undefined || Number(v) >= 18 },
  { field: 'promoCode', statusCode: 422, message: 'promo code is invalid', isValid: (v) => !v || v === 'WELCOME2026' },
  { field: 'termsAccepted', statusCode: 422, message: 'must be accepted', isValid: (v) => v !== false },
  { field: 'phone', statusCode: 422, message: 'invalid phone format', isValid: (v) => !v || /^\+?[0-9]{10,14}$/.test(v) },
  { field: 'country', statusCode: 403, message: 'region is restricted', isValid: (v) => v !== 'BLOCKED_ZONE' },
  { field: 'vatNumber', statusCode: 422, message: 'VAT required for enterprise', isValid: (v, inp) => inp.role !== 'enterprise' || Boolean(v) },
];

const validateRegistration = (input: any): void => {
  const failedRule = REGISTRATION_RULES_LOOKUP.find((rule) => !rule.isValid(input[rule.field], input));
  if (failedRule) {
    throw new HttpException(failedRule.statusCode, { errors: { [failedRule.field]: [failedRule.message] } });
  }
};

const buildProfileData = (input: any, hashedPassword: string) => ({
  username: input.username,
  email: input.email,
  password: hashedPassword,
  image: input.image,
  bio: input.bio,
  demo: input.demo,
});

export const createUser = async (input: UserRegistrationVO | any): Promise<RegisteredUser> => {
  const registrationVo = input instanceof UserRegistrationVO ? input : UserRegistrationVO.create(input); 

  await checkUserUniqueness(registrationVo.email, registrationVo.username);
  const hashedPassword = await bcrypt.hash(registrationVo.password, 10);

  const user = await prisma.user.create({
    data: {
      username: registrationVo.username,
      email: registrationVo.email,
      password: hashedPassword,
      image: registrationVo.image,
      bio: registrationVo.bio,
      demo: registrationVo.demo,
    },
    select: {
      id: true,
      email: true,
      username: true,
      bio: true,
      image: true,
    },
  });

  return Object.freeze({
    ...user,
    token: generateToken(user.id),
  });
};

export const login = async (userPayload: any) => {
  const email = userPayload.email?.trim();
  const password = userPayload.password?.trim();

  if (!email) {
    throw new HttpException(422, { errors: { email: ["can't be blank"] } });
  }

  if (!password) {
    throw new HttpException(422, { errors: { password: ["can't be blank"] } });
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      bio: true,
      image: true,
    },
  });

  if (user) {
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      return {
        email: user.email,
        username: user.username,
        bio: user.bio,
        image: user.image,
        token: generateToken(user.id),
      };
    }
  }

  throw new HttpException(403, {
    errors: {
      'email or password': ['is invalid'],
    },
  });
};

export const getCurrentUser = async (id: number) => {
  const user = (await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      email: true,
      username: true,
      bio: true,
      image: true,
    },
  })) as User;

  return {
    ...user,
    token: generateToken(user.id),
  };
};

export const updateUser = async (userPayload: any, id: number) => {
  const { email, username, password, image, bio } = userPayload;
  let hashedPassword;

  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: {
      id: id,
    },
    data: {
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password: hashedPassword } : {}),
      ...(image ? { image } : {}),
      ...(bio ? { bio } : {}),
    },
    select: {
      id: true,
      email: true,
      username: true,
      bio: true,
      image: true,
    },
  });

  return {
    ...user,
    token: generateToken(user.id),
  };
};
