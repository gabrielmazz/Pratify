using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class ChangeUserBirthDateToTimestamptz : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "users"
                ALTER COLUMN "BirthDate" TYPE timestamp with time zone
                USING CASE
                    WHEN "BirthDate" IS NULL THEN NULL
                    ELSE make_timestamptz("BirthDate", 1, 1, 0, 0, 0, 'UTC')
                END;
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "users"
                ALTER COLUMN "BirthDate" TYPE integer
                USING CASE
                    WHEN "BirthDate" IS NULL THEN NULL
                    ELSE EXTRACT(YEAR FROM "BirthDate")::integer
                END;
                """
            );
        }
    }
}
