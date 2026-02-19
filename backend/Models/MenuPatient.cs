namespace Backend.Models;

// Entidade que persiste o rascunho completo do cardapio montado para um paciente.
public class MenuPatient
{
    public int Id { get; set; }

    // Dono do rascunho (nutricionista autenticado).
    public int UserId { get; set; }

    // Paciente ao qual este cardapio pertence.
    public int PatientId { get; set; }

    // Estruturas da tela armazenadas em JSON para manter flexibilidade de evolucao.
    public string MealGroupsJson { get; set; } = "[]";
    public string NutritionGuidanceJson { get; set; } = "{}";
    public string RecipeSuggestionsJson { get; set; } = "[]";
    public string AiGuidanceHighlightsJson { get; set; } = "[]";
    public string AiGenerationSettingsJson { get; set; } = "{}";
    public string AiRecipeGenerationSettingsJson { get; set; } = "{}";

    // Ultima etapa ativa do stepper na tela de montagem.
    public int ActiveDataEntryStep { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
