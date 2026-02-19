using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuPatientHistoryPaginationSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_menu_patients_UserId_PatientId",
                table: "menu_patients");

            migrationBuilder.CreateIndex(
                name: "IX_menu_patients_UserId_PatientId",
                table: "menu_patients",
                columns: new[] { "UserId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_menu_patients_UserId_PatientId_UpdatedAt",
                table: "menu_patients",
                columns: new[] { "UserId", "PatientId", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_menu_patients_UserId_PatientId",
                table: "menu_patients");

            migrationBuilder.DropIndex(
                name: "IX_menu_patients_UserId_PatientId_UpdatedAt",
                table: "menu_patients");

            migrationBuilder.CreateIndex(
                name: "IX_menu_patients_UserId_PatientId",
                table: "menu_patients",
                columns: new[] { "UserId", "PatientId" },
                unique: true);
        }
    }
}
