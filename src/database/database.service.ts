import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, Client } from '@libsql/client';
import { config } from '../config/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: Client;

  async onModuleInit() {
    const dbUrl = config.db.url;
    const dbToken = config.db.token;

    this.db = createClient(
      dbUrl.startsWith('file:')
        ? { url: dbUrl }
        : { url: dbUrl, authToken: dbToken }
    );

    console.log('📊 DB URL:', dbUrl);
    await this.initializeDatabase();
  }

  private async initializeDatabase() {
    // Crear tabla de usuarios
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS vm_users (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Administrador','Cliente')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await this.db.execute('ALTER TABLE vm_users ADD COLUMN phone TEXT');
    } catch {}

    await this.db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_vm_users_phone_unique ON vm_users(phone) WHERE phone IS NOT NULL`
    );

    // Crear tabla de máquinas virtuales
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS virtual_machines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        cores INTEGER NOT NULL CHECK(cores > 0),
        ram INTEGER NOT NULL CHECK(ram > 0),
        disk INTEGER NOT NULL CHECK(disk > 0),
        os TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Encendida','Apagada','Suspendida')) DEFAULT 'Apagada',
        createdBy TEXT,
        updatedBy TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        statusUpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear tabla de códigos SMS
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS vm_sms_verification_codes (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        used INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME NOT NULL
      )
    `);

    await this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_vm_sms_phone_created ON vm_sms_verification_codes(phone, createdAt DESC)`
    );

    // Seed: Admin y Cliente demo
    const seedUsers = [
      {
        id: 'vm_admin_001',
        nombre: 'Administrador Demo',
        email: 'admin@testfx.local',
        password: 'Admin123!',
        role: 'Administrador',
      },
      {
        id: 'vm_client_001',
        nombre: 'Cliente Demo',
        email: 'cliente@testfx.local',
        password: 'Cliente123!',
        role: 'Cliente',
      },
    ];

    for (const user of seedUsers) {
      const passwordHash = await bcrypt.hash(user.password, config.auth.saltRound);
      await this.db.execute({
        sql: `INSERT OR IGNORE INTO vm_users (id,nombre,email,password_hash,role)
              VALUES (?,?,?,?,?)`,
        args: [user.id, user.nombre, user.email, passwordHash, user.role],
      });
    }

    // Seed: VMs demo
    const seedMachines = [
      {
        id: 'vm_001',
        name: 'core-api-01',
        cores: 4,
        ram: 8,
        disk: 120,
        os: 'Ubuntu 22.04',
        status: 'Encendida',
      },
      {
        id: 'vm_002',
        name: 'backoffice-01',
        cores: 2,
        ram: 4,
        disk: 80,
        os: 'Debian 12',
        status: 'Apagada',
      },
      {
        id: 'vm_003',
        name: 'batch-worker-01',
        cores: 6,
        ram: 16,
        disk: 240,
        os: 'Rocky Linux 9',
        status: 'Suspendida',
      },
    ];

    for (const machine of seedMachines) {
      await this.db.execute({
        sql: `INSERT OR IGNORE INTO virtual_machines
              (id,name,cores,ram,disk,os,status,createdBy,updatedBy)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [
          machine.id,
          machine.name,
          machine.cores,
          machine.ram,
          machine.disk,
          machine.os,
          machine.status,
          'seed',
          'seed',
        ],
      });
    }

    console.log('✅ Tablas VM inicializadas');
  }

  getClient(): Client {
    return this.db;
  }

  async execute(query: string, args?: any[]) {
    return this.db.execute({
      sql: query,
      args: args || [],
    });
  }
}
