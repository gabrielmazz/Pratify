// IJwtTokenService.cs -> Contrato para geracao de token JWT.
//
// POR QUE TER INTERFACE
// - Desacopla controller da implementacao concreta.
// - Facilita testes unitarios (mock/fake do servico).
// - Permite trocar estrategia de token sem alterar consumidores.

using Backend.Models;

namespace Backend.Services;

public interface IJwtTokenService
{
    // Gera token para o usuario informado e retorna token + expiracao.
    TokenResult GenerateToken(User user);
}

// Record simples para carregar resultado da geracao.
// Mantem token e horario exato de expiracao em UTC.
public sealed record TokenResult(string Token, DateTime ExpiresAtUtc);
