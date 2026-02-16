using System.ComponentModel.DataAnnotations;

namespace Backend.Contracts;

// Payload de criacao de paciente recebido pelo endpoint POST /api/patients.
public sealed class CreatePatientRequest
{
    [Required]
    [StringLength(160, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    // ISO-8601 (ex: 1990-01-01T00:00:00.000Z).
    public DateTime BirthDate { get; set; }

    [Required]
    [StringLength(30)]
    public string Gender { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public float Weight { get; set; }

    [Range(0.01, double.MaxValue)]
    public float Height { get; set; }

    [Range(0.01, double.MaxValue)]
    public float BMI { get; set; }

    [Required]
    [MinLength(1)]
    public List<string> Goal { get; set; } = new();

    [Required]
    [StringLength(40)]
    public string ActivityLevel { get; set; } = string.Empty;

    // Pode ser lista vazia.
    public List<string>? MedicalConditions { get; set; }

    // Campos opcionais no frontend.
    public float? ArmCircumference { get; set; }
    public float? WaistCircumference { get; set; }
    public float? HipCircumference { get; set; }
    public float? ThighCircumference { get; set; }
    public float? SubscapularSkinfold { get; set; }
    public float? AxillarySkinfold { get; set; }
    public float? SuprailiacSkinfold { get; set; }
    public float? AbdominalSkinfold { get; set; }

    [Range(0.01, double.MaxValue)]
    public float BMR { get; set; }

    [Range(0.01, double.MaxValue)]
    public float TDEE { get; set; }
}
