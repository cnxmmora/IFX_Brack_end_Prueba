import { Module } from '@nestjs/common';
import { VmService } from './vm.service';
import { VmController } from './vm.controller';
import { VmGateway } from './vm.gateway';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [VmService, VmGateway],
  controllers: [VmController],
  exports: [VmService, VmGateway],
})
export class VmModule {}
