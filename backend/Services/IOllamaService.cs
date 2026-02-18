namespace Backend.Services;

public sealed class OllamaModelsResult
{
    public bool IsHealthy { get; init; }
    public List<string> AvailableModels { get; init; } = new();
    public string? ErrorMessage { get; init; }
}

public sealed class OllamaChatResult
{
    public string Model { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
}

public interface IOllamaService
{
    Task<OllamaModelsResult> GetModelsAsync(CancellationToken cancellationToken);
    Task<OllamaChatResult> ChatAsync(string prompt, string? modelOverride, CancellationToken cancellationToken);
}
