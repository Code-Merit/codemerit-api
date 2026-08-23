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
      if (
        exception instanceof UnauthorizedException ||
        exception instanceof ForbiddenException
      ) {
        message = `${exception.message}, Unauthorized access. Invalid token or login required.`;
      } else {
        message =
          typeof res === 'string'
            ? res
            : (res as any).message || JSON.stringify(res);
      }
    }

    // TypeORM Query Error
    else if (exception instanceof QueryFailedError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = `${(exception as any).driverError?.detail || exception.message}`;
      // message = `Database error: ${(exception as any).driverError?.detail || exception.message}`;
    }

    // TypeORM Not Found
    else if (exception instanceof EntityNotFoundError) {
      statusCode = HttpStatus.NOT_FOUND;
      message = 'Entity not found in database';
    }

    // Application-level errors
    else if (exception instanceof AppCustomException) {
      statusCode = exception.status;
      message = exception.message;
      code = exception.code;
    }

    // Fallback for other types
    else if (exception?.message) {
      message = exception.message;
    }

    // Log for debugging
    // console.error('Error caught:', exception);
    console.error('Error message:', message);

    response.status(statusCode).json({
      error: true,
      statusCode: statusCode,
      message: message && Array.isArray(message) ? message[0].message : message,
      code,
      data: null,
    });
  }
}
