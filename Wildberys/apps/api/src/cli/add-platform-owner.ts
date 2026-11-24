import { NestFactory } from '@nestjs/core';
import { isEmail } from 'class-validator';

import { AppModule } from '../app.module.js';
import { TeamService } from '../team/team.service.js';

// Makes a person an owner of the platform. The first owner cannot be made in the admin,
// because only an owner can give roles there. Run it with the email as the argument.
const email = process.argv[2]?.trim().toLowerCase();

if (!email || !isEmail(email)) {
  throw new Error('Usage: add-platform-owner <email>');
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const owner = await app.get(TeamService).addOwner(email);

process.stdout.write(
  `${owner.email} is an owner of the platform. Roles: ${owner.roles.join(', ')}\n`,
);

await app.close();
