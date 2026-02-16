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
using Microsoft.EntityFrameworkCore.ChangeTracking;
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
    public DbSet<Patient> Patients => Set<Patient>();

    // OnModelCreating centraliza regras de mapeamento da entidade.
    // Aqui definimos nomes de tabela, chaves, tipos, restricoes e indices.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {

        // Configura mapeamento da entidade User para a tabela users.
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

            // Data de nascimento opcional.
            e.Property(x => x.BirthDate)
                .HasColumnType("timestamp with time zone");

            // Especialidade opcional com limite de tamanho.
            e.Property(x => x.Specialty)
                .HasMaxLength(120);

            // Telefone opcional.
            e.Property(x => x.Phone)
                .HasMaxLength(20);

            // Registro profissional opcional.
            e.Property(x => x.CRN)
                .HasMaxLength(30);

            // Instituicao de formacao opcional.
            e.Property(x => x.Institution)
                .HasMaxLength(160);

            // Foto de perfil armazenada em binario no PostgreSQL.
            e.Property(x => x.ProfilePictureData)
                .HasColumnType("bytea");

            // Flag de verificacao com valor padrao false.
            e.Property(x => x.IsVerified)
                .IsRequired()
                .HasDefaultValue(false);

            // Localizacao opcional.
            e.Property(x => x.City)
                .HasMaxLength(120);

            e.Property(x => x.State)
                .HasMaxLength(120);

            // Garante que nao existam dois usuarios com o mesmo email.
            // Isso evita ambiguidade no login.
            e.HasIndex(x => x.Email)
                .IsUnique();


        });

        // Configura mapeamento da entidade Patient para a tabela patients.
        modelBuilder.Entity<Patient>(e =>
        {
            e.ToTable("patients");
            e.HasKey(x => x.Id);

            e.HasOne<User>()
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(160);

            e.Property(x => x.BirthDate)
                .IsRequired();

            e.Property(x => x.Gender)
                .IsRequired()
                .HasMaxLength(30);

            e.Property(x => x.Weight)
                .IsRequired();

            e.Property(x => x.Height)
                .IsRequired();

            e.Property(x => x.BMI)
                .IsRequired();

            e.Property(x => x.Goal)
                .IsRequired()
                .HasMaxLength(200);

            e.Property(x => x.CreatedAt)
                .IsRequired();

            e.Property(x => x.ActivityLevel)
                .IsRequired()
                .HasMaxLength(40);

            // Lista de condicoes medicas armazenada como array de texto no PostgreSQL.
            e.Property(x => x.MedicalConditions)
                .HasColumnType("text[]")
                .HasConversion(
                    v => v.ToArray(),
                    v => v == null ? new List<string>() : v.ToList(),
                    new ValueComparer<List<string>>(
                        (left, right) => (left ?? new List<string>()).SequenceEqual(right ?? new List<string>()),
                        list => list == null
                            ? 0
                            : list.Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
                        list => list == null ? new List<string>() : list.ToList()))
                .IsRequired();

            e.Property(x => x.ArmCircumference)
                .IsRequired();

            e.Property(x => x.WaistCircumference)
                .IsRequired();

            e.Property(x => x.HipCircumference)
                .IsRequired();

            e.Property(x => x.ThighCircumference)
                .IsRequired();

            e.Property(x => x.SubscapularSkinfold)
                .IsRequired();

            e.Property(x => x.AxillarySkinfold)
                .IsRequired();

            e.Property(x => x.SuprailiacSkinfold)
                .IsRequired();

            e.Property(x => x.AbdominalSkinfold)
                .IsRequired();

            e.Property(x => x.BMR)
                .IsRequired();

            e.Property(x => x.TDEE)
                .IsRequired();
        });

        // Chama implementacao base por boa pratica.
        base.OnModelCreating(modelBuilder);
    }
}
