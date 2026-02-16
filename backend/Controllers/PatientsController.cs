using System.Security.Claims;
using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PatientsController : ControllerBase
{
    private readonly AppDbContext _context;

    public PatientsController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/patients
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<List<PatientListItemResponse>>> List(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var patients = await _context.Patients
            .AsNoTracking()
            .Where(patient => patient.UserId == userId)
            .OrderByDescending(patient => patient.CreatedAt)
            .Select(patient => new PatientListItemResponse
            {
                Id = patient.Id,
                Name = patient.Name,
                BirthDate = patient.BirthDate,
                Gender = patient.Gender,
                BMI = patient.BMI,
                Goal = patient.Goal,
                ActivityLevel = patient.ActivityLevel,
                CreatedAt = patient.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(patients);
    }

    // POST /api/patients
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePatientRequest request, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var birthDateUtc = NormalizeBirthDateUtc(request.BirthDate);
        if (birthDateUtc is null)
        {
            return BadRequest(new { message = "Data de nascimento invalida." });
        }

        var normalizedGoal = NormalizeList(request.Goal);
        if (normalizedGoal.Count == 0)
        {
            return BadRequest(new { message = "Informe ao menos um objetivo do paciente." });
        }

        // A entidade atual armazena Goal como string (varchar).
        var goalAsText = string.Join(", ", normalizedGoal);
        if (goalAsText.Length > 200)
        {
            return BadRequest(new { message = "Objetivos excedem o limite de 200 caracteres." });
        }

        var patient = new Patient
        {
            UserId = userId,
            Name = request.Name.Trim(),
            BirthDate = birthDateUtc.Value,
            Gender = request.Gender.Trim(),
            Weight = request.Weight,
            Height = request.Height,
            BMI = request.BMI,
            Goal = goalAsText,
            ActivityLevel = request.ActivityLevel.Trim(),
            MedicalConditions = NormalizeList(request.MedicalConditions),
            ArmCircumference = request.ArmCircumference ?? 0f,
            WaistCircumference = request.WaistCircumference ?? 0f,
            HipCircumference = request.HipCircumference ?? 0f,
            ThighCircumference = request.ThighCircumference ?? 0f,
            SubscapularSkinfold = request.SubscapularSkinfold ?? 0f,
            AxillarySkinfold = request.AxillarySkinfold ?? 0f,
            SuprailiacSkinfold = request.SuprailiacSkinfold ?? 0f,
            AbdominalSkinfold = request.AbdominalSkinfold ?? 0f,
            BMR = request.BMR,
            TDEE = request.TDEE,
            CreatedAt = DateTime.UtcNow
        };

        _context.Patients.Add(patient);
        await _context.SaveChangesAsync(cancellationToken);

        return Created($"/api/patients/{patient.Id}", new
        {
            id = patient.Id,
            message = "Paciente criado com sucesso."
        });
    }

    private static DateTime? NormalizeBirthDateUtc(DateTime birthDate)
    {
        if (birthDate == default)
        {
            return null;
        }

        var utcDate = birthDate.Kind switch
        {
            DateTimeKind.Utc => birthDate.Date,
            DateTimeKind.Local => birthDate.ToUniversalTime().Date,
            _ => DateTime.SpecifyKind(birthDate, DateTimeKind.Utc).Date
        };

        var today = DateTime.UtcNow.Date;
        if (utcDate.Year < 1900 || utcDate > today)
        {
            return null;
        }

        return DateTime.SpecifyKind(utcDate, DateTimeKind.Utc);
    }

    private static List<string> NormalizeList(IEnumerable<string>? values)
    {
        if (values is null)
        {
            return new List<string>();
        }

        return values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
