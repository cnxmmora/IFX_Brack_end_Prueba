import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';
import { config } from '../config/config';

@Injectable()
export class SmsService {
  private twilioClient: Twilio | null = null;
  private logger = new Logger('SmsService');

  constructor() {
    try {
      if (config.twilio.accountSid && config.twilio.authToken) {
        this.twilioClient = new Twilio(config.twilio.accountSid, config.twilio.authToken);
        this.logger.log('✓ Twilio inicializado correctamente');
      } else {
        this.logger.warn('⚠ Credenciales de Twilio no configuradas. SMS deshabilitado en desarrollo');
      }
    } catch (error) {
      this.logger.error(`Error inicializando Twilio: ${error.message}`);
    }
  }

  normalizePhoneForSms(rawPhone: any): string | null {
    const input = String(rawPhone ?? '').trim();
    if (!input) return null;

    const compact = input.replaceAll(/[\s()-]/g, '');
    const normalizedRaw = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
    const onlyDigits = normalizedRaw.replaceAll(/\D/g, '');
    const normalized = normalizedRaw.startsWith('+')
      ? `+${onlyDigits}`
      : `${config.twilio.defaultCountryCode}${onlyDigits}`;

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
    return normalized;
  }

  async sendSms(to: string, body: string) {
    if (!this.twilioClient) {
      this.logger.warn('SMS no disponible. Configure las credenciales de Twilio.');
      return { sid: 'mock_sid_dev_mode' };
    }

    const toE164 = this.normalizePhoneForSms(to);
    if (!toE164) throw new Error('Número de teléfono inválido');

    return this.twilioClient.messages.create({
      body,
      from: config.twilio.phone,
      to: toE164,
    });
  }
}
