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

// Cria o builder principal da aplicacao ASP.NET Core.
// O builder concentra configuracao, servicos e ambiente.
var builder = WebApplication.CreateBuilder(args);

// Nome da politica CORS usada para permitir chamadas do frontend.
// Manter em constante evita strings soltas e erro de digitacao.
const string FrontendCorsPolicy = "FrontendCorsPolicy";

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
