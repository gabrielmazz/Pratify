using System.ComponentModel.DataAnnotations;

namespace Backend.Contracts;

// Payload para salvar (ou atualizar) o rascunho completo da tela de cardapio.
public sealed class SavePatientMenuRequest
{
    [Range(0, 2)]
    public int ActiveDataEntryStep { get; set; } = 0;

    [Required]
    public List<PatientMenuMealGroupDto> MealGroups { get; set; } = new();

    [Required]
    public PatientMenuNutritionGuidanceDto NutritionGuidance { get; set; } = new();

    [Required]
    public List<string> AiGuidanceHighlights { get; set; } = new();

    [Required]
    public List<PatientMenuRecipeSuggestionDto> RecipeSuggestions { get; set; } = new();

    [Required]
    public PatientMenuAiGenerationSettingsDto AiGenerationSettings { get; set; } = new();

    [Required]
    public PatientMenuAiRecipeGenerationSettingsDto AiRecipeGenerationSettings { get; set; } = new();
}

// Resposta de leitura do cardapio salvo.
public sealed class PatientMenuResponse
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public int ActiveDataEntryStep { get; set; }
    public List<PatientMenuMealGroupDto> MealGroups { get; set; } = new();
    public PatientMenuNutritionGuidanceDto NutritionGuidance { get; set; } = new();
    public List<string> AiGuidanceHighlights { get; set; } = new();
    public List<PatientMenuRecipeSuggestionDto> RecipeSuggestions { get; set; } = new();
    public PatientMenuAiGenerationSettingsDto AiGenerationSettings { get; set; } = new();
    public PatientMenuAiRecipeGenerationSettingsDto AiRecipeGenerationSettings { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// Resposta paginada para historico de cardapios do paciente.
public sealed class PatientMenuHistoryResponse
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    public List<PatientMenuResponse> Items { get; set; } = new();
}

public sealed class PatientMenuMealGroupDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<PatientMenuMealItemDto> Items { get; set; } = new();
}

public sealed class PatientMenuMealItemDto
{
    public string Id { get; set; } = string.Empty;
    public string? FoodId { get; set; }
    public string Food { get; set; } = string.Empty;
    public string Quantity { get; set; } = string.Empty;
    public string Measure { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public sealed class PatientMenuNutritionGuidanceDto
{
    public int? HydrationGoalMl { get; set; }
    public string MealRoutineGuidance { get; set; } = string.Empty;
    public string FoodQualityGuidance { get; set; } = string.Empty;
    public string PreparationGuidance { get; set; } = string.Empty;
    public string BehaviorGuidance { get; set; } = string.Empty;
    public string SymptomMonitoringGuidance { get; set; } = string.Empty;
    public string RestrictionsGuidance { get; set; } = string.Empty;
    public string AdditionalGuidance { get; set; } = string.Empty;
}

public sealed class PatientMenuRecipeSuggestionDto
{
    public string Id { get; set; } = string.Empty;
    public string RecipeName { get; set; } = string.Empty;
    public string BasedOnFoods { get; set; } = string.Empty;
    public string Ingredients { get; set; } = string.Empty;
    public string PreparationMethod { get; set; } = string.Empty;
    public string YieldInfo { get; set; } = string.Empty;
    public string PortionQuantity { get; set; } = string.Empty;
}

public sealed class PatientMenuAiGenerationSettingsDto
{
    public string? ModelOverride { get; set; }
    public string PlanningFocus { get; set; } = string.Empty;
    public string ClinicalStrictness { get; set; } = string.Empty;
    public string PreparationProfile { get; set; } = string.Empty;
    public string BudgetProfile { get; set; } = string.Empty;
    public int MaxItemsPerGroup { get; set; }
    public string PreferredFoods { get; set; } = string.Empty;
    public string RestrictedFoods { get; set; } = string.Empty;
    public string ExtraInstructions { get; set; } = string.Empty;
}

public sealed class PatientMenuAiRecipeGenerationSettingsDto
{
    public string? ModelOverride { get; set; }
    public string RecipeFocus { get; set; } = string.Empty;
    public string PreparationProfile { get; set; } = string.Empty;
    public string BudgetProfile { get; set; } = string.Empty;
    public int RecipeCount { get; set; }
    public int MaxIngredientsPerRecipe { get; set; }
    public string PreferredFoods { get; set; } = string.Empty;
    public string RestrictedFoods { get; set; } = string.Empty;
    public string ExtraInstructions { get; set; } = string.Empty;
}
