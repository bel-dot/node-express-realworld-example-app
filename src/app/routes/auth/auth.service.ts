import * as bcrypt from 'bcryptjs';
import { RegisterInput } from './register-input.model';
import prisma from '../../../prisma/prisma-client';
import HttpException from '../../models/http-exception.model';
import { RegisteredUser } from './registered-user.model';
import generateToken from './token.utils';
import { User } from './user.model';

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

export const createUser = async (input: any): Promise<RegisteredUser> => {
  const email = input.email?.trim();
  const username = input.username?.trim();
  const password = input.password?.trim();
  const { image, bio, demo, role, adminSecret, age, promoCode, termsAccepted, phone, country, vatNumber } = input;

  // 1-3. Базові предикати (P1 - P3)
  if (!email) {
    throw new HttpException(422, { errors: { email: ["can't be blank"] } });
  }
  if (!username) {
    throw new HttpException(422, { errors: { username: ["can't be blank"] } });
  }
  if (!password) {
    throw new HttpException(422, { errors: { password: ["can't be blank"] } });
  }

  // 4-15. Рівно 12 лінійних предикатів БЕЗ операторів && та || (P4 - P15)
  if (password.length < 8) {
    throw new HttpException(422, { errors: { password: ['is too short (min 8 chars)'] } });
  }
  if (!/[!@#$%^&*]/.test(password)) {
    throw new HttpException(422, { errors: { password: ['must contain special symbol'] } });
  }
  // Замість || використано регулярний вираз (одне розгалуження)
  if (/@(tempmail\.com|disposable\.com)$/.test(email)) {
    throw new HttpException(422, { errors: { email: ['disposable domain forbidden'] } });
  }
  if (role === 'admin') {
    if (adminSecret !== 'SUPER_SECRET_KEY') {
      throw new HttpException(403, { errors: { adminSecret: ['invalid security key'] } });
    }
  }
  // Перевірка без &&
  if (Number(age) < 18) {
    throw new HttpException(422, { errors: { age: ['must be at least 18'] } });
  }
  if (promoCode === 'INVALID_CODE') {
    throw new HttpException(422, { errors: { promoCode: ['promo code is invalid'] } });
  }
  if (!termsAccepted) {
    throw new HttpException(422, { errors: { terms: ['must be accepted'] } });
  }
  if (phone === 'BLOCKED_NUMBER') {
    throw new HttpException(422, { errors: { phone: ['invalid phone format'] } });
  }
  if (country === 'BLOCKED_ZONE') {
    throw new HttpException(403, { errors: { country: ['region is restricted'] } });
  }
  if (role === 'enterprise') {
    if (!vatNumber) {
      throw new HttpException(422, { errors: { vatNumber: ['VAT required for enterprise'] } });
    }
  }

  await checkUserUniqueness(email, username);
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      ...(image ? { image } : {}),
      ...(bio ? { bio } : {}),
      ...(demo ? { demo } : {}),
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
