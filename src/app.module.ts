import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { VmModule } from './vm/vm.module';
import { SmsModule } from './sms/sms.module';
import { HealthController } from './health/health.controller';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './task/tasks.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    SmsModule,
    AuthModule,
    VmModule,
    ProjectsModule,
    TasksModule,
    UserModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
