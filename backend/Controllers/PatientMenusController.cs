using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[ApiController]
[Authorize]
[Route("api/patients/{patientId:int}/menu")]
public class PatientMenusController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const int DefaultHistoryPageSize = 5;
    private const int MaxHistoryPageSize = 30;
    private readonly AppDbContext _context;

    public PatientMenusController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/patients/{patientId}/menu
    [HttpGet]
    public async Task<ActionResult<PatientMenuResponse>> GetByPatient(int patientId, CancellationToken cancellationToken)
    {
        if (!TryResolveUserId(out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var patientExists = await _context.Patients
            .AsNoTracking()
            .AnyAsync(patient => patient.Id == patientId && patient.UserId == userId, cancellationToken);

        if (!patientExists)
        {
            return NotFound(new { message = "Paciente nao encontrado." });
        }

        var savedMenu = await _context.MenuPatients
            .AsNoTracking()
            .Where(menu => menu.PatientId == patientId && menu.UserId == userId)
            .OrderByDescending(menu => menu.UpdatedAt)
            .ThenByDescending(menu => menu.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (savedMenu is null)
        {
            return NotFound(new { message = "Cardapio ainda nao foi salvo para este paciente." });
        }

        return Ok(MapToResponse(savedMenu));
    }

    // GET /api/patients/{patientId}/menu/history?page=1&pageSize=5
    [HttpGet("history")]
    public async Task<ActionResult<PatientMenuHistoryResponse>> GetHistoryByPatient(
        int patientId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultHistoryPageSize,
        CancellationToken cancellationToken = default)
    {
        if (!TryResolveUserId(out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var patientExists = await _context.Patients
            .AsNoTracking()
            .AnyAsync(patient => patient.Id == patientId && patient.UserId == userId, cancellationToken);

        if (!patientExists)
        {
            return NotFound(new { message = "Paciente nao encontrado." });
        }

        var normalizedPage = Math.Max(page, 1);
        var normalizedPageSize = Math.Clamp(pageSize, 1, MaxHistoryPageSize);

        var baseQuery = _context.MenuPatients
            .AsNoTracking()
            .Where(menu => menu.PatientId == patientId && menu.UserId == userId);

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var totalPages = totalCount == 0
            ? 0
            : (int)Math.Ceiling(totalCount / (double)normalizedPageSize);

        var resolvedPage = totalPages == 0
            ? 1
            : Math.Min(normalizedPage, totalPages);

        var menus = await baseQuery
            .OrderByDescending(menu => menu.UpdatedAt)
            .ThenByDescending(menu => menu.Id)
            .Skip((resolvedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .ToListAsync(cancellationToken);

        var historyResponse = new PatientMenuHistoryResponse
        {
            Page = resolvedPage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            Items = menus.Select(MapToResponse).ToList(),
        };

        return Ok(historyResponse);
    }

    // PUT /api/patients/{patientId}/menu
    // Salva uma nova versao do cardapio no historico do paciente.
    [HttpPut]
    public async Task<ActionResult<PatientMenuResponse>> SaveByPatient(
        int patientId,
        [FromBody] SavePatientMenuRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryResolveUserId(out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var patientExists = await _context.Patients
            .AsNoTracking()
            .AnyAsync(patient => patient.Id == patientId && patient.UserId == userId, cancellationToken);

        if (!patientExists)
        {
            return NotFound(new { message = "Paciente nao encontrado." });
        }

        var now = DateTime.UtcNow;
        var normalizedRequest = NormalizeRequest(request);
        var savedMenu = new MenuPatient
        {
            UserId = userId,
            PatientId = patientId,
            CreatedAt = now,
        };
        _context.MenuPatients.Add(savedMenu);

        savedMenu.ActiveDataEntryStep = Math.Clamp(normalizedRequest.ActiveDataEntryStep, 0, 2);
        savedMenu.MealGroupsJson = JsonSerializer.Serialize(normalizedRequest.MealGroups, JsonOptions);
        savedMenu.NutritionGuidanceJson = JsonSerializer.Serialize(normalizedRequest.NutritionGuidance, JsonOptions);
        savedMenu.RecipeSuggestionsJson = JsonSerializer.Serialize(normalizedRequest.RecipeSuggestions, JsonOptions);
        savedMenu.AiGuidanceHighlightsJson = JsonSerializer.Serialize(normalizedRequest.AiGuidanceHighlights, JsonOptions);
        savedMenu.AiGenerationSettingsJson = JsonSerializer.Serialize(normalizedRequest.AiGenerationSettings, JsonOptions);
        savedMenu.AiRecipeGenerationSettingsJson = JsonSerializer.Serialize(normalizedRequest.AiRecipeGenerationSettings, JsonOptions);
        savedMenu.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(savedMenu));
    }

    // DELETE /api/patients/{patientId}/menu/{menuId}
    [HttpDelete("{menuId:int}")]
    public async Task<IActionResult> DeleteByPatient(
        int patientId,
        int menuId,
        CancellationToken cancellationToken)
    {
        if (!TryResolveUserId(out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var patientExists = await _context.Patients
            .AsNoTracking()
            .AnyAsync(patient => patient.Id == patientId && patient.UserId == userId, cancellationToken);

        if (!patientExists)
        {
            return NotFound(new { message = "Paciente nao encontrado." });
        }

        var savedMenu = await _context.MenuPatients
            .FirstOrDefaultAsync(menu =>
                menu.Id == menuId &&
                menu.PatientId == patientId &&
                menu.UserId == userId,
                cancellationToken);

        if (savedMenu is null)
        {
            return NotFound(new { message = "Cardapio nao encontrado para este paciente." });
        }

        _context.MenuPatients.Remove(savedMenu);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Cardapio excluido com sucesso." });
    }

    private bool TryResolveUserId(out int userId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdClaim, out userId);
    }

    private static SavePatientMenuRequest NormalizeRequest(SavePatientMenuRequest request)
    {
        var safeMealGroups = request.MealGroups ?? new List<PatientMenuMealGroupDto>();
        var safeNutritionGuidance = request.NutritionGuidance ?? new PatientMenuNutritionGuidanceDto();
        var safeAiGuidanceHighlights = request.AiGuidanceHighlights ?? new List<string>();
        var safeRecipeSuggestions = request.RecipeSuggestions ?? new List<PatientMenuRecipeSuggestionDto>();
        var safeAiGenerationSettings = request.AiGenerationSettings ?? new PatientMenuAiGenerationSettingsDto();
        var safeAiRecipeGenerationSettings = request.AiRecipeGenerationSettings ?? new PatientMenuAiRecipeGenerationSettingsDto();

        var mealGroups = safeMealGroups
            .Select(group => new PatientMenuMealGroupDto
            {
                Id = NormalizeText(group.Id),
                Name = NormalizeText(group.Name),
                ScheduleTime = NormalizeScheduleTime(group.ScheduleTime),
                Items = (group.Items ?? new List<PatientMenuMealItemDto>())
                    .Select(item => new PatientMenuMealItemDto
                    {
                        Id = NormalizeText(item.Id),
                        FoodId = NormalizeNullableText(item.FoodId),
                        Food = NormalizeText(item.Food),
                        Quantity = NormalizeText(item.Quantity),
                        Measure = NormalizeText(item.Measure),
                        Notes = NormalizeText(item.Notes),
                    })
                    .ToList(),
            })
            .ToList();

        var aiGuidanceHighlights = safeAiGuidanceHighlights
            .Select(NormalizeText)
            .Where(highlight => highlight.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var recipeSuggestions = safeRecipeSuggestions
            .Select(recipe => new PatientMenuRecipeSuggestionDto
            {
                Id = NormalizeText(recipe.Id),
                RecipeName = NormalizeText(recipe.RecipeName),
                BasedOnFoods = NormalizeText(recipe.BasedOnFoods),
                Ingredients = NormalizeText(recipe.Ingredients),
                PreparationMethod = NormalizeText(recipe.PreparationMethod),
                YieldInfo = NormalizeText(recipe.YieldInfo),
                PortionQuantity = NormalizeText(recipe.PortionQuantity),
            })
            .ToList();

        return new SavePatientMenuRequest
        {
            ActiveDataEntryStep = request.ActiveDataEntryStep,
            MealGroups = mealGroups,
            NutritionGuidance = new PatientMenuNutritionGuidanceDto
            {
                HydrationGoalMl = safeNutritionGuidance.HydrationGoalMl,
                MealRoutineGuidance = NormalizeText(safeNutritionGuidance.MealRoutineGuidance),
                FoodQualityGuidance = NormalizeText(safeNutritionGuidance.FoodQualityGuidance),
                PreparationGuidance = NormalizeText(safeNutritionGuidance.PreparationGuidance),
                BehaviorGuidance = NormalizeText(safeNutritionGuidance.BehaviorGuidance),
                SymptomMonitoringGuidance = NormalizeText(safeNutritionGuidance.SymptomMonitoringGuidance),
                RestrictionsGuidance = NormalizeText(safeNutritionGuidance.RestrictionsGuidance),
                AdditionalGuidance = NormalizeText(safeNutritionGuidance.AdditionalGuidance),
            },
            AiGuidanceHighlights = aiGuidanceHighlights,
            RecipeSuggestions = recipeSuggestions,
            AiGenerationSettings = new PatientMenuAiGenerationSettingsDto
            {
                ModelOverride = NormalizeNullableText(safeAiGenerationSettings.ModelOverride),
                PlanningFocus = NormalizeText(safeAiGenerationSettings.PlanningFocus),
                ClinicalStrictness = NormalizeText(safeAiGenerationSettings.ClinicalStrictness),
                PreparationProfile = NormalizeText(safeAiGenerationSettings.PreparationProfile),
                BudgetProfile = NormalizeText(safeAiGenerationSettings.BudgetProfile),
                MaxItemsPerGroup = safeAiGenerationSettings.MaxItemsPerGroup,
                PreferredFoods = NormalizeText(safeAiGenerationSettings.PreferredFoods),
                RestrictedFoods = NormalizeText(safeAiGenerationSettings.RestrictedFoods),
                ExtraInstructions = NormalizeText(safeAiGenerationSettings.ExtraInstructions),
            },
            AiRecipeGenerationSettings = new PatientMenuAiRecipeGenerationSettingsDto
            {
                ModelOverride = NormalizeNullableText(safeAiRecipeGenerationSettings.ModelOverride),
                RecipeFocus = NormalizeText(safeAiRecipeGenerationSettings.RecipeFocus),
                PreparationProfile = NormalizeText(safeAiRecipeGenerationSettings.PreparationProfile),
                BudgetProfile = NormalizeText(safeAiRecipeGenerationSettings.BudgetProfile),
                RecipeCount = safeAiRecipeGenerationSettings.RecipeCount,
                MaxIngredientsPerRecipe = safeAiRecipeGenerationSettings.MaxIngredientsPerRecipe,
                PreferredFoods = NormalizeText(safeAiRecipeGenerationSettings.PreferredFoods),
                RestrictedFoods = NormalizeText(safeAiRecipeGenerationSettings.RestrictedFoods),
                ExtraInstructions = NormalizeText(safeAiRecipeGenerationSettings.ExtraInstructions),
            },
        };
    }

    private static PatientMenuResponse MapToResponse(MenuPatient savedMenu)
    {
        return new PatientMenuResponse
        {
            Id = savedMenu.Id,
            PatientId = savedMenu.PatientId,
            ActiveDataEntryStep = savedMenu.ActiveDataEntryStep,
            MealGroups = DeserializeOrDefault(savedMenu.MealGroupsJson, new List<PatientMenuMealGroupDto>()),
            NutritionGuidance = DeserializeOrDefault(savedMenu.NutritionGuidanceJson, new PatientMenuNutritionGuidanceDto()),
            RecipeSuggestions = DeserializeOrDefault(savedMenu.RecipeSuggestionsJson, new List<PatientMenuRecipeSuggestionDto>()),
            AiGuidanceHighlights = DeserializeOrDefault(savedMenu.AiGuidanceHighlightsJson, new List<string>()),
            AiGenerationSettings = DeserializeOrDefault(savedMenu.AiGenerationSettingsJson, new PatientMenuAiGenerationSettingsDto()),
            AiRecipeGenerationSettings = DeserializeOrDefault(savedMenu.AiRecipeGenerationSettingsJson, new PatientMenuAiRecipeGenerationSettingsDto()),
            CreatedAt = savedMenu.CreatedAt,
            UpdatedAt = savedMenu.UpdatedAt,
        };
    }

    private static T DeserializeOrDefault<T>(string json, T fallbackValue)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return fallbackValue;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(json, JsonOptions) ?? fallbackValue;
        }
        catch
        {
            return fallbackValue;
        }
    }

    private static string NormalizeText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
    }

    private static string? NormalizeNullableText(string? value)
    {
        var normalizedValue = NormalizeText(value);
        return normalizedValue.Length == 0 ? null : normalizedValue;
    }

    private static string? NormalizeScheduleTime(string? value)
    {
        var normalizedValue = NormalizeText(value);
        if (normalizedValue.Length == 0)
        {
            return null;
        }

        return Regex.IsMatch(normalizedValue, "^(?:[01]\\d|2[0-3]):[0-5]\\d$")
            ? normalizedValue
            : null;
    }
}
