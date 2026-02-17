namespace Backend.Contracts;

// DTO de detalhe do paciente para tela completa de visualizacao.
public sealed class PatientDetailsResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime BirthDate { get; set; }
    public string Gender { get; set; } = string.Empty;
    public float Weight { get; set; }
    public float Height { get; set; }
    public float BMI { get; set; }
    public string Goal { get; set; } = string.Empty;
    public string ActivityLevel { get; set; } = string.Empty;
    public List<string> MedicalConditions { get; set; } = new();
    public float ArmCircumference { get; set; }
    public float WaistCircumference { get; set; }
    public float HipCircumference { get; set; }
    public float ThighCircumference { get; set; }
    public float SubscapularSkinfold { get; set; }
    public float AxillarySkinfold { get; set; }
    public float SuprailiacSkinfold { get; set; }
    public float AbdominalSkinfold { get; set; }
    public float BMR { get; set; }
    public float TDEE { get; set; }
    public DateTime CreatedAt { get; set; }
}
