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

        // Data de nascimento do usuario, opcional.
        // Armazenada em UTC para mapear com "timestamp with time zone" no PostgreSQL.
        public DateTime? BirthDate { get; set; }

        // Especialidade do usuario, opcional.
        public string? Specialty { get; set; }

        // Telefone do usuario, opcional.
        public string? Phone { get; set; }

        // Numero de registro profissional (CRN - Conselho Regional de Nutricionistas).
        // Opcional, pois não podemos exigir que os usuarios tenham CRN para usar a plataforma, 
        // mas é importante para validar a autenticidade dos profissionais.
        public string? CRN { get; set; }

        // Instituicao de formacao.
        public string? Institution { get; set; }
        
        // Conteudo binario da foto de perfil para armazenamento no banco.
        public byte[]? ProfilePictureData { get; set; }

        // Indicador se perfil esta verificado/ativo.
        public bool IsVerified { get; set; } = false;

        // Cidade/estado de atuacao.
        public string? City { get; set; }
        public string? State { get; set; }

    }
}
