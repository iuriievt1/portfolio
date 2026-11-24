import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { platformAccessFor } from '../access/platform-access.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import { isUniqueViolation } from '../database/prisma-errors.js';
import { PrismaService } from '../database/prisma.service.js';
import { AppException } from '../errors/app.exception.js';
import type { User } from '../generated/prisma/client.js';
import {
  OneTimeCodePurpose,
  SignInConfirmationChannel,
  SignInMethod,
  UserStatus,
} from '../generated/prisma/enums.js';
import type { AuthContext } from './auth-context.js';
import { accountBlocked, invalidCredentials, signInConfirmationExpired } from './auth-errors.js';
import { AuthNotifier } from './auth-notifier.js';
import {
  oneTimeCodeLifetimeMinutes,
  oneTimeCodeResendSeconds,
  recentCodeSignInMinutes,
} from './auth-policy.js';
import type {
  AuthTokens,
  ConfirmPhoneBody,
  ConfirmSignInBody,
  CurrentUser,
  OneTimeCodeSent,
  RequestEmailCodeBody,
  RequestPasswordResetCodeBody,
  SetPasswordBody,
  SetSignInConfirmationChannelBody,
  SignInApp,
  SignInConfirmation,
  SignInStarted,
  SignInWithCodeBody,
  SignInWithPasswordBody,
  StartSignInBody,
} from './auth.dto.js';
import { OneTimeCodeService, type OneTimeCodeTarget } from './one-time-code.service.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionService } from './session.service.js';
import { SignInConfirmationTokenService } from './sign-in-confirmation-token.service.js';

/** How many digits of the phone number the app may show before the sign-in is finished. */
const phoneEndingLength = 3;

const oneTimeCodeSent: OneTimeCodeSent = {
  expiresInSeconds: oneTimeCodeLifetimeMinutes * 60,
  resendInSeconds: oneTimeCodeResendSeconds,
};

@Injectable()
export class AuthService {
  /** Checked when the email is unknown, so the answer takes as long as for a real account. */
  private decoyPasswordHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: OneTimeCodeService,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly confirmations: SignInConfirmationTokenService,
    private readonly notifier: AuthNotifier,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * The first step of a sign-in: says whether the account has a password to ask for.
   * When it has none, or there is no account yet, a sign-in code goes to the email.
   */
  async startSignIn({ email, locale, app }: StartSignInBody): Promise<SignInStarted> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user?.passwordHash) {
      return { step: 'PASSWORD', code: null };
    }

    const code = await this.codes.issueUnlessRecent(
      { purpose: OneTimeCodePurpose.SIGN_IN, destination: email },
      locale,
    );

    if (code !== undefined) {
      await this.notifier.sendSignInCode(email, code, locale, app);
    }

    return { step: 'EMAIL_CODE', code: oneTimeCodeSent };
  }

  /** Sends a sign-in code. The answer is the same whether an account with this email exists or not. */
  async requestEmailCode({ email, locale, app }: RequestEmailCodeBody): Promise<OneTimeCodeSent> {
    const code = await this.codes.issue(
      { purpose: OneTimeCodePurpose.SIGN_IN, destination: email },
      locale,
    );

    await this.notifier.sendSignInCode(email, code, locale, app);

    return oneTimeCodeSent;
  }

  /**
   * Sends a code for a forgotten password. It is a sign-in code in an email of its own:
   * the person signs in with it and sets a new password right after.
   */
  async requestPasswordResetCode({
    email,
    locale,
  }: RequestPasswordResetCodeBody): Promise<OneTimeCodeSent> {
    const code = await this.codes.issue(
      { purpose: OneTimeCodePurpose.SIGN_IN, destination: email },
      locale,
    );

    await this.notifier.sendPasswordResetCode(email, code, locale);

    return oneTimeCodeSent;
  }

  /** Signs in with a code from an email. The first sign-in creates the account. */
  async signInWithCode({ email, code }: SignInWithCodeBody): Promise<AuthTokens> {
    const redeemed = await this.codes.redeem(
      { purpose: OneTimeCodePurpose.SIGN_IN, destination: email },
      code,
    );
    const now = new Date();
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, locale: redeemed.locale, emailVerifiedAt: now },
      update: {},
    });

    if (user.status !== UserStatus.ACTIVE) {
      throw accountBlocked();
    }

    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    }

    return this.startSession(user.id, SignInMethod.EMAIL_CODE);
  }

  /**
   * The first of the two steps of a sign-in with a password. A right password does not sign in yet:
   * a code goes to the email or the phone of the user, and the token in the answer lets the app
   * finish the sign-in with that code.
   */
  async signInWithPassword({
    email,
    password,
    app,
  }: SignInWithPasswordBody): Promise<SignInConfirmation> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    this.decoyPasswordHash ??= this.passwords.hash(randomUUID());

    const passwordMatches = await this.passwords.verify(
      password,
      user?.passwordHash ?? (await this.decoyPasswordHash),
    );

    if (!user?.passwordHash || !passwordMatches) {
      throw invalidCredentials();
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw accountBlocked();
    }

    const { channel, target } = confirmationOf(user);
    const code = await this.codes.issueUnlessRecent(target, user.locale);

    if (code !== undefined) {
      await this.sendConfirmationCode(user, code, app);
    }

    return {
      expiresInSeconds: oneTimeCodeSent.expiresInSeconds,
      resendInSeconds: oneTimeCodeSent.resendInSeconds,
      confirmationToken: await this.confirmations.sign({ userId: user.id, app }),
      channel,
      phoneEnding:
        channel === SignInConfirmationChannel.SMS
          ? target.destination.slice(-phoneEndingLength)
          : null,
    };
  }

  /** Sends the code of the second step again. */
  async resendSignInConfirmation(confirmationToken: string): Promise<OneTimeCodeSent> {
    const { user, app } = await this.confirmingUser(confirmationToken);
    const code = await this.codes.issue(confirmationOf(user).target, user.locale);

    await this.sendConfirmationCode(user, code, app);

    return oneTimeCodeSent;
  }

  /** The second step of a sign-in with a password: the code from the email or the SMS. */
  async confirmSignIn({ confirmationToken, code }: ConfirmSignInBody): Promise<AuthTokens> {
    const { user } = await this.confirmingUser(confirmationToken);

    await this.codes.redeem(confirmationOf(user).target, code);

    return this.startSession(user.id, SignInMethod.PASSWORD);
  }

  /** The user a confirmation token was given to, when they may still finish the sign-in, and the app they sign in to. */
  private async confirmingUser(
    confirmationToken: string,
  ): Promise<{ readonly user: User; readonly app: SignInApp }> {
    const confirming = await this.confirmations.verify(confirmationToken);

    if (!confirming) {
      throw signInConfirmationExpired();
    }

    const user = await this.prisma.user.findUnique({ where: { id: confirming.userId } });

    if (!user) {
      throw signInConfirmationExpired();
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw accountBlocked();
    }

    return { user, app: confirming.app };
  }

  private async sendConfirmationCode(user: User, code: string, app: SignInApp): Promise<void> {
    const { channel, target } = confirmationOf(user);

    if (channel === SignInConfirmationChannel.SMS) {
      await this.notifier.sendPhoneCode(target.destination, code, user.locale);
    } else {
      await this.notifier.sendSignInCode(target.destination, code, user.locale, app);
    }
  }

  /** Signs out on all devices. */
  async signOutEverywhere(auth: AuthContext): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.sessions.endAll(auth.userId, transaction);
      await this.audit.record(
        { action: 'auth.signed_out_everywhere', actorId: auth.userId },
        transaction,
      );
    });
  }

  /**
   * Sets or changes the password. The user proves who they are with the current password
   * or with a sign-in by one-time code a few minutes ago ("forgot password").
   * Every other session of the user ends.
   */
  async setPassword(auth: AuthContext, body: SetPasswordBody): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });

    if (body.currentPassword !== undefined) {
      const matches =
        user.passwordHash !== null &&
        (await this.passwords.verify(body.currentPassword, user.passwordHash));

      if (!matches) {
        throw invalidCredentials();
      }
    } else {
      const recentCodeSignIn =
        auth.signInMethod === SignInMethod.EMAIL_CODE &&
        auth.signedInAt.getTime() > Date.now() - recentCodeSignInMinutes * 60 * 1000;

      if (!recentCodeSignIn) {
        throw new AppException(
          HttpStatus.FORBIDDEN,
          'RECENT_SIGN_IN_REQUIRED',
          'Send the current password or sign in with a one-time code again',
        );
      }
    }

    const passwordHash = await this.passwords.hash(body.newPassword);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
      await this.sessions.endAll(user.id, transaction, auth.sessionId);
      await this.audit.record({ action: 'auth.password_changed', actorId: user.id }, transaction);
    });
  }

  async requestPhoneCode(auth: AuthContext, phone: string): Promise<OneTimeCodeSent> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    const code = await this.codes.issue(
      { purpose: OneTimeCodePurpose.VERIFY_PHONE, destination: phone, userId: user.id },
      user.locale,
    );

    await this.notifier.sendPhoneCode(phone, code, user.locale);

    return oneTimeCodeSent;
  }

  /** Saves the phone number after the user proved with a code that it is theirs. */
  async confirmPhone(auth: AuthContext, { phone, code }: ConfirmPhoneBody): Promise<void> {
    await this.codes.redeem(
      { purpose: OneTimeCodePurpose.VERIFY_PHONE, destination: phone, userId: auth.userId },
      code,
    );

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: auth.userId },
          data: { phone, phoneVerifiedAt: new Date() },
        });
        await this.audit.record(
          { action: 'auth.phone_confirmed', actorId: auth.userId },
          transaction,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'PHONE_ALREADY_USED',
          'Another account uses this phone number',
          undefined,
          { cause: error },
        );
      }

      throw error;
    }
  }

  /** Chooses where the code of the second step of a sign-in goes. SMS needs a confirmed phone. */
  async setSignInConfirmationChannel(
    auth: AuthContext,
    { channel }: SetSignInConfirmationChannelBody,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });

    if (channel === SignInConfirmationChannel.SMS && user.phoneVerifiedAt === null) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'PHONE_NOT_CONFIRMED',
        'Confirm a phone number first',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { signInConfirmationChannel: channel },
      });
      await this.audit.record(
        {
          action: 'auth.sign_in_confirmation_channel_changed',
          actorId: user.id,
          details: { channel },
        },
        transaction,
      );
    });
  }

  /** Starts a session. A sign-in of a member of the Bluberi team also goes to the audit log. */
  private startSession(userId: string, method: SignInMethod): Promise<AuthTokens> {
    return this.prisma.$transaction(async (transaction) => {
      const tokens = await this.sessions.start(userId, method, transaction);
      const teamRoles = await transaction.userPlatformRole.count({ where: { userId } });

      if (teamRoles > 0) {
        await this.audit.record(
          { action: 'auth.signed_in', actorId: userId, details: { method } },
          transaction,
        );
      }

      return tokens;
    });
  }

  async currentUser(auth: AuthContext): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
      hasPassword: user.passwordHash !== null,
      signInConfirmationChannel: user.signInConfirmationChannel,
      platformRoles: [...auth.platformRoles],
      platformAccess: platformAccessFor(auth.platformRoles),
      sellerMemberships: [...auth.sellerMemberships],
    };
  }
}

/** Where the code of the second step of a sign-in goes for this user, and which code that is. */
function confirmationOf(user: User): {
  channel: SignInConfirmationChannel;
  target: OneTimeCodeTarget;
} {
  // The database lets the channel be SMS only with a confirmed phone number.
  const phone =
    user.signInConfirmationChannel === SignInConfirmationChannel.SMS ? user.phone : null;

  return {
    channel: phone === null ? SignInConfirmationChannel.EMAIL : SignInConfirmationChannel.SMS,
    target: {
      purpose: OneTimeCodePurpose.CONFIRM_SIGN_IN,
      destination: phone ?? user.email,
      userId: user.id,
    },
  };
}
