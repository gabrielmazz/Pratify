// User.cs -> Entidade de dominio que representa um usuario autenticavel no sistema.
//
// PAPEL DA ENTIDADE
// - Define os campos persistidos na tabela users.
// - E usada no fluxo de registro, login e consulta do usuario logado.
// - Serve de base para claims do JWT (id, nome, email).
//
// OBSERVACOES DE SEGURANCA
// - PasswordHash guarda apenas hash da senha.
// - A senha original nunca deve ser salva no banco.

namespace Backend.Models
{
    public class User
    {
        // Identificador unico do usuario (PK).
        // No PostgreSQL, normalmente gerado automaticamente por identidade.
        public int Id { get; set; }

        // Nome exibido do usuario.
        public string Name { get; set; } = string.Empty;

        // Email unico usado para autenticacao.
        public string Email { get; set; } = string.Empty;

        // Hash criptografico da senha.
        // Gerado por IPasswordHasher<User>.
        public string PasswordHash { get; set; } = string.Empty;

        // Momento de criacao do registro em UTC.
        // UTC evita problemas de fuso horario entre ambientes.
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
