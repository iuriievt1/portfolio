import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthContext } from './auth-context.js';
import {
  AuthTokens,
  ConfirmPhoneBody,
  ConfirmSignInBody,
  CurrentUser,
  OneTimeCodeSent,
  RefreshBody,
  RequestEmailCodeBody,
  RequestPasswordResetCodeBody,
  RequestPhoneCodeBody,
  ResendSignInConfirmationBody,
  SetPasswordBody,
  SetSignInConfirmationChannelBody,
  SignInConfirmation,
  SignInStarted,
  SignInWithCodeBody,
  SignInWithPasswordBody,
  StartSignInBody,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { CurrentAuth } from './current-auth.decorator.js';
import { Public } from './public.decorator.js';
import { SessionService } from './session.service.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a sign-in with an email',
    description:
      'Says what to ask for next. An account with a password is asked for it. ' +
      'Otherwise a sign-in code goes to the email, also when there is no account yet.',
  })
  @ApiOkResponse({ type: SignInStarted, description: 'The next step of the sign-in' })
  startSignIn(@Body() body: StartSignInBody): Promise<SignInStarted> {
    return this.auth.startSignIn(body);
  }

  @Public()
  @Post('email-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a sign-in code to an email',
    description:
      'The email is written in the given language. An account created with the code gets that language.',
  })
  @ApiOkResponse({ type: OneTimeCodeSent, description: 'The code is sent' })
  requestEmailCode(@Body() body: RequestEmailCodeBody): Promise<OneTimeCodeSent> {
    return this.auth.requestEmailCode(body);
  }

  @Public()
  @Post('password-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a code for a forgotten password to an email',
    description:
      'The code signs in like any sign-in code. A new password can be set right after the sign-in. ' +
      'The answer is the same whether an account with this email exists or not.',
  })
  @ApiOkResponse({ type: OneTimeCodeSent, description: 'The code is sent' })
  requestPasswordResetCode(@Body() body: RequestPasswordResetCodeBody): Promise<OneTimeCodeSent> {
    return this.auth.requestPasswordResetCode(body);
  }

  @Public()
  @Post('sign-in/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with a code from an email. The first sign-in creates the account',
  })
  @ApiOkResponse({ type: AuthTokens, description: 'Signed in' })
  signInWithCode(@Body() body: SignInWithCodeBody): Promise<AuthTokens> {
    return this.auth.signInWithCode(body);
  }

  @Public()
  @Post('sign-in/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check an email and a password, the first of two steps',
    description:
      'A right password sends a code to the email or the phone of the user. ' +
      'The sign-in is finished with that code and the token from the answer.',
  })
  @ApiOkResponse({ type: SignInConfirmation, description: 'The password is right, a code is sent' })
  signInWithPassword(@Body() body: SignInWithPasswordBody): Promise<SignInConfirmation> {
    return this.auth.signInWithPassword(body);
  }

  @Public()
  @Post('sign-in/confirmation-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send the code of the second step again' })
  @ApiOkResponse({ type: OneTimeCodeSent, description: 'The code is sent' })
  resendSignInConfirmation(@Body() body: ResendSignInConfirmationBody): Promise<OneTimeCodeSent> {
    return this.auth.resendSignInConfirmation(body.confirmationToken);
  }

  @Public()
  @Post('sign-in/confirmation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finish a sign-in with a password: the code of the second step' })
  @ApiOkResponse({ type: AuthTokens, description: 'Signed in' })
  confirmSignIn(@Body() body: ConfirmSignInBody): Promise<AuthTokens> {
    return this.auth.confirmSignIn(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new pair of tokens' })
  @ApiOkResponse({
    type: AuthTokens,
    description: 'New tokens. The old refresh token no longer works',
  })
  refresh(@Body() body: RefreshBody): Promise<AuthTokens> {
    return this.sessions.refresh(body.refreshToken);
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out on this device' })
  @ApiNoContentResponse({ description: 'Signed out' })
  signOut(@CurrentAuth() auth: AuthContext): Promise<void> {
    return this.sessions.end(auth.sessionId);
  }

  @Post('sign-out-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out on all devices' })
  @ApiNoContentResponse({ description: 'Signed out everywhere' })
  signOutAll(@CurrentAuth() auth: AuthContext): Promise<void> {
    return this.auth.signOutEverywhere(auth);
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set or change the password. Signs out all other devices' })
  @ApiNoContentResponse({ description: 'The password is saved' })
  setPassword(@CurrentAuth() auth: AuthContext, @Body() body: SetPasswordBody): Promise<void> {
    return this.auth.setPassword(auth, body);
  }

  @Post('phone-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a code by SMS to confirm a phone number' })
  @ApiOkResponse({ type: OneTimeCodeSent, description: 'The code is sent' })
  requestPhoneCode(
    @CurrentAuth() auth: AuthContext,
    @Body() body: RequestPhoneCodeBody,
  ): Promise<OneTimeCodeSent> {
    return this.auth.requestPhoneCode(auth, body.phone);
  }

  @Put('phone')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Save the phone number confirmed with a code from an SMS' })
  @ApiNoContentResponse({ description: 'The phone number is saved' })
  confirmPhone(@CurrentAuth() auth: AuthContext, @Body() body: ConfirmPhoneBody): Promise<void> {
    return this.auth.confirmPhone(auth, body);
  }

  @Put('sign-in-confirmation-channel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Choose where the code of the second step of a sign-in goes: email or SMS',
  })
  @ApiNoContentResponse({ description: 'The choice is saved' })
  setSignInConfirmationChannel(
    @CurrentAuth() auth: AuthContext,
    @Body() body: SetSignInConfirmationChannelBody,
  ): Promise<void> {
    return this.auth.setSignInConfirmationChannel(auth, body);
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user and their roles' })
  @ApiOkResponse({ type: CurrentUser })
  currentUser(@CurrentAuth() auth: AuthContext): Promise<CurrentUser> {
    return this.auth.currentUser(auth);
  }
}
