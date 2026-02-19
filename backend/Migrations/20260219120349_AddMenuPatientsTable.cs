using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuPatientsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "menu_patients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    PatientId = table.Column<int>(type: "integer", nullable: false),
                    MealGroupsJson = table.Column<string>(type: "jsonb", nullable: false),
                    NutritionGuidanceJson = table.Column<string>(type: "jsonb", nullable: false),
                    RecipeSuggestionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    AiGuidanceHighlightsJson = table.Column<string>(type: "jsonb", nullable: false),
                    AiGenerationSettingsJson = table.Column<string>(type: "jsonb", nullable: false),
                    AiRecipeGenerationSettingsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ActiveDataEntryStep = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_menu_patients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_menu_patients_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_menu_patients_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_menu_patients_PatientId",
                table: "menu_patients",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_menu_patients_UserId_PatientId",
                table: "menu_patients",
                columns: new[] { "UserId", "PatientId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "menu_patients");
        }
    }
}
