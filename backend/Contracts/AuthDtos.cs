// AuthDtos.cs -> Contratos (DTOs) do modulo de autenticacao.
//
// O QUE SAO DTOs
// - Data Transfer Objects: objetos usados para entrada/saida da API.
// - Evitam expor entidades de banco diretamente ao cliente.
// - Permitem validar e controlar formato do payload HTTP.
//
// NESTE ARQUIVO
// - RegisterRequest: payload de cadastro.
// - LoginRequest: payload de login.
// - CurrentUserResponse: dados publicos do usuario autenticado.
// - AuthResponse: retorno de register/login com token + usuario.

using System.ComponentModel.DataAnnotations;

namespace Backend.Contracts;

public sealed class RegisterRequest
{
    // Nome do usuario (obrigatorio).
    // Limites ajudam a evitar dados invalidos e abusivos.
    [Required]
    [StringLength(120, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    // Email obrigatorio e com formato valido.
    // O limite acompanha a regra de mapeamento do banco.
    [Required]
    [EmailAddress]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    // Senha obrigatoria com tamanho minimo basico.
    // A regra pode ser endurecida no futuro (ex: complexidade).
    [Required]
    [StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;
}

public sealed class LoginRequest
{
    // Email usado para localizar o usuario.
    [Required]
    [EmailAddress]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    // Senha em texto puro enviada no login.
    // Sera comparada com hash salvo no banco.
    [Required]
    [StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;
}

public sealed class CurrentUserResponse
{
    // Dados seguros/publicos que podem ser retornados ao frontend.
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public sealed class AuthResponse
{
    // Token JWT para enviar no header Authorization: Bearer <token>.
    public string Token { get; set; } = string.Empty;

    // Horario de expiracao do token em UTC.
    // O frontend pode usar para prever renovacao/logout.
    public DateTime ExpiresAtUtc { get; set; }

    // Dados do usuario autenticado.
    public CurrentUserResponse User { get; set; } = new();
}
