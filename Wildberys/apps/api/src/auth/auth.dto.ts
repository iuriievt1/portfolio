import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PlatformAccess } from '../access/platform-access.dto.js';
import {
  Locale,
  PlatformRole,
  SellerMemberRole,
  SignInConfirmationChannel,
} from '../generated/prisma/enums.js';
import { emailMaxLength, normalizeEmail } from '../validation/normalize-email.js';
import { phonePattern } from '../validation/phone.js';
import { oneTimeCodeLength, passwordMaxLength, passwordMinLength } from './auth-policy.js';

const refreshTokenMaxLength = 128;
const confirmationTokenMaxLength = 1024;
const oneTimeCodePattern = new RegExp(`^\\d{${String(oneTimeCodeLength)}}$`);

const confirmationChannel = {
  enum: SignInConfirmationChannel,
  enumName: 'SignInConfirmationChannel',
};

/** What a sign-in asks for after the email. */
export const signInSteps = ['PASSWORD', 'EMAIL_CODE'] as const;
export type SignInStep = (typeof signInSteps)[number];

/** The Bluberi apps a person signs in to. The email with a sign-in code names the app. */
export const signInApps = ['web', 'seller', 'admin'] as const;
export type SignInApp = (typeof signInApps)[number];

const signInApp = {
  enum: signInApps,
  enumName: 'SignInApp',
  description: 'The app the person signs in to. The email with the code names it.',
};

export class RequestPasswordResetCodeBody {
  @ApiProperty({ example: 'jana@example.cz' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(emailMaxLength)
  readonly email!: string;

  @ApiProperty({ enum: Locale, enumName: 'Locale' })
  @IsEnum(Locale)
  readonly locale!: Locale;
}

export class RequestEmailCodeBody extends RequestPasswordResetCodeBody {
  @ApiProperty(signInApp)
  @IsIn(signInApps)
  readonly app!: SignInApp;
}

export class OneTimeCodeSent {
  @ApiProperty({ type: 'integer', description: 'How long the code is valid.' })
  readonly expiresInSeconds!: number;

  @ApiProperty({ type: 'integer', description: 'How long to wait before asking for another code.' })
  readonly resendInSeconds!: number;
}

export class StartSignInBody extends RequestEmailCodeBody {}

export class SignInStarted {
  @ApiProperty({
    enum: signInSteps,
    enumName: 'SignInStep',
    description:
      'PASSWORD: the account has a password, ask for it. EMAIL_CODE: a sign-in code was sent to the email.',
  })
  readonly step!: SignInStep;

  @ApiProperty({ type: OneTimeCodeSent, nullable: true, description: 'Set when a code was sent.' })
  readonly code!: OneTimeCodeSent | null;
}

export class SignInWithCodeBody {
  @ApiProperty({ example: 'jana@example.cz' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(emailMaxLength)
  readonly email!: string;

  @ApiProperty({ example: '482913' })
  @Matches(oneTimeCodePattern)
  readonly code!: string;
}

export class SignInWithPasswordBody {
  @ApiProperty({ example: 'jana@example.cz' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(emailMaxLength)
  readonly email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(passwordMaxLength)
  readonly password!: string;

  @ApiProperty(signInApp)
  @IsIn(signInApps)
  readonly app!: SignInApp;
}

export class SignInConfirmation extends OneTimeCodeSent {
  @ApiProperty({
    description: 'Proves the password was right. Goes into the requests that finish the sign-in.',
  })
  readonly confirmationToken!: string;

  @ApiProperty({ ...confirmationChannel, description: 'Where the code went.' })
  readonly channel!: SignInConfirmationChannel;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '456',
    description: 'The last digits of the phone number when the code went by SMS.',
  })
  readonly phoneEnding!: string | null;
}

export class ResendSignInConfirmationBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(confirmationTokenMaxLength)
  readonly confirmationToken!: string;
}

export class ConfirmSignInBody extends ResendSignInConfirmationBody {
  @ApiProperty({ example: '482913' })
  @Matches(oneTimeCodePattern)
  readonly code!: string;
}

export class RefreshBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(refreshTokenMaxLength)
  readonly refreshToken!: string;
}

export class AuthTokens {
  @ApiProperty({
    description: 'Goes into the Authorization header of every request: Bearer <token>.',
  })
  readonly accessToken!: string;

  @ApiProperty({ type: 'integer', description: 'How long the access token is valid.' })
  readonly expiresInSeconds!: number;

  @ApiProperty({
    description:
      'Exchanged for a new pair of tokens. Works once: every exchange returns a new one.',
  })
  readonly refreshToken!: string;
}

export class SetPasswordBody {
  @ApiProperty({ minLength: passwordMinLength, maxLength: passwordMaxLength })
  @IsString()
  @MinLength(passwordMinLength)
  @MaxLength(passwordMaxLength)
  readonly newPassword!: string;

  @ApiPropertyOptional({
    description: 'Not needed right after a sign-in with a one-time code.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(passwordMaxLength)
  readonly currentPassword?: string;
}

export class RequestPhoneCodeBody {
  @ApiProperty({ example: '+420777123456' })
  @Matches(phonePattern)
  readonly phone!: string;
}

export class ConfirmPhoneBody {
  @ApiProperty({ example: '+420777123456' })
  @Matches(phonePattern)
  readonly phone!: string;

  @ApiProperty({ example: '482913' })
  @Matches(oneTimeCodePattern)
  readonly code!: string;
}

export class SetSignInConfirmationChannelBody {
  @ApiProperty(confirmationChannel)
  @IsEnum(SignInConfirmationChannel)
  readonly channel!: SignInConfirmationChannel;
}

export class SellerMembershipView {
  @ApiProperty({ format: 'uuid' })
  readonly sellerId!: string;

  @ApiProperty({ enum: SellerMemberRole, enumName: 'SellerMemberRole' })
  readonly role!: SellerMemberRole;
}

export class CurrentUser {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly phone!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly firstName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly lastName!: string | null;

  @ApiProperty({ enum: Locale, enumName: 'Locale' })
  readonly locale!: Locale;

  @ApiProperty()
  readonly emailVerified!: boolean;

  @ApiProperty()
  readonly phoneVerified!: boolean;

  @ApiProperty({ description: 'False while the user signs in only with one-time codes.' })
  readonly hasPassword!: boolean;

  @ApiProperty({
    ...confirmationChannel,
    description: 'Where the code of the second step of a sign-in with a password goes.',
  })
  readonly signInConfirmationChannel!: SignInConfirmationChannel;

  @ApiProperty({
    enum: PlatformRole,
    enumName: 'PlatformRole',
    isArray: true,
    description: 'Roles in the Bluberi team. Empty for buyers and sellers.',
  })
  readonly platformRoles!: PlatformRole[];

  @ApiProperty({
    type: PlatformAccess,
    description: 'What the platform roles allow in each section of the admin.',
  })
  readonly platformAccess!: PlatformAccess;

  @ApiProperty({ type: [SellerMembershipView], description: 'Sellers the user works for.' })
  readonly sellerMemberships!: SellerMembershipView[];
}
