using System.ComponentModel.DataAnnotations;

namespace Backend.Contracts;

// Payload recebido em POST /api/ai/chat.
public sealed class AiChatRequest
{
    [Required]
    [StringLength(8000, MinimumLength = 3)]
    public string Prompt { get; set; } = string.Empty;

    // Opcional para permitir override pontual no frontend.
    [StringLength(120)]
    public string? Model { get; set; }
}

public sealed class AiChatResponse
{
    public string Model { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

public sealed class AiModelsResponse
{
    public bool IsHealthy { get; set; }
    public string BaseUrl { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public List<string> AvailableModels { get; set; } = new();
    public string? Message { get; set; }
}
