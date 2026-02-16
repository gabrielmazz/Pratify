using Backend.Models;
using Backend.Utils;

namespace Backend.Contracts;

public static class UserMappings
{
    public static CurrentUserResponse ToCurrentUserResponse(User user)
    {
        return new CurrentUserResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            CreatedAt = user.CreatedAt,
            BirthDate = user.BirthDate,
            Specialty = user.Specialty,
            Phone = user.Phone,
            CRN = user.CRN,
            Institution = user.Institution,
            ProfilePicture = ImageDataUrlHelper.BuildDataUrl(user.ProfilePictureData),
            IsVerified = user.IsVerified,
            City = user.City,
            State = user.State
        };
    }
}
