import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { SmsService } from '../sms/sms.service';
import { config } from '../config/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';

const vmEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const vmLoginSchema = z.object({
  email: z.string().trim().regex(vmEmailRegex, 'Correo electrónico inválido'),
  password: z.string().trim().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const vmRegisterSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre mínimo 2 caracteres').max(80, 'El nombre máximo 80 caracteres'),
  email: z.string().trim().regex(vmEmailRegex, 'Correo inválido'),
  password: z.string().trim().min(8, 'Contraseña mínimo 8 caracteres').max(128, 'Contraseña muy larga'),
  phone: z.string().trim().min(8, 'Teléfono inválido').max(25, 'Teléfono inválido').optional(),
  role: z.string().trim().optional(),
  adminKey: z.string().trim().optional(),
});

const vmAdminCreateUserSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre mínimo 2 caracteres').max(80, 'Nombre máximo 80 caracteres'),
  email: z.string().trim().regex(vmEmailRegex, 'Correo inválido'),
  password: z.string().trim().min(8, 'Contraseña mínimo 8 caracteres').max(128, 'Contraseña muy larga'),
  phone: z.string().trim().min(8, 'Teléfono inválido').max(25, 'Teléfono inválido').optional(),
  role: z.string().trim().min(1, 'Rol obligatorio'),
});

@Injectable()
export class AuthService {
  private readonly emailRegex = vmEmailRegex;

  constructor(
    private jwtService: JwtService,
    private databaseService: DatabaseService,
    private smsService: SmsService,
  ) {}

  normalizeRole(role: any): string | null {
    const normalized = String(role ?? '').trim().toLowerCase();
    if (normalized === 'admin' || normalized === 'administrador') return 'Administrador';
    if (normalized === 'client' || normalized === 'cliente') return 'Cliente';
    return null;
  }

  signToken(user: any) {
    return this.jwtService.sign(
      {
        userId: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        scope: 'vm',
      },
      { expiresIn: '7d' }
    );
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      sameSite: config.isProduction ? ('none' as const) : ('lax' as const),
      secure: config.isProduction,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  async login(email: string, password: string) {
    const parsed = vmLoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Inválido');
    }

    const result = await this.databaseService.execute(
      'SELECT id,nombre,email,password_hash,role,status FROM vm_users WHERE email = ?',
      [email]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const row = result.rows[0];
    const user = {
      id: row[0],
      nombre: row[1],
      email: row[2],
      passwordHash: row[3],
      role: row[4],
      status: row[5],
    };

    if (user.status !== 'active') {
      throw new ForbiddenException('Cuenta desactivada');
    }

    const isValidPassword = await bcrypt.compare(password, String(user.passwordHash));
    if (!isValidPassword) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const token = this.signToken(user);

    return {
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(data: any) {
    const parsed = vmRegisterSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Inválido');
    }

    const { nombre, email, password, phone, role, adminKey } = parsed.data;
    const normalizedPhone = phone ? this.smsService.normalizePhoneForSms(phone) : null;

    if (!normalizedPhone) {
      throw new BadRequestException('Teléfono inválido o obligatorio');
    }

    const normalizedRole = this.normalizeRole(role ?? 'Cliente');
    if (!normalizedRole) {
      throw new BadRequestException('Rol inválido');
    }

    if (normalizedRole === 'Administrador') {
      if (!config.auth.adminSignupKey) {
        throw new ForbiddenException('Registro de admin deshabilitado');
      }
      if (adminKey !== config.auth.adminSignupKey) {
        throw new ForbiddenException('Clave de admin inválida');
      }
    }

    const existingUser = await this.databaseService.execute(
      'SELECT id FROM vm_users WHERE email = ?',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictException('Correo ya existe');
    }

    const existingPhone = await this.databaseService.execute(
      'SELECT id FROM vm_users WHERE phone = ?',
      [normalizedPhone]
    );

    if (existingPhone.rows.length > 0) {
      throw new ConflictException('Teléfono ya existe');
    }

    const id = `vm_user_${randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, config.auth.saltRound);

    await this.databaseService.execute(
      `INSERT INTO vm_users (id,nombre,email,phone,password_hash,role,status,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,'active',datetime('now'),datetime('now'))`,
      [id, nombre, email, normalizedPhone, passwordHash, normalizedRole]
    );

    const user = {
      id,
      nombre,
      email,
      role: normalizedRole,
    };

    const token = this.signToken(user);

    return { token, user };
  }

  async createUserByAdmin(data: any, adminUserId: string) {
    const parsed = vmAdminCreateUserSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Inválido');
    }

    const { nombre, email, password, phone, role } = parsed.data;
    const normalizedPhone = phone ? this.smsService.normalizePhoneForSms(phone) : null;
    const normalizedRole = this.normalizeRole(role);

    if (!normalizedRole) {
      throw new BadRequestException('Rol inválido');
    }

    if (phone && !normalizedPhone) {
      throw new BadRequestException('Teléfono inválido');
    }

    const existingUser = await this.databaseService.execute(
      'SELECT id FROM vm_users WHERE email = ?',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictException('Correo ya existe');
    }

    if (normalizedPhone) {
      const existingPhone = await this.databaseService.execute(
        'SELECT id FROM vm_users WHERE phone = ?',
        [normalizedPhone]
      );

      if (existingPhone.rows.length > 0) {
        throw new ConflictException('Teléfono ya existe');
      }
    }

    const id = `vm_user_${randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, config.auth.saltRound);

    await this.databaseService.execute(
      `INSERT INTO vm_users (id,nombre,email,phone,password_hash,role,status,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,'active',datetime('now'),datetime('now'))`,
      [id, nombre, email, normalizedPhone, passwordHash, normalizedRole]
    );

    return {
      id,
      nombre,
      email,
      role: normalizedRole,
      createdBy: adminUserId,
    };
  }

  async getUser(userId: string) {
    const result = await this.databaseService.execute(
      'SELECT id,nombre,email,role,status,createdAt FROM vm_users WHERE id = ?',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const row = result.rows[0];
    return {
      id: row[0],
      nombre: row[1],
      email: row[2],
      role: row[3],
      status: row[4],
      createdAt: row[5],
    };
  }
}
