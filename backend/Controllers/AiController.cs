using Backend.Configuration;
using Backend.Contracts;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly IOllamaService _ollamaService;
    private readonly OllamaOptions _ollamaOptions;
    private readonly ILogger<AiController> _logger;

    public AiController(
        IOllamaService ollamaService,
        IOptions<OllamaOptions> ollamaOptions,
        ILogger<AiController> logger)
    {
        _ollamaService = ollamaService;
        _ollamaOptions = ollamaOptions.Value;
        _logger = logger;
    }

    // GET /api/ai/models
    [HttpGet("models")]
    public async Task<ActionResult<AiModelsResponse>> GetModels(CancellationToken cancellationToken)
    {
        var result = await _ollamaService.GetModelsAsync(cancellationToken);

        var response = new AiModelsResponse
        {
            IsHealthy = result.IsHealthy,
            BaseUrl = _ollamaOptions.BaseUrl,
            Model = _ollamaOptions.Model,
            AvailableModels = result.AvailableModels,
            Message = result.ErrorMessage
        };

        if (!result.IsHealthy)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, response);
        }

        return Ok(response);
    }

    // POST /api/ai/chat
    [HttpPost("chat")]
    public async Task<ActionResult<AiChatResponse>> Chat([FromBody] AiChatRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _ollamaService.ChatAsync(request.Prompt, request.Model, cancellationToken);

            return Ok(new AiChatResponse
            {
                Model = result.Model,
                Content = result.Content
            });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (InvalidOperationException exception)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = exception.Message });
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(exception, "Falha de conexao com Ollama.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Ollama indisponivel no momento." });
        }
        catch (TaskCanceledException exception)
        {
            _logger.LogWarning(exception, "Timeout ao chamar Ollama.");
            return StatusCode(StatusCodes.Status504GatewayTimeout, new { message = "Timeout ao consultar Ollama." });
        }
    }
}
