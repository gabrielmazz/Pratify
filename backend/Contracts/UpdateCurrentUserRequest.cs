using System.ComponentModel.DataAnnotations;

namespace Backend.Contracts;

// DTO de atualizacao do perfil do usuario autenticado.
// Os campos sao opcionais para permitir limpeza de valor (null) ou atualizacao parcial do bloco de perfil.
public sealed class UpdateCurrentUserRequest
{
    // Recebe string em formato ISO-8601 (ex: 1990-01-01T00:00:00.000Z).
    // Persistida como timestamp with time zone (UTC) no PostgreSQL.
    [StringLength(64)]
    public string? BirthDate { get; set; }

    [StringLength(160)]
    public string? Institution { get; set; }

    [StringLength(30)]
    public string? CRN { get; set; }

    [StringLength(120)]
    public string? City { get; set; }

    [StringLength(120)]
    public string? State { get; set; }
}
