// JwtTokenService.cs -> Implementacao da geracao de tokens JWT.
//
// RESPONSABILIDADE
// - Montar claims do usuario autenticado.
// - Definir emissor, audiencia e expiracao.
// - Assinar o token com chave secreta (HMAC SHA256).
// - Entregar token serializado para o controller.
//
// IMPORTANTE
// - Este servico apenas gera token.
// - Validacao do token acontece no middleware AddJwtBearer (Program.cs).

using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Backend.Configuration;
using Backend.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Services;

public sealed class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    // Configuracoes carregadas da secao Jwt.
    private readonly JwtOptions _options = options.Value;

    public TokenResult GenerateToken(User user)
    {
        // Base temporal sempre em UTC para consistencia entre ambientes.
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(_options.ExpiresMinutes);

        // Conversao explicita com cultura invariavel para evitar variacao regional.
        var userId = user.Id.ToString(CultureInfo.InvariantCulture);

        // Claims carregam informacoes do usuario dentro do token.
        // Essas informacoes poderao ser lidas em endpoints protegidos.
        var claims = new[]
        {
            // Subject padrao do JWT: aqui representa o id do usuario.
            new Claim(JwtRegisteredClaimNames.Sub, userId),

            // Claim padrao do ASP.NET para identificacao.
            new Claim(ClaimTypes.NameIdentifier, userId),

            // Nome e email para uso em autorizacao/logs/contexto.
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Email, user.Email),

            // JTI evita token sem identificador unico.
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Credenciais de assinatura com chave simetrica.
        var signingCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key)),
            SecurityAlgorithms.HmacSha256
        );

        // Cria objeto JWT com metadados principais.
        var jwt = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: signingCredentials
        );

        // Serializa para string final enviada ao cliente.
        var token = new JwtSecurityTokenHandler().WriteToken(jwt);

        return new TokenResult(token, expires);
    }
}
