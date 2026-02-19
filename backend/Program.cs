// Program.cs -> Este arquivo e o ponto central de inicializacao do backend.
//
// RESUMO DO QUE ACONTECE AQUI
// 1) A aplicacao le configuracoes (appsettings + variaveis de ambiente).
// 2) O container de injecao de dependencia (DI) registra os servicos.
// 3) O pipeline HTTP e montado (middlewares em ordem de execucao).
// 4) As rotas dos controllers sao mapeadas e a API comeca a ouvir requisicoes.
//
// SOBRE AUTENTICACAO NESTE PROJETO
// - O backend usa JWT Bearer.
// - O token e gerado no login em AuthController usando JwtTokenService.
// - O token e validado automaticamente pelo middleware AddJwtBearer.
// - Endpoints protegidos usam [Authorize].
//
// FLUXO COMPLETO DE REQUISICAO
// Cliente -> CORS -> Authentication -> Authorization -> Controller -> Resposta
//
// ORDEM IMPORTA
// A ordem dos middlewares no final do arquivo precisa ser preservada.
// Exemplo: UseAuthentication sempre antes de UseAuthorization.

using System.Text;
using Backend.Configuration;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Context;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;

// Cria o builder principal da aplicacao ASP.NET Core.
// O builder concentra configuracao, servicos e ambiente.
var builder = WebApplication.CreateBuilder(args);

// Nome da politica CORS usada para permitir chamadas do frontend.
// Manter em constante evita strings soltas e erro de digitacao.
const string FrontendCorsPolicy = "FrontendCorsPolicy";

// Compatibilidade com o script ia/env.sh:
// se LLM_BASE_URL/LLM_MODEL existirem, eles alimentam a secao Ollama.
if (string.IsNullOrWhiteSpace(builder.Configuration[$"{OllamaOptions.SectionName}:BaseUrl"]))
{
    var llmBaseUrl = builder.Configuration["LLM_BASE_URL"];
    if (!string.IsNullOrWhiteSpace(llmBaseUrl))
    {
        builder.Configuration[$"{OllamaOptions.SectionName}:BaseUrl"] = llmBaseUrl;
    }
}

if (string.IsNullOrWhiteSpace(builder.Configuration[$"{OllamaOptions.SectionName}:Model"]))
{
    var llmModel = builder.Configuration["LLM_MODEL"];
    if (!string.IsNullOrWhiteSpace(llmModel))
    {
        builder.Configuration[$"{OllamaOptions.SectionName}:Model"] = llmModel;
    }
}

// Logging padronizado para toda a API:
// - Saida colorida no console.
// - Template com timestamp + nivel + categoria.
// - Nivel dos logs SQL controlado por Logging:ShowEfSql no appsettings.
var showEfSqlInLogs = builder.Configuration.GetValue<bool?>("Logging:ShowEfSql") ?? false;
builder.Host.UseSerilog((context, _, loggerConfiguration) =>
{
    var minimumLevel = context.HostingEnvironment.IsDevelopment()
        ? LogEventLevel.Information
        : LogEventLevel.Warning;
    var efSqlLevel = showEfSqlInLogs
        ? LogEventLevel.Information
        : LogEventLevel.Warning;

    loggerConfiguration
        .MinimumLevel.Is(minimumLevel)
        .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
        .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore", efSqlLevel)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", efSqlLevel)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "nutrisaas-backend")
        .WriteTo.Console(
            theme: AnsiConsoleTheme.Code,
            outputTemplate: "[{Timestamp:HH:mm:ss.fff} {Level:u3}] [{Application}] [{SourceContext}] {Message:lj}{NewLine}{Exception}");
});

// AddControllers habilita o modelo MVC baseado em controllers.
// Sem isso, classes com [ApiController] nao serao descobertas automaticamente.
builder.Services.AddControllers();

// AddEndpointsApiExplorer + AddSwaggerGen habilitam documentacao OpenAPI/Swagger.
// Isso facilita teste local de endpoints (register/login/me) sem frontend.
builder.Services.AddEndpointsApiExplorer();

// Le a secao "Jwt" definida no appsettings.json.
// Esta secao contem chave secreta, issuer, audience e expiracao do token.
var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
var jwtOptions = jwtSection.Get<JwtOptions>() ?? throw new InvalidOperationException("JWT configuration is missing.");

// Validacao minima de seguranca para a chave JWT.
// Chaves curtas sao mais fracas para HMAC e devem ser evitadas.
if (string.IsNullOrWhiteSpace(jwtOptions.Key) || jwtOptions.Key.Length < 32)
{
    throw new InvalidOperationException("JWT Key must have at least 32 characters.");
}

// Registra JwtOptions no DI para que outros servicos (JwtTokenService)
// possam receber configuracao via IOptions<JwtOptions>.
builder.Services.Configure<JwtOptions>(jwtSection);

// Configuracao do Swagger com esquema de seguranca Bearer.
// Com isso, no Swagger UI e possivel clicar em Authorize e testar endpoints
// protegidos enviando o token no header Authorization.
builder.Services.AddSwaggerGen(options =>
{
    // Define o esquema "Bearer" que aparecera na UI do Swagger.
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Use: Bearer {your JWT token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    // Aplica o esquema globalmente aos endpoints da documentacao.
    // Na pratica, o Swagger passa a saber que a API pode exigir token.
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Registro do Entity Framework Core com provider PostgreSQL.
// A connection string "Default" vem de appsettings.json.
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    var cs = builder.Configuration.GetConnectionString("Default");
    opt.UseNpgsql(cs);
});

// Servico nativo de hash de senha do ASP.NET Core Identity.
// - HashPassword: gera hash seguro para armazenamento.
// - VerifyHashedPassword: compara senha digitada com hash salvo.
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// Servico interno da aplicacao responsavel por gerar tokens JWT.
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();

// Integracao com Ollama local (IA).
builder.Services.Configure<OllamaOptions>(builder.Configuration.GetSection(OllamaOptions.SectionName));
builder.Services.AddHttpClient<IOllamaService, OllamaService>((serviceProvider, client) =>
{
    var options = serviceProvider
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<OllamaOptions>>()
        .Value;

    var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl)
        ? "http://127.0.0.1:11434"
        : options.BaseUrl.Trim();

    if (!baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
        && !baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
    {
        baseUrl = $"http://{baseUrl}";
    }

    client.BaseAddress = new Uri($"{baseUrl.TrimEnd('/')}/");

    var timeoutSeconds = options.TimeoutSeconds <= 0 ? 120 : options.TimeoutSeconds;
    client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
});

// Configura autenticacao da API com esquema JWT Bearer.
// Todo token recebido no header Authorization: Bearer <token>
// sera validado com as regras abaixo.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            // Garante que o emissor do token (issuer) seja o esperado.
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,

            // Garante que o destinatario (audience) seja o esperado.
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,

            // Garante assinatura criptografica valida com a mesma chave secreta.
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),

            // Rejeita token expirado.
            ValidateLifetime = true,

            // Remove tolerancia de tempo padrao para expiracao.
            // Com Zero, expira exatamente no horario definido no token.
            ClockSkew = TimeSpan.Zero
        };
    });

// Habilita avaliacao de autorizacao ([Authorize], politicas etc.).
builder.Services.AddAuthorization();

// Politica de CORS para frontend local.
// Necessario quando frontend e backend rodam em origens diferentes (porta/domino).
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:4200",
                "https://localhost:4200",
                "http://localhost:5173",
                "https://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Construcao final da aplicacao apos registrar todos os servicos.
var app = builder.Build();

// Swagger habilitado apenas em Development para facilitar desenvolvimento local.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// PIPELINE HTTP (ordem de execucao)

// Redireciona HTTP para HTTPS quando aplicavel.
app.UseHttpsRedirection();

// Enriquecimento de contexto por requisicao + log resumido de cada request.
app.Use(async (httpContext, next) =>
{
    using (LogContext.PushProperty("RequestId", httpContext.TraceIdentifier))
    {
        await next();
    }
});
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} -> {StatusCode} em {Elapsed:0.0000} ms";
    options.GetLevel = (httpContext, _, exception) =>
    {
        if (exception is not null || httpContext.Response.StatusCode >= 500)
        {
            return LogEventLevel.Error;
        }

        if (httpContext.Response.StatusCode >= 400)
        {
            return LogEventLevel.Warning;
        }

        return LogEventLevel.Information;
    };
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestId", httpContext.TraceIdentifier);
        diagnosticContext.Set("ClientIp", httpContext.Connection.RemoteIpAddress?.ToString() ?? "-");
    };
});

// Aplica regras de CORS antes dos endpoints.
app.UseCors(FrontendCorsPolicy);

// Le token e monta HttpContext.User quando autenticado.
app.UseAuthentication();

// Aplica [Authorize] e regras de acesso com base no usuario autenticado.
app.UseAuthorization();

// Mapeia rotas dos controllers (ex: /api/auth/login).
app.MapControllers();

// Inicia a API.
app.Run();
Log.CloseAndFlush();
