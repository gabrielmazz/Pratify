namespace Backend.Configuration;

public sealed class OllamaOptions
{
    public const string SectionName = "Ollama";

    public string BaseUrl { get; set; } = "http://127.0.0.1:11434";
    public string Model { get; set; } = "qwen2.5:7b-instruct";
    public int TimeoutSeconds { get; set; } = 120;
}
