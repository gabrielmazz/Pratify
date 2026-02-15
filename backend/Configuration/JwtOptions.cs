// JwtOptions.cs -> Classe de configuracao tipada para a secao "Jwt" do appsettings.
//
// POR QUE USAR OPTIONS TIPADAS
// - Evita strings espalhadas no codigo.
// - Melhora manutencao (campos centralizados).
// - Facilita validacao e leitura via IntelliSense.
//
// COMO E USADA
// - Program.cs: le configuracao e configura validacao do token.
// - JwtTokenService: le configuracao para gerar token (issuer, audience, expiracao, chave).

namespace Backend.Configuration;

public sealed class JwtOptions
{
    // Nome da secao no appsettings.json.
    public const string SectionName = "Jwt";

    // Chave secreta usada para assinar e validar o JWT (HMAC SHA256).
    // Deve ser longa e protegida (idealmente em segredo de ambiente).
    public string Key { get; init; } = string.Empty;

    // Emissor do token.
    // Usado na validacao para garantir origem esperada.
    public string Issuer { get; init; } = string.Empty;

    // Destinatario do token.
    // Usado para validar que o token foi emitido para este sistema.
    public string Audience { get; init; } = string.Empty;

    // Tempo de vida do token em minutos.
    public int ExpiresMinutes { get; init; } = 120;
}
