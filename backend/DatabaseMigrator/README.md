# DatabaseMigrator

Pasta utilitaria para aplicar todas as migrations pendentes do backend no banco de dados sem resetar schema e sem recriar banco.

## Como funciona

- Executa `dotnet ef database update` apontando para `backend/backend.csproj`.
- Usa a mesma configuracao de conexao do backend (`ConnectionStrings:Default`).
- Aplica somente migrations pendentes.

## Rodar

Da raiz do repositorio:

```bash
bash backend/DatabaseMigrator/run-migrator.sh
```

No PowerShell (Windows):

```powershell
.\backend\DatabaseMigrator\run-migrator.ps1
```

## Backup recomendado (PostgreSQL)

Antes de alterar estrutura em ambiente importante, faca backup:

```bash
pg_dump -h localhost -U postgres -d pratify -F c -f backup_pratify.dump
```

## Observacoes

- Nao executa `EnsureDeleted`, `DropDatabase` ou qualquer comando destrutivo automatico.
- Risco de perda de dados so existe se uma migration sua tiver operacoes destrutivas (`DropColumn`, `DropTable`, etc.).
