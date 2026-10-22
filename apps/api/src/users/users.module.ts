import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/** User profiles (self-service) and admin user management. */
@Module({
  // AuthModule provides AuthService, used to create staff accounts with an
  // invitation link (reusing the account + reset-token machinery).
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
