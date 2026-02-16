using System.Globalization;
using System.Security.Claims;
using Backend.Contracts;
using Backend.Data;
using Backend.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private const int MaxProfilePictureSizeBytes = 5 * 1024 * 1024;

    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/users/me
    // Endpoint principal para carregar perfil completo do nutricionista logado.
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserResponse>> Me(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new { message = "Usuario nao encontrado." });
        }

        return Ok(UserMappings.ToCurrentUserResponse(user));
    }

    // POST /api/users/me
    // Atualiza os dados editaveis de perfil do usuario autenticado.
    [Authorize]
    [HttpPost("me")]
    public async Task<ActionResult<CurrentUserResponse>> UpdateMe([FromBody] UpdateCurrentUserRequest request, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return NotFound(new { message = "Usuario nao encontrado." });
        }

        if (!TryParseBirthDateUtc(request.BirthDate, out var birthDateUtc))
        {
            return BadRequest(new { message = "Data de nascimento invalida. Envie em formato ISO-8601." });
        }

        user.BirthDate = birthDateUtc;
        user.Institution = NormalizeOptionalText(request.Institution);
        user.CRN = NormalizeOptionalText(request.CRN);
        user.City = NormalizeOptionalText(request.City);
        user.State = NormalizeOptionalText(request.State);

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(UserMappings.ToCurrentUserResponse(user));
    }

    // POST /api/users/me/profile-picture
    // Faz upload da imagem de perfil do usuario autenticado e salva no banco.
    [Authorize]
    [HttpPost("me/profile-picture")]
    public async Task<ActionResult<CurrentUserResponse>> UpdateProfilePicture([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Selecione uma imagem para upload." });
        }

        if (file.Length > MaxProfilePictureSizeBytes)
        {
            return BadRequest(new { message = "A imagem deve ter no maximo 5 MB." });
        }

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Token invalido." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return NotFound(new { message = "Usuario nao encontrado." });
        }

        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, cancellationToken);
        if (stream.Length == 0)
        {
            return BadRequest(new { message = "A imagem enviada esta vazia." });
        }

        var imageBytes = stream.ToArray();
        if (!ImageDataUrlHelper.TryDetectMimeType(imageBytes, out _))
        {
            return BadRequest(new { message = "Formato de imagem invalido. Use PNG, JPG ou WEBP." });
        }

        user.ProfilePictureData = imageBytes;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(UserMappings.ToCurrentUserResponse(user));
    }

    private static string? NormalizeOptionalText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static bool TryParseBirthDateUtc(string? birthDate, out DateTime? birthDateUtc)
    {
        birthDateUtc = null;
        if (string.IsNullOrWhiteSpace(birthDate))
        {
            return true;
        }

        var parsedSuccessfully = DateTimeOffset.TryParse(
            birthDate,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsedDate);

        if (!parsedSuccessfully)
        {
            return false;
        }

        var normalizedDate = DateTime.SpecifyKind(parsedDate.UtcDateTime.Date, DateTimeKind.Utc);
        var currentDate = DateTime.UtcNow.Date;
        if (normalizedDate.Year < 1900 || normalizedDate > currentDate)
        {
            return false;
        }

        birthDateUtc = normalizedDate;
        return true;
    }
}
