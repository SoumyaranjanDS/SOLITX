import { AppError } from "../utils/AppError.js";

const errorHandler = (err, req, res, next) => {
    let error = err;

    // If the error isn't an instance of our custom AppError, we convert it
    if (!(error instanceof AppError)) {
        const statusCode = error.statusCode ? error.statusCode : 500;
        const message = error.message || "Internal Server Error";
        error = new AppError(statusCode, message, error?.errors || [], err.stack);
    }

    const response = {
        success: error.success,
        message: error.message,
        errors: error.errors,
        // Only show the stack trace if we are in development mode
        ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {})
    };

    return res.status(error.statusCode).json(response);
};

export { errorHandler };
