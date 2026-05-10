import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthSmsService } from './auth-sms.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { DatabaseModule } from '../database/database.module';
import { SmsModule } from '../sms/sms.module';
import { config } from '../config/config';

@Module({
  imports: [
    JwtModule.register({
      secret: config.auth.secretKey,
      signOptions: { expiresIn: '7d' },
    }),
    PassportModule,
    DatabaseModule,
    SmsModule,
  ],
  providers: [AuthService, AuthSmsService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
