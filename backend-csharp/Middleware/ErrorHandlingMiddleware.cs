using System.Net;
using System.Text.Json;
using Npgsql;

namespace Backend.CSharp.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred");
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        var statusCode = HttpStatusCode.InternalServerError;
        var message = "An internal server error occurred";

        // Handle specific exception types
        if (exception is PostgresException pgEx)
        {
            // PostgreSQL error codes
            switch (pgEx.SqlState)
            {
                case "23505": // Unique constraint violation
                    statusCode = HttpStatusCode.Conflict;
                    message = "A record with this value already exists";
                    break;
                case "23503": // Foreign key violation
                    statusCode = HttpStatusCode.BadRequest;
                    message = "Referenced record does not exist";
                    break;
                case "23514": // Check constraint violation
                    statusCode = HttpStatusCode.BadRequest;
                    message = "Value does not meet database constraints";
                    break;
            }
        }
        else if (exception is ArgumentException or ArgumentNullException)
        {
            statusCode = HttpStatusCode.BadRequest;
            message = exception.Message;
        }
        else if (exception is InvalidOperationException)
        {
            statusCode = HttpStatusCode.BadRequest;
            message = exception.Message;
        }

        // In development, include detailed error info
        if (_env.IsDevelopment())
        {
            message = exception.Message;
        }

        context.Response.StatusCode = (int)statusCode;

        var response = new
        {
            status = "error",
            message = message,
            error = _env.IsDevelopment() ? new
            {
                exception = exception.GetType().Name,
                detail = exception.Message,
                stackTrace = exception.StackTrace
            } : null
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}

public static class ErrorHandlingMiddlewareExtensions
{
    public static IApplicationBuilder UseErrorHandling(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<ErrorHandlingMiddleware>();
    }
}
