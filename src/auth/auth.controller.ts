import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthSmsService } from './auth-sms.service';
import { AdminGuard } from './admin.guard';
import { config } from '../config/config';

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authSmsService: AuthSmsService,
  ) {}

  @Post('register')
  async register(@Body() body: any, @Res() res: Response) {
    const { token, user } = await this.authService.register(body);
    res.cookie(config.auth.cookieName, token, this.authService.getCookieOptions());
    return res.status(201).json({ success: true, data: user });
  }

  @Post('login')
  async login(@Body() body: any, @Res() res: Response) {
    const { token, user } = await this.authService.login(body.email, body.password);
    res.cookie(config.auth.cookieName, token, this.authService.getCookieOptions());
    return res.status(200).json({ success: true, data: user });
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie(config.auth.cookieName, this.authService.getCookieOptions());
    return res.status(200).json({ success: true, message: 'Sesión cerrada' });
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Request() req: any) {
    const user = await this.authService.getUser(req.user.userId);
    return { success: true, data: user };
  }

  @Post('sms/send-code')
  async sendSmsCode(@Body() body: any) {
    const result = await this.authSmsService.sendCode(body.phone);
    return { success: true, ...result };
  }

  @Post('sms/verify-code')
  async verifySmsCode(@Body() body: any, @Res() res: Response) {
    const user = await this.authSmsService.verifyCode(body.phone, body.code);
    
    // Crear token para usuario
    const userWithRole = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.role,
    };
    
    const token = this.authService.signToken(userWithRole);
    res.cookie(config.auth.cookieName, token, this.authService.getCookieOptions());

    return res.status(200).json({
      success: true,
      data: userWithRole,
    });
  }

  @Post('users')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async createUser(@Body() body: any, @Request() req: any) {
    const user = await this.authService.createUserByAdmin(body, req.user.userId);
    return { success: true, data: user };
  }
}
