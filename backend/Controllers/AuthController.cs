// AuthController.cs -> Controller de autenticacao da API.
//
// ROTAS DISPONIVEIS
// - POST /api/auth/register : cria usuario novo e devolve token.
// - POST /api/auth/login    : autentica usuario existente e devolve token.
// - GET  /api/auth/me       : retorna usuario autenticado (rota protegida).
//
// OBJETIVO
// Este controller centraliza o fluxo de identidade local via banco de dados:
// 1) Recebe credenciais do cliente.
// 2) Valida e normaliza dados.
// 3) Persiste/consulta usuario em tabela users.
// 4) Faz hash/verificacao de senha.
// 5) Gera JWT para o cliente manter sessao.
//
// OBSERVACOES DE SEGURANCA
// - Nunca retornamos PasswordHash.
// - Mensagem de erro de login e generica para nao vazar se email existe.
// - Endpoint /me exige token valido por [Authorize].

using System.Security.Claims;
using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

// [ApiController] habilita comportamentos automaticos da Web API:
// - Binding de parametros.
// - Validacao de DataAnnotations.
// - Respostas de erro 400 para payload invalido.
[ApiController]

// Prefixo base do controller: /api/auth
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    // Dependencias de infraestrutura:
    // _context: acesso ao banco (EF Core)
    // _passwordHasher: hash e verificacao de senha
    // _jwtTokenService: geracao de token JWT
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;

    public AuthController(
        AppDbContext context,
        IPasswordHasher<User> passwordHasher,
        IJwtTokenService jwtTokenService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
    }

    // POST /api/auth/register
    // Endpoint aberto (sem token) para criar nova conta.
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        // Normalizacao de email para reduzir duplicidade por variacao de caixa/espaco.
        var email = request.Email.Trim().ToLowerInvariant();

        // Verifica se email ja existe (indice unico no banco reforca esta regra).
        var emailInUse = await _context.Users.AnyAsync(u => u.Email == email, cancellationToken);
        if (emailInUse)
        {
            // 409 Conflict: estado atual do recurso nao permite criar outro com mesmo email.
            return Conflict(new { message = "E-mail ja cadastrado." });
        }

        // Cria entidade de usuario com dados normalizados.
        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email
        };

        // Gera hash seguro da senha antes de persistir.
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        // Persiste no banco.
        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        // Gera token ja no cadastro para usuario entrar automaticamente.
        var token = _jwtTokenService.GenerateToken(user);

        // Retorna token + dados publicos do usuario.
        return Ok(ToAuthResponse(user, token));
    }

    // POST /api/auth/login
    // Endpoint aberto para autenticar credenciais.
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        // Mesma normalizacao usada no cadastro.
        var email = request.Email.Trim().ToLowerInvariant();

        // Busca usuario pelo email.
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        // Nao informar se falhou por email inexistente ou senha invalida.
        if (user is null)
        {
            return Unauthorized(new { message = "Credenciais invalidas." });
        }

        // Compara senha informada com hash salvo.
        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new { message = "Credenciais invalidas." });
        }

        // Se o algoritmo/parametros de hash mudaram, o hasher pode solicitar rehash.
        // Isso permite evoluir seguranca sem forcar reset de senha manual.
        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
            await _context.SaveChangesAsync(cancellationToken);
        }

        // Credenciais validas: gera novo token.
        var token = _jwtTokenService.GenerateToken(user);

        return Ok(ToAuthResponse(user, token));
    }

    // GET /api/auth/me
    // Endpoint protegido, mantido por compatibilidade.
    // Preferir novo endpoint de perfil: GET /api/users/me.
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserResponse>> Me(CancellationToken cancellationToken)
    {
        // NameIdentifier vem das claims adicionadas no JwtTokenService.
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        // Consulta somente campos necessarios para retorno.
        // AsNoTracking evita overhead de tracking para leitura simples.
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        // Token pode ser valido, mas usuario pode nao existir mais no banco.
        if (user is null)
        {
            return Unauthorized(new { message = "Usuario nao encontrado." });
        }

        return Ok(ToAuthCurrentUserResponse(user));
    }

    // Funcao auxiliar para manter padrao unico de resposta de autenticacao.
    private static AuthResponse ToAuthResponse(User user, TokenResult tokenResult)
    {
        return new AuthResponse
        {
            Token = tokenResult.Token,
            ExpiresAtUtc = tokenResult.ExpiresAtUtc,
            User = ToAuthCurrentUserResponse(user)
        };
    }

    // Mapeamento enxuto para o fluxo de autenticacao.
    // Evita retornar imagem em base64 no login/session restore.
    private static CurrentUserResponse ToAuthCurrentUserResponse(User user)
    {
        return new CurrentUserResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            CreatedAt = user.CreatedAt,
            BirthDate = user.BirthDate,
            Specialty = user.Specialty,
            Phone = user.Phone,
            CRN = user.CRN,
            Institution = user.Institution,
            ProfilePicture = null,
            IsVerified = user.IsVerified,
            City = user.City,
            State = user.State
        };
    }
}
