import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configDotenv } from 'dotenv';
import { AppModule } from './app.module';
import { GlobalExceptionsFilter } from './common/filters/global-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { IAppConfig, appConfig } from './config/app-config';

configDotenv({
  path: `.env`,
});

async function bootstrap() {
  // rawBody: true exposes req.rawBody (Buffer) alongside the normal parsed req.body,
  // without disabling JSON parsing anywhere else — needed for Razorpay/Stripe webhook
  // signature verification, which re-hashes the exact bytes received (see
  // PaymentController's webhook routes and the corresponding provider classes).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config: IAppConfig = app.get<IAppConfig>(appConfig.KEY);

  // Enable CORS for localhost dev
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map((url) => url.trim()) || [];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalInterceptors(new ResponseInterceptor(), new AuditInterceptor());
  app.useGlobalFilters(new GlobalExceptionsFilter());
  /* Add Swagger  */
  const options = new DocumentBuilder()
    .setTitle('CodeMerit API')
    .setDescription('Rest API Documentation')
    .setVersion('1.0')
    .addServer('http://localhost:3000/', 'Local environment')
    .addServer('https://qa.appdevops.in/', 'Staging')
    .addServer('https://prod.appdevops.in/', 'Production')
    .addTag('CodeMerit')
    // Registers the 'access-token' security scheme referenced by every
    // @ApiBearerAuth('access-token') decorator across the controllers — without this,
    // those decorators point at an undefined scheme and Swagger UI's Authorize button
    // has nothing to attach the JWT to.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: false,
      exceptionFactory: (errors) => {
        const result = errors.map((error) => ({
          property: error.property,
          message: error.constraints[Object.keys(error.constraints)[0]],
        }));
        Logger.log('GlobalPipe', JSON.stringify(result));
        return new BadRequestException(result);
      },
      stopAtFirstError: true,
    }),
  );
  // app.setGlobalPrefix('api');
  await app.listen(config.port, () => {
    console.log(`Server is listening on port : ${config.port}`);
  });
}
bootstrap();
