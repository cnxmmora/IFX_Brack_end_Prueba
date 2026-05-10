import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SmsService } from '../sms/sms.service';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const vmSmsSendSchema = z.object({
  phone: z.string().trim().min(8, 'Teléfono inválido').max(25, 'Teléfono inválido'),
});

const vmSmsVerifySchema = z.object({
  phone: z.string().trim().min(8, 'Teléfono inválido').max(25, 'Teléfono inválido'),
  code: z.string().trim().regex(/^\d{6}$/, 'Código debe ser 6 dígitos'),
});

@Injectable()
export class AuthSmsService {
  constructor(
    private databaseService: DatabaseService,
    private smsService: SmsService,
  ) {}

  async sendCode(phone: string) {
    const parsed = vmSmsSendSchema.safeParse({ phone });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Inválido');
    }

    const normalizedPhone = this.smsService.normalizePhoneForSms(parsed.data.phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Teléfono inválido');
    }

    const userResult = await this.databaseService.execute(
      'SELECT id FROM vm_users WHERE phone = ?',
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('Teléfono no registrado');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.databaseService.execute(
      `INSERT INTO vm_sms_verification_codes (id,phone,code,attempts,used,createdAt,expiresAt)
       VALUES (?, ?, ?, 0, 0, datetime('now'), datetime('now', '+10 minutes'))`,
      [`sms_${randomUUID()}`, normalizedPhone, code]
    );

    const sms = await this.smsService.sendSms(
      normalizedPhone,
      `Tu código de acceso TestFX es: ${code}. Válido por 10 minutos.`
    );

    return { message: 'Código enviado por SMS', sid: sms.sid };
  }

  async verifyCode(phone: string, code: string) {
    const parsed = vmSmsVerifySchema.safeParse({ phone, code });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Inválido');
    }

    const normalizedPhone = this.smsService.normalizePhoneForSms(parsed.data.phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Teléfono inválido');
    }

    const codeResult = await this.databaseService.execute(
      `SELECT id,code,attempts FROM vm_sms_verification_codes
       WHERE phone = ? AND used = 0 AND expiresAt > datetime('now')
       ORDER BY createdAt DESC LIMIT 1`,
      [normalizedPhone]
    );

    if (codeResult.rows.length === 0) {
      throw new BadRequestException('Código inválido o expirado');
    }

    const codeRow = codeResult.rows[0];
    const smsId = codeRow[0];
    const storedCode = String(codeRow[1]);
    const attempts = Number(codeRow[2] ?? 0);

    if (attempts >= 5) {
      throw new BadRequestException('Demasiados intentos');
    }

    if (parsed.data.code !== storedCode) {
      await this.databaseService.execute(
        'UPDATE vm_sms_verification_codes SET attempts = attempts + 1 WHERE id = ?',
        [smsId]
      );
      throw new BadRequestException('Código incorrecto');
    }

    await this.databaseService.execute(
      'UPDATE vm_sms_verification_codes SET used = 1 WHERE id = ?',
      [smsId]
    );

    const userResult = await this.databaseService.execute(
      'SELECT id,nombre,email,role,status FROM vm_users WHERE phone = ? LIMIT 1',
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundException('Teléfono no registrado');
    }

    const row = userResult.rows[0];
    const user = {
      id: row[0],
      nombre: row[1],
      email: row[2],
      role: row[3],
      status: row[4],
    };

    return user;
  }
}
