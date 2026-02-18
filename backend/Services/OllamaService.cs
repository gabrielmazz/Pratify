using System.Net.Http.Json;
using System.Text.Json;
using Backend.Configuration;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public sealed class OllamaService : IOllamaService
{
    private readonly HttpClient _httpClient;
    private readonly OllamaOptions _options;
    private readonly ILogger<OllamaService> _logger;

    public OllamaService(
        HttpClient httpClient,
        IOptions<OllamaOptions> options,
        ILogger<OllamaService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<OllamaModelsResult> GetModelsAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var response = await _httpClient.GetAsync("/api/tags", cancellationToken);
            var payload = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return new OllamaModelsResult
                {
                    IsHealthy = false,
                    ErrorMessage = $"Ollama retornou {(int)response.StatusCode}."
                };
            }

            using var document = JsonDocument.Parse(payload);
            if (!document.RootElement.TryGetProperty("models", out var modelsElement) || modelsElement.ValueKind != JsonValueKind.Array)
            {
                return new OllamaModelsResult
                {
                    IsHealthy = false,
                    ErrorMessage = "Resposta do Ollama invalida: propriedade 'models' ausente."
                };
            }

            var models = new List<string>();
            foreach (var modelElement in modelsElement.EnumerateArray())
            {
                if (modelElement.TryGetProperty("name", out var nameElement))
                {
                    var name = nameElement.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        models.Add(name);
                    }
                }
            }

            models = models
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(model => model, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new OllamaModelsResult
            {
                IsHealthy = true,
                AvailableModels = models
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Falha ao consultar modelos do Ollama.");
            return new OllamaModelsResult
            {
                IsHealthy = false,
                ErrorMessage = "Nao foi possivel conectar ao Ollama."
            };
        }
    }

    public async Task<OllamaChatResult> ChatAsync(string prompt, string? modelOverride, CancellationToken cancellationToken)
    {
        var promptText = prompt.Trim();
        if (promptText.Length < 3)
        {
            throw new InvalidOperationException("Prompt deve conter ao menos 3 caracteres.");
        }

        var resolvedModel = ResolveModel(modelOverride);
        var payload = new
        {
            model = resolvedModel,
            stream = false,
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = promptText
                }
            }
        };

        using var response = await _httpClient.PostAsJsonAsync("/api/chat", payload, cancellationToken);
        var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Ollama retornou {(int)response.StatusCode}.");
        }

        using var document = JsonDocument.Parse(responseText);
        var root = document.RootElement;

        var modelName = root.TryGetProperty("model", out var modelElement)
            ? modelElement.GetString()
            : null;

        string? content = null;
        if (root.TryGetProperty("message", out var messageElement)
            && messageElement.ValueKind == JsonValueKind.Object
            && messageElement.TryGetProperty("content", out var contentElement))
        {
            content = contentElement.GetString();
        }

        content = content?.Trim();
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new InvalidOperationException("Ollama nao retornou conteudo no campo message.content.");
        }

        return new OllamaChatResult
        {
            Model = string.IsNullOrWhiteSpace(modelName) ? resolvedModel : modelName,
            Content = content
        };
    }

    private string ResolveModel(string? modelOverride)
    {
        if (!string.IsNullOrWhiteSpace(modelOverride))
        {
            return modelOverride.Trim();
        }

        if (!string.IsNullOrWhiteSpace(_options.Model))
        {
            return _options.Model.Trim();
        }

        return "qwen2.5:7b-instruct";
    }
}
