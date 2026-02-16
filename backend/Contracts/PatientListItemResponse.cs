namespace Backend.Contracts;

// DTO de listagem de pacientes para tabela no frontend.
public sealed class PatientListItemResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime BirthDate { get; set; }
    public string Gender { get; set; } = string.Empty;
    public float BMI { get; set; }
    public string Goal { get; set; } = string.Empty;
    public string ActivityLevel { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
