import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const VM_STATUSES = ['Encendida', 'Apagada', 'Suspendida'];

const vmCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Nombre mínimo 3 caracteres')
    .max(60, 'Nombre máximo 60 caracteres')
    .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*[A-Za-z0-9]$/, 'Solo letras, números, espacios, guiones'),
  cores: z.coerce.number().int().min(1).max(128),
  ram: z.coerce.number().int().min(1).max(2048),
  disk: z.coerce.number().int().min(1).max(50000),
  os: z.string().trim().min(2).max(40),
  status: z.enum(VM_STATUSES as [string, ...string[]]).default('Apagada'),
});

const vmUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3)
      .max(60)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*[A-Za-z0-9]$/)
      .optional(),
    cores: z.coerce.number().int().min(1).max(128).optional(),
    ram: z.coerce.number().int().min(1).max(2048).optional(),
    disk: z.coerce.number().int().min(1).max(50000).optional(),
    os: z.string().trim().min(2).max(40).optional(),
    status: z.enum(VM_STATUSES as [string, ...string[]]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Envía al menos un campo',
  });

@Injectable()
export class VmService {
  constructor(private databaseService: DatabaseService) {}

  normalizeVmRow(row: any) {
    return {
      id: row[0],
      name: row[1],
      cores: Number(row[2]),
      ram: Number(row[3]),
      disk: Number(row[4]),
      os: row[5],
      status: row[6],
      createdBy: row[7],
      updatedBy: row[8],
      createdAt: row[9],
      updatedAt: row[10],
      statusUpdatedAt: row[11],
    };
  }

  async getVmById(id: string) {
    const result = await this.databaseService.execute(
      `SELECT id,name,cores,ram,disk,os,status,createdBy,updatedBy,createdAt,updatedAt,statusUpdatedAt
       FROM virtual_machines WHERE id = ?`,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.normalizeVmRow(result.rows[0]);
  }

  async listVms() {
    const result = await this.databaseService.execute(
      `SELECT id,name,cores,ram,disk,os,status,createdBy,updatedBy,createdAt,updatedAt,statusUpdatedAt
       FROM virtual_machines ORDER BY createdAt DESC`,
      []
    );

    return {
      total: result.rows.length,
      data: result.rows.map((row) => this.normalizeVmRow(row)),
    };
  }

  async getVmsSummary() {
    const result = await this.databaseService.execute(
      `SELECT status, SUM(cores) AS totalCores, SUM(ram) AS totalRam, SUM(disk) AS totalDisk, COUNT(*) AS total
       FROM virtual_machines GROUP BY status`,
      []
    );

    const summary: any = {
      active: { totalCores: 0, totalRam: 0, totalDisk: 0, total: 0 },
      byStatus: {},
    };

    for (const row of result.rows) {
      const statusKey = String(row[0]);
      const payload = {
        totalCores: Number(row[1] ?? 0),
        totalRam: Number(row[2] ?? 0),
        totalDisk: Number(row[3] ?? 0),
        total: Number(row[4] ?? 0),
      };
      summary.byStatus[statusKey] = payload;
      if (statusKey === 'Encendida') {
        summary.active = payload;
      }
    }

    return summary;
  }

  async createVm(data: any, userId: string) {
    const parsed = vmCreateSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Inválido');
    }

    const vm = parsed.data;
    const duplicate = await this.databaseService.execute(
      'SELECT id FROM virtual_machines WHERE name = ?',
      [vm.name]
    );

    if (duplicate.rows.length > 0) {
      throw new ConflictException('Ya existe VM con ese nombre');
    }

    const id = `vm_${randomUUID()}`;
    await this.databaseService.execute(
      `INSERT INTO virtual_machines (id,name,cores,ram,disk,os,status,createdBy,updatedBy)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, vm.name, vm.cores, vm.ram, vm.disk, vm.os, vm.status, userId, userId]
    );

    return this.getVmById(id);
  }

  async updateVm(id: string, data: any, userId: string) {
    const parsed = vmUpdateSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Inválido');
    }

    const currentVm = await this.getVmById(id);
    if (!currentVm) {
      throw new NotFoundException('VM no encontrada');
    }

    if (parsed.data.name && parsed.data.name !== currentVm.name) {
      const duplicate = await this.databaseService.execute(
        'SELECT id FROM virtual_machines WHERE name = ? AND id <> ?',
        [parsed.data.name, id]
      );

      if (duplicate.rows.length > 0) {
        throw new ConflictException('Ya existe otra VM con ese nombre');
      }
    }

    const nextVm = { ...currentVm, ...parsed.data };
    await this.databaseService.execute(
      `UPDATE virtual_machines
       SET name = ?, cores = ?, ram = ?, disk = ?, os = ?, status = ?, updatedBy = ?, updatedAt = datetime('now'),
           statusUpdatedAt = CASE WHEN status <> ? THEN datetime('now') ELSE statusUpdatedAt END
       WHERE id = ?`,
      [nextVm.name, nextVm.cores, nextVm.ram, nextVm.disk, nextVm.os, nextVm.status, userId, nextVm.status, id]
    );

    return this.getVmById(id);
  }

  async deleteVm(id: string) {
    const currentVm = await this.getVmById(id);
    if (!currentVm) {
      throw new NotFoundException('VM no encontrada');
    }

    await this.databaseService.execute('DELETE FROM virtual_machines WHERE id = ?', [id]);
    return currentVm;
  }
}
