import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as morgan from 'morgan';
import { config } from './config/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Middlewares
  app.use(cookieParser());
  app.use(morgan('dev'));

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  // JSON limit
  app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      req.maxBodySize = '50mb';
    }
    next();
  });

  await app.listen(config.port);
  
  console.log(`🚀 Servidor escuchando en puerto ${config.port}`);
  console.log(`🌍 CORS orígenes permitidos: ${config.corsOrigins.join(', ')}`);
  console.log(`📊 DB: ${config.db.url}`);
  console.log(`🔐 VM_ADMIN_SIGNUP_KEY: ${config.auth.adminSignupKey ? '✓ Configurada' : '✗ No configurada'}`);
}

bootstrap();
