import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Handle Postgres errors
  if ((err as any).code) {
    const pgError = err as any;
    
    switch (pgError.code) {
      case '23505': // unique_violation
        return res.status(409).json({
          status: 'error',
          message: 'A record with this value already exists',
        });
      case '23503': // foreign_key_violation
        return res.status(400).json({
          status: 'error',
          message: 'Referenced record does not exist',
        });
      case '23514': // check_violation
        return res.status(400).json({
          status: 'error',
          message: 'Value violates check constraint',
        });
    }
  }

  // Default error
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
}
