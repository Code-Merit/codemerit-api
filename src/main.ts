import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import { configDotenv } from 'dotenv';
import { AppModule } from './app.module';
import { UPLOADS_URL_PREFIX, uploadsRoot } from './common/constants/uploads.constants';
import { GlobalExceptionsFilter } from './common/filters/global-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { IAppConfig, appConfig } from './config/app-config';

configDotenv({
  path: `.env`,
});

// A ValidationError for a nested DTO (e.g. CreateQuizDto.settings) has no `constraints`
// of its own — only `children`, one level per nesting depth. Reading
// error.constraints[...] directly (as this pipe used to) throws "Cannot convert
// undefined or null to object" on any nested-field failure instead of returning a 400,
// so this walks `children` recursively and reports each leaf with its full dotted path
// (e.g. "settings.numQuestions") instead of assuming every error is top-level.
function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): { property: string; message: string }[] {
  const result: { property: string; message: string }[] = [];
  for (const error of errors) {
    const property = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints) {
      const firstKey = Object.keys(error.constraints)[0];
      result.push({ property, message: error.constraints[firstKey] });
    }
    if (error.children?.length) {
      result.push(...flattenValidationErrors(error.children, property));
    }
  }
  return result;
}

async function bootstrap() {
  // rawBody: true exposes req.rawBody (Buffer) alongside the normal parsed req.body,
  // without disabling JSON parsing anywhere else — needed for Razorpay/Stripe webhook
  // signature verification, which re-hashes the exact bytes received (see
  // PaymentController's webhook routes and the corresponding provider classes).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Express's 100kb default is too small for a LinkedIn share carrying a captured result-card
  // image (base64 data URL). useBodyParser keeps rawBody intact for the payment webhooks.
  app.useBodyParser('json', { limit: '8mb' });
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

  // Public user uploads (profile pictures). Static middleware runs before the JWT guard, so these
  // load in a plain <img> without a token. Registered AFTER enableCors on purpose — both are plain
  // app.use() in call order, and canvas captures (html2canvas useCORS) need the CORS headers.
  // File names are unique per upload, so they can be cached for long.
  app.useStaticAssets(uploadsRoot(), {
    prefix: `${UPLOADS_URL_PREFIX}/`,
    maxAge: '365d',
    immutable: true,
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
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
        const result = flattenValidationErrors(errors);
        Logger.log('GlobalPipe', JSON.stringify(result));
        return new BadRequestException(
          result.length ? result : [{ property: '', message: 'Validation failed' }],
        );
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
