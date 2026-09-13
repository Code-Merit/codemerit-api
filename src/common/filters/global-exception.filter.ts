import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { AppCustomException } from '../exceptions/app-custom-exception.filter';

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (exception instanceof UnauthorizedException) {
        message = 'Please log in to continue.';
      } else if (exception instanceof ForbiddenException) {
        message = "You don't have permission to do that.";
      } else {
        message =
          typeof res === 'string'
            ? res
            : (res as any).message || JSON.stringify(res);
      }
    }

    // TypeORM Query Error — never forward the raw driver message (schema/column details,
    // constraint names) to the client; it's a server-side fault (bad query, missing
    // migration, etc.), not something the caller did wrong, so it's logged in full below
    // and reported generically here.
    else if (exception instanceof QueryFailedError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Something went wrong on our end. Please try again in a moment.';
    }

    // TypeORM Not Found
    else if (exception instanceof EntityNotFoundError) {
      statusCode = HttpStatus.NOT_FOUND;
      message = 'The requested item could not be found.';
    }

    // Application-level errors — message is already written to be shown to the user.
    else if (exception instanceof AppCustomException) {
      statusCode = exception.status;
      message = exception.message;
      code = exception.code;
    }

    // Fallback for anything else (unexpected runtime errors) — same reasoning as
    // QueryFailedError above: the raw message is an implementation detail, not a
    // user-facing explanation, so it's logged, not returned.
    else if (exception?.message) {
      message = 'Something went wrong on our end. Please try again in a moment.';
    }

    // Log the real error server-side regardless of what the client sees above.
    console.error('Error caught:', exception);

    response.status(statusCode).json({
      error: true,
      statusCode: statusCode,
      message: message && Array.isArray(message) ? message[0].message : message,
      code,
      data: null,
    });
  }
}
