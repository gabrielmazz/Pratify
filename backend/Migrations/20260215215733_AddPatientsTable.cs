using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "patients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    BirthDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Gender = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Weight = table.Column<float>(type: "real", nullable: false),
                    Height = table.Column<float>(type: "real", nullable: false),
                    BMI = table.Column<float>(type: "real", nullable: false),
                    Goal = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActivityLevel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    MedicalConditions = table.Column<string[]>(type: "text[]", nullable: false),
                    ArmCircumference = table.Column<float>(type: "real", nullable: false),
                    WaistCircumference = table.Column<float>(type: "real", nullable: false),
                    HipCircumference = table.Column<float>(type: "real", nullable: false),
                    ThighCircumference = table.Column<float>(type: "real", nullable: false),
                    SubscapularSkinfold = table.Column<float>(type: "real", nullable: false),
                    AxillarySkinfold = table.Column<float>(type: "real", nullable: false),
                    SuprailiacSkinfold = table.Column<float>(type: "real", nullable: false),
                    AbdominalSkinfold = table.Column<float>(type: "real", nullable: false),
                    BMR = table.Column<float>(type: "real", nullable: false),
                    TDEE = table.Column<float>(type: "real", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patients", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "patients");
        }
    }
}
