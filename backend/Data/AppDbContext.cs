// AppDbContext.cs -> Este arquivo define o contexto principal do Entity Framework Core.
//
// O QUE E O DbContext
// - Representa a sessao com o banco de dados.
// - Permite ler/escrever entidades via LINQ.
// - Aplica mapeamentos entre classes C# e tabelas SQL.
// - Participa das migrations (criar/alterar estrutura do banco).
//
// NESTE PROJETO
// - Este contexto registra a entidade User.
// - O mapeamento esta no metodo OnModelCreating.
// - O provider usado e PostgreSQL (configurado em Program.cs).

using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

public class AppDbContext : DbContext
{
    // O EF injeta as opcoes (connection string, provider, etc.) por DI.
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // DbSet<User> representa a tabela de usuarios.
    // Permite consultas e comandos, por exemplo:
    // _context.Users.Add(...), _context.Users.FirstOrDefaultAsync(...)
    public DbSet<User> Users => Set<User>();

    // OnModelCreating centraliza regras de mapeamento da entidade.
    // Aqui definimos nomes de tabela, chaves, tipos, restricoes e indices.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            // Nome fisico da tabela no banco.
            // Mantido em minusculo para padrao comum no PostgreSQL.
            e.ToTable("users");

            // Chave primaria da tabela.
            e.HasKey(x => x.Id);

            // Name obrigatorio e limitado para evitar dados exagerados.
            e.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(120);

            // Email obrigatorio e com tamanho maximo definido.
            e.Property(x => x.Email)
                .IsRequired()
                .HasMaxLength(200);

            // PasswordHash obrigatorio.
            // Armazena hash da senha (nao a senha em texto puro).
            e.Property(x => x.PasswordHash)
                .IsRequired();

            // Data de criacao obrigatoria para auditoria basica.
            e.Property(x => x.CreatedAt)
                .IsRequired();

            // Garante que nao existam dois usuarios com o mesmo email.
            // Isso evita ambiguidade no login.
            e.HasIndex(x => x.Email)
                .IsUnique();
        });

        // Chama implementacao base por boa pratica.
        base.OnModelCreating(modelBuilder);
    }
}
