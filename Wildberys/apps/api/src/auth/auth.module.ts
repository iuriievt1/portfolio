import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { MailModule } from '../mail/mail.module.js';
import { SmsModule } from '../sms/sms.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthNotifier } from './auth-notifier.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OneTimeCodeService } from './one-time-code.service.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionService } from './session.service.js';
import { SignInConfirmationTokenService } from './sign-in-confirmation-token.service.js';

@Module({
  imports: [AuditModule, MailModule, SmsModule],
  controllers: [AuthController],
  providers: [
    AccessTokenService,
    AuthNotifier,
    AuthService,
    OneTimeCodeService,
    PasswordHasher,
    SessionService,
    SignInConfirmationTokenService,
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
