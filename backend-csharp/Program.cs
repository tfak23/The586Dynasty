using Backend.CSharp.Data;
using Backend.CSharp.Jobs;
using Backend.CSharp.Middleware;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// =============================================
// CONFIGURATION
// =============================================
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var currentSeason = builder.Configuration.GetValue<int>("LeagueConfiguration:CurrentSeason", 2025);

// =============================================
// SERVICES
// =============================================

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// HttpClient for external API calls (Sleeper)
builder.Services.AddHttpClient();

// Background Jobs
builder.Services.AddHostedService<RosterSyncJob>();

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "The 586 Dynasty API",
        Version = "v1",
        Description = "ASP.NET Core backend for The 586 Dynasty fantasy football league"
    });
});

// Health Checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>();

// Logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var app = builder.Build();

// =============================================
// MIDDLEWARE PIPELINE
// =============================================

// Error handling (must be first)
app.UseErrorHandling();

// Development tools
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "The 586 Dynasty API v1");
        c.RoutePrefix = string.Empty; // Swagger UI at root
    });
}

// CORS
app.UseCors();

// Security headers (equivalent to Helmet in Node.js)
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

// Health check endpoints
app.MapHealthChecks("/health");
app.MapHealthChecks("/api/health");

// Map controllers
app.MapControllers();

// =============================================
// STARTUP
// =============================================
app.Logger.LogInformation("🏈 The 586 Dynasty API (C#) starting up");
app.Logger.LogInformation("   Environment: {Environment}", app.Environment.EnvironmentName);
app.Logger.LogInformation("   Current Season: {Season}", currentSeason);
app.Logger.LogInformation("   Database: PostgreSQL");
app.Logger.LogInformation("   ⏰ Roster sync: every 5 minutes");
app.Logger.LogInformation("   Swagger UI: {Url}", app.Environment.IsDevelopment() ? "http://localhost:5000" : "disabled");

app.Run();
