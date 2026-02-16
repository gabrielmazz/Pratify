namespace Backend.Utils;

public static class ImageDataUrlHelper
{
    public static bool TryDetectMimeType(byte[] imageData, out string mimeType)
    {
        mimeType = string.Empty;

        if (imageData.Length >= 8 &&
            imageData[0] == 0x89 &&
            imageData[1] == 0x50 &&
            imageData[2] == 0x4E &&
            imageData[3] == 0x47 &&
            imageData[4] == 0x0D &&
            imageData[5] == 0x0A &&
            imageData[6] == 0x1A &&
            imageData[7] == 0x0A)
        {
            mimeType = "image/png";
            return true;
        }

        if (imageData.Length >= 3 &&
            imageData[0] == 0xFF &&
            imageData[1] == 0xD8 &&
            imageData[2] == 0xFF)
        {
            mimeType = "image/jpeg";
            return true;
        }

        if (imageData.Length >= 12 &&
            imageData[0] == 0x52 && // R
            imageData[1] == 0x49 && // I
            imageData[2] == 0x46 && // F
            imageData[3] == 0x46 && // F
            imageData[8] == 0x57 && // W
            imageData[9] == 0x45 && // E
            imageData[10] == 0x42 && // B
            imageData[11] == 0x50) // P
        {
            mimeType = "image/webp";
            return true;
        }

        return false;
    }

    public static string? BuildDataUrl(byte[]? imageData)
    {
        if (imageData is not { Length: > 0 })
        {
            return null;
        }

        if (!TryDetectMimeType(imageData, out var mimeType))
        {
            return null;
        }

        var base64 = Convert.ToBase64String(imageData);
        return $"data:{mimeType};base64,{base64}";
    }
}
