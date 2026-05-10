import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VmService } from './vm.service';
import { AdminGuard } from '../auth/admin.guard';
import { VmGateway } from './vm.gateway';

@Controller()
export class VmController {
  constructor(
    private readonly vmService: VmService,
    private readonly vmGateway: VmGateway,
  ) {}

  @Get('api/vms')
  @UseGuards(AuthGuard('jwt'))
  async listVms() {
    const result = await this.vmService.listVms();
    return { success: true, total: result.total, data: result.data };
  }

  @Get('vms')
  @UseGuards(AuthGuard('jwt'))
  async listVmsAlt() {
    return this.listVms();
  }

  @Get('api/vms/summary')
  @UseGuards(AuthGuard('jwt'))
  async getVmsSummary() {
    const summary = await this.vmService.getVmsSummary();
    return { success: true, data: summary };
  }

  @Get('vms/summary')
  @UseGuards(AuthGuard('jwt'))
  async getVmsSummaryAlt() {
    return this.getVmsSummary();
  }

  @Get('api/vms/:id')
  @UseGuards(AuthGuard('jwt'))
  async getVmById(@Param('id') id: string) {
    const vm = await this.vmService.getVmById(id);
    if (!vm) {
      return { success: false, error: 'VM no encontrada' };
    }
    return { success: true, data: vm };
  }

  @Get('vms/:id')
  @UseGuards(AuthGuard('jwt'))
  async getVmByIdAlt(@Param('id') id: string) {
    return this.getVmById(id);
  }

  @Post('api/vms')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async createVm(@Body() body: any, @Request() req: any) {
    const vm = await this.vmService.createVm(body, req.user.userId);
    this.vmGateway.emitVmEvent('vm:created', vm);
    return { success: true, data: vm };
  }

  @Post('vms')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async createVmAlt(@Body() body: any, @Request() req: any) {
    return this.createVm(body, req);
  }

  @Put('api/vms/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async updateVm(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const vm = await this.vmService.updateVm(id, body, req.user.userId);
    this.vmGateway.emitVmEvent('vm:updated', vm);
    return { success: true, data: vm };
  }

  @Put('vms/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async updateVmAlt(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.updateVm(id, body, req);
  }

  @Delete('api/vms/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async deleteVm(@Param('id') id: string) {
    const vm = await this.vmService.deleteVm(id);
    this.vmGateway.emitVmEvent('vm:deleted', vm);
    return { success: true, data: vm };
  }

  @Delete('vms/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async deleteVmAlt(@Param('id') id: string) {
    return this.deleteVm(id);
  }
}
