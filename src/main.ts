import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
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
  const app = await NestFactory.create(AppModule);
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
